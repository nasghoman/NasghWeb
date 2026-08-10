// api/Oman_RAG.js
const omanRAGData = {
  "system_info": {
    "project_name": "NASGH Agricultural Diagnostic System",
    "version": "2.5.0-PROD",
    "geographic_scope": "Sultanate of Oman"
  },
  "knowledge_base": [
    {
      "chunk_id": "SOIL_MACRO_NUTRIENTS_01",
      "category": "Soil Fertility & Chemistry",
      "tags": ["nitrogen", "phosphorus", "potassium", "npk", "deficit"],
      "title": "مستويات العناصر الكبرى في التربة العُمانية",
      "content": "تعاني غالبية الترب العُمانية من انخفاض حاد في النيتروجين الكلي بتركيز تراوح بين 200 - 800 mg/kg، ونقص شديد في الفوسفور الجاهز بين 3 - 15 mg/kg. وفي المقابل، يتواجد البوتاسيوم المتاح بمستويات متوسطة تتراوح بين 80 - 300 mg/kg.",
      "metadata": { "source": "تقرير الخصائص الكيميائية والمغذيات الرئيسية" }
    },
    {
      "chunk_id": "SOIL_MICRO_NUTRIENTS_CALCIUM_02",
      "category": "Soil Fertility & Chemistry",
      "tags": ["calcium", "zinc", "caco3", "calcareous", "alkaline"],
      "title": "مستويات الكالسيوم والزنك والعنصر الكلسي",
      "content": "تسجل التربة العُمانية ارتفاعاً طبيعياً في الكالسيوم المتبادل بتراكيز بين 2000 - 8000 mg/kg ناتج عن المكون الكلسي المرتفع (CaCO3 بنسبة 10 - 40%). وفي المقابل، تسجل التربة نقصاً حاداً في عنصر الزنك المتاح بتراكيز ضئيلة تتراوح بين 0.3 - 2.0 mg/kg.",
      "metadata": { "source": "تقرير الخصائص الكيميائية" }
    },
    {
      "chunk_id": "SOIL_PHYSICOCHEMICAL_INDEX_03",
      "category": "Soil Physics & Electrochemistry",
      "tags": ["ph", "ec", "salinity", "organic_matter", "alkalinity"],
      "title": "مؤشرات الحموضة والملوحة والمادة العضوية",
      "content": "تسود القلوية على غالبية الترب العُمانية بدرجة حموضة (pH) تتراوح بين 7.5 - 8.5، مع انخفاض ملحوظ في المادة العضوية بين 0.2 - 1.5%. بينما تتفاوت الملوحة (EC) تفاوتاً واسعاً من 0.5 إلى أكثر من 8 dS/m حسب القرب من الساحل وطبيعة الموقع.",
      "metadata": { "source": "تقرير الخصائص الكيميائية للتربة" }
    },
    {
      "chunk_id": "SOIL_RECOMMENDATIONS_AMENDMENTS_04",
      "category": "Agronomic Action Plans",
      "tags": ["biochar", "compost", "edta", "eddha", "gypsum", "humic", "fertilizer"],
      "title": "التوصيات الفنية وإدارة خصوبة التربة العُمانية",
      "content": "لرفع خصوبة التربة يُنصح بانتظام إضافة المادة العضوية والكمبوست أو الفحم الحيوي (Biochar)، والتركيز على التسميد بالنيتروجين والفوسفور والزنك. كما يُوصى باستخدام مخلبات العناصر الصغرى بصيغ (EDDHA/EDTA)، وإدارة الملوحة باستخدام الجبس الزراعي وهيمويك أسيد مع انتظام الري والغسيل الدوري.",
      "metadata": { "source": "تقرير الإدارة والحلول الزراعية" }
    },
    {
      "chunk_id": "GEOLOGY_OPHIOLITE_ANOMALIES_06",
      "category": "Geology & Heavy Metals",
      "tags": ["heavy_metals", "nickel", "chromium", "cobalt", "ophiolite", "geology"],
      "title": "تأثير صخور الأفيولايت والارتفاع الجيولوجي الطبيعي",
      "content": "تشهد المناطق المرتبطة بسلاسل صخور الأفيولايت ارتفاعاً طبيعياً في تراكيز النيكل (200 - 2000 mg/kg)، الكروم (300 - 3000 mg/kg)، والكوبالت (20 - 200 mg/kg). ويُعد هذا الارتفاع ظاهرة جيولوجية طبيعية أصلية ولا يُعزى لأي تلوث بشري.",
      "metadata": { "source": "دليل الجيولوجيا وتأثير صخور الأفيولايت" }
    },
    {
      "chunk_id": "SOIL_TEXTURE_COASTAL_08",
      "category": "Soil Physics & Geography",
      "tags": ["batinah", "muscat", "sharqiyah", "coastal", "sandy", "salinity_risk"],
      "title": "قوام التربة في المناطق الساحلية (الباطنة، مسقط، الشرقية)",
      "content": "تتميز التربة في المناطق الساحلية بمحافظات شمال وجنوب الباطنة ومسقط وشمال وجنوب الشرقية بقوام رملي إلى رملي طميية. وتتصف بالنفاذية العالية وتزايد مخاطر الملوحة الثانوية نتيجة تداخل مياه البحر أو الري بالمياه المالحة.",
      "metadata": { "source": "دليل قوام التربة بالمحافظات" }
    }
  ]
};

export default omanRAGData;
