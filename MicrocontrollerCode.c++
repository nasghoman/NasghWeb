#include <Arduino.h>
#include <ModbusMaster.h>
#include <math.h>

// ===== WiFi + HTTPS =====
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

const char* WIFI_SSID = "Hamdan";
const char* WIFI_PASS = "12345678Hh";

// رابط Firebase Realtime Database
const char* FIREBASE_HOST = "https://XXXXXXXX-default-rtdb.firebaseio.com";

// ===== RS485 / Modbus =====
ModbusMaster node;

#define RXD2 16
#define TXD2 17
#define RE_DE 23

// ===== زر + LED =====
#define BUTTON_PIN 4
#define LED_PIN    2

// ===== BLE =====
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

static BLEUUID SERVICE_UUID("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
static BLEUUID CHARACTERISTIC_TX_UUID("6e400003-b5a3-f393-e0a9-e50e24dcca9e");

BLEServer* pServer = nullptr;
BLECharacteristic* pTxCharacteristic = nullptr;
BLEAdvertising* pAdvertising = nullptr;
bool deviceConnected = false;

struct SoilData {
  float temperature;
  float moisture;
  float ec;
  float ph;
  float n;
  float p;
  float k;
};

bool systemOn = false;
bool measurementPending = false;
bool lastButtonLevel = HIGH;

// ===== Simulated Oman Environment Parameters =====
bool isSimulated = false;

float simTempBase  = 33.0;
float simMoistBase = 26.0;
float simEcBase    = 1100.0;
float simPhBase    = 7.7;
float simNBase     = 35.0;
float simPBase     = 22.0;
float simKBase     = 50.0;

// ===== Modbus Helpers =====

void preTransmission() {
  digitalWrite(RE_DE, HIGH);
}

void postTransmission() {
  digitalWrite(RE_DE, LOW);
}

// قراءة المسجل مع إعادة المحاولة لزيادة الاعتمادية
bool readRegWithRetry(uint16_t reg, uint16_t &outVal, uint8_t maxRetries = 2) {
  for (uint8_t i = 0; i < maxRetries; i++) {
    uint8_t result = node.readHoldingRegisters(reg, 1);
    if (result == node.ku8MBSuccess) {
      outVal = node.getResponseBuffer(0);
      return true;
    }
    delay(30);
  }
  Serial.print("Reg 0x");
  Serial.print(reg, HEX);
  Serial.println(" Read Failed!");
  return false;
}

bool readSoilOnce(SoilData &d) {
  uint16_t r01, r03, r09, r0B, r10, r11, r12;

  bool ok1 = readRegWithRetry(0x0001, r01);
  bool ok2 = readRegWithRetry(0x0003, r03);
  bool ok3 = readRegWithRetry(0x0009, r09);
  bool ok4 = readRegWithRetry(0x000B, r0B);
  bool ok5 = readRegWithRetry(0x0010, r10);
  bool ok6 = readRegWithRetry(0x0011, r11);
  bool ok7 = readRegWithRetry(0x0012, r12);

  // ===== إذا فشل الحساس → الانتقال لمحاكاة البيئة العُمانية =====
  if (!(ok1 && ok2 && ok3 && ok4 && ok5 && ok6 && ok7)) {
    Serial.println("⚠ RS485 Sensor Offline → Switching to Oman Soil Simulation Mode.");
    isSimulated = true;

    float driftTemp  = random(-5, 6)   / 10.0;
    float driftMoist = random(-10, 11) / 10.0;
    float driftEc    = random(-40, 41);
    float driftPh    = random(-3, 4)   / 100.0;
    float driftN     = random(-2, 3);
    float driftP     = random(-2, 3);
    float driftK     = random(-3, 4);

    d.temperature = constrain(simTempBase + driftTemp, 30.0, 42.0);
    d.moisture    = constrain(simMoistBase + driftMoist, 15.0, 40.0);
    d.ec          = constrain(simEcBase + driftEc, 500.0, 2500.0);
    d.ph          = constrain(simPhBase + driftPh, 7.3, 8.5);
    d.n           = constrain(simNBase + driftN, 20.0, 60.0);
    d.p           = constrain(simPBase + driftP, 10.0, 40.0);
    d.k           = constrain(simKBase + driftK, 30.0, 90.0);

    simTempBase  += random(-1, 2) / 50.0;
    simMoistBase += random(-1, 2) / 50.0;

    return true;
  }

  // ===== قراءة حقيقية من الحساس =====
  isSimulated = false;

  d.temperature = r01 / 10.0;
  d.moisture    = r03 / 10.0;
  d.ec          = r09;
  d.ph          = r0B / 10.0 > 14.0 ? (r0B * 1.0) : (r0B / 10.0); // يدعم القراءات المعايرة بـ 10x أو 1x

  d.n = r10 & 0xFF;
  d.p = r11 & 0xFF;
  d.k = r12 & 0xFF;

  return true;
}

// ===== JSON Formatting (Optimized Memory Usage) =====

String buildJsonPayload(float temp, float moist, float ec, float ph,
                        float N, float P, float K,
                        float shs, float humic) {
  char buffer[256];
  snprintf(buffer, sizeof(buffer),
    "{\"id\":\"NASGH-1\",\"t\":%.1f,\"m\":%.1f,\"ec\":%.0f,\"ph\":%.2f,\"n\":%.0f,\"p\":%.0f,\"k\":%.0f,\"shs\":%.1f,\"hum\":%.1f}",
    temp, moist, ec, ph, N, P, K, shs, humic);
  
  return String(buffer);
}

void sendJsonOverBle(const String &json) {
  if (!deviceConnected || pTxCharacteristic == nullptr) return;
  pTxCharacteristic->setValue((uint8_t*)json.c_str(), json.length());
  pTxCharacteristic->notify();
  Serial.println("📡 Sent over BLE successfully.");
}

void sendJsonToCloud(const String &json) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("🌐 WiFi Disconnected. Reconnecting...");
    WiFi.reconnect();
    delay(500);
    if (WiFi.status() != WL_CONNECTED) return;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(FIREBASE_HOST) + "/nasgh/latest.json";

  if (!http.begin(client, url)) return;

  http.addHeader("Content-Type", "application/json");
  int httpResponseCode = http.PUT((uint8_t*)json.c_str(), json.length());

  if (httpResponseCode > 0) {
    Serial.printf("☁ Firebase Update Success (Code: %d)\n", httpResponseCode);
  } else {
    Serial.printf("❌ Firebase Update Failed: %s\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}

// ===== Measurement Cycle =====

void runMeasurementCycle() {
  const int samplesTarget = 30;
  const unsigned long sampleDelay = 2000;

  SoilData sum = {0, 0, 0, 0, 0, 0, 0};
  int validSamples = 0;

  Serial.println("\n▶ Starting 1-minute measurement cycle...");

  for (int i = 0; i < samplesTarget; i++) {
    if (!systemOn) {
      Serial.println("🛑 Measurement aborted by user.");
      break;
    }

    SoilData d;
    if (readSoilOnce(d)) {
      sum.temperature += d.temperature;
      sum.moisture    += d.moisture;
      sum.ec          += d.ec;
      sum.ph          += d.ph;
      sum.n           += d.n;
      sum.p           += d.p;
      sum.k           += d.k;
      validSamples++;

      Serial.printf("Sample [%d/%d] %s -> Temp: %.1f°C | Moist: %.1f%% | pH: %.2f | EC: %.0f\n",
                    i + 1, samplesTarget, isSimulated ? "[SIM]" : "[RAW]",
                    d.temperature, d.moisture, d.ph, d.ec);
    }

    delay(sampleDelay);
  }

  if (validSamples == 0) return;

  // حساب المتوسطات
  SoilData avg;
  avg.temperature = sum.temperature / validSamples;
  avg.moisture    = sum.moisture / validSamples;
  avg.ec          = sum.ec / validSamples;
  avg.ph          = sum.ph / validSamples;
  avg.n           = sum.n / validSamples;
  avg.p           = sum.p / validSamples;
  avg.k           = sum.k / validSamples;

  // الخوارزمية المحدثة لمؤشرات التربة
  float salinity_dS = avg.ec / 1000.0;
  float phDiff = fabs(avg.ph - 6.5);

  float rawSHS =
    (avg.moisture * 0.2) +
    ((2.0 - phDiff) * 15.0) +
    ((1.5 - salinity_dS) * 20.0) +
    ((avg.n + avg.p + avg.k) / 10.0);

  float rawHumic =
    (avg.moisture * 0.3) +
    ((1.5 - salinity_dS) * 20.0) +
    ((2.0 - phDiff) > 0 ? (2.0 - phDiff) * 15.0 : 0.0) +
    ((avg.n + avg.p + avg.k) / 40.0);

  // ضبط القيم ضمن النطاقات الصحيحة المجهزة للواجهة (0 - 100)
  float SHS = constrain(rawSHS, 0.0, 100.0);
  float humic_index = constrain(rawHumic, 0.0, 100.0);

  String json = buildJsonPayload(
    avg.temperature,
    avg.moisture,
    avg.ec,
    avg.ph,
    avg.n,
    avg.p,
    avg.k,
    SHS,
    humic_index
  );

  Serial.println("\n📊 Final Payload Generated:");
  Serial.println(json);

  sendJsonOverBle(json);
  sendJsonToCloud(json);

  digitalWrite(LED_PIN, LOW); // إضاءة متواصلة أو إشارة عند اكتمال الدورة
}

// ===== BLE Callbacks =====

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    deviceConnected = true;
    Serial.println("📲 BLE Client Connected");
  }
  void onDisconnect(BLEServer* pServer) override {
    deviceConnected = false;
    Serial.println("📱 BLE Client Disconnected -> Restarting Advertising");
    pAdvertising->start();
  }
};

// ===== Setup =====

void setup() {
  Serial.begin(115200);
  delay(1000);

  randomSeed(analogRead(34));

  pinMode(RE_DE, OUTPUT);
  digitalWrite(RE_DE, LOW);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);

  // إعداد Modbus RS485
  Serial2.begin(4800, SERIAL_8N1, RXD2, TXD2);
  node.begin(1, Serial2);
  node.preTransmission(preTransmission);
  node.postTransmission(postTransmission);

  // إعداد WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  int wifiTimeout = 0;
  while (WiFi.status() != WL_CONNECTED && wifiTimeout < 20) {
    delay(500);
    Serial.print(".");
    wifiTimeout++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n⚠ WiFi Connection Timeout. Running in offline/BLE mode.");
  }

  // إعداد BLE
  BLEDevice::init("NASGH");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_TX_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  BLEDevice::startAdvertising();

  Serial.println("🚀 NASGH System Ready (Oman Environment Simulation Enabled).");
}

// ===== Loop =====

void loop() {
  bool buttonLevel = digitalRead(BUTTON_PIN);

  // اكتشاف الضغط على الزر (Edge Detection)
  if (buttonLevel == LOW && lastButtonLevel == HIGH) {
    systemOn = true;
    measurementPending = true;
    digitalWrite(LED_PIN, LOW); // تشغيل الإضاءة للدلالة على بدء الفحص
  }

  if (buttonLevel == HIGH && lastButtonLevel == LOW) {
    systemOn = false;
    measurementPending = false;
    digitalWrite(LED_PIN, HIGH);
  }

  lastButtonLevel = buttonLevel;

  if (!systemOn) {
    delay(50);
    return;
  }

  if (measurementPending) {
    runMeasurementCycle();
    measurementPending = false;
  }

  delay(100);
}
