{
  "system_info": {
    "project_name": "NASGH Agricultural Diagnostic System",
    "version": "2.5.0-PROD",
    "target_hardware": "NASGH Stick / ESP32 Sensor Array",
    "geographic_scope": "Sultanate of Oman",
    "total_chunks": 15
  },
  "knowledge_base": [
    {
      "chunk_id": "SOIL_MACRO_NUTRIENTS_01",
      "category": "Soil Fertility & Chemistry",
      "subcategory": "Primary Macro-nutrients",
      "title": "مستويات العناصر الكبرى في التربة العُمانية",
      "content": "تعاني غالبية الترب العُمانية من انخفاض حاد في النيتروجين الكلي بتركيز تراوح بين 200 - 800 mg/kg، ونقص شديد في الفوسفور الجاهز بين 3 - 15 mg/kg[cite: 1]. وفي المقابل، يتواجد البوتاسيوم المتاح بمستويات متوسطة تتراوح بين 80 - 300 mg/kg[cite: 1].",
      "metadata": {
        "parameters": {
          "total_nitrogen_range": "200 - 800 mg/kg[cite: 1]",
          "available_phosphorus_range": "3 - 15 mg/kg[cite: 1]",
          "available_potassium_range": "80 - 300 mg/kg[cite: 1]"
        },
        "diagnostic_status": {
          "nitrogen": "Severe Deficit[cite: 1]",
          "phosphorus": "Deficit[cite: 1]",
          "potassium": "Moderate / Adequate[cite: 1]"
        },
        "sensor_mapping": ["N_NPK_Sensor", "P_NPK_Sensor", "K_NPK_Sensor"],
        "confidence_score": 0.98,
        "source": "تقرير الخصائص الكيميائية والمغذيات الرئيسية[cite: 1]"
      }
    },
    {
      "chunk_id": "SOIL_MICRO_NUTRIENTS_CALCIUM_02",
      "category": "Soil Fertility & Chemistry",
      "subcategory": "Secondary & Micro-nutrients",
      "title": "مستويات الكالسيوم والزنك والعنصر الكلسي",
      "content": "تسجل التربة العُمانية ارتفاعاً طبيعياً في الكالسيوم المتبادل بتراكيز بين 2000 - 8000 mg/kg ناتج عن المكون الكلسي المرتفع (CaCO3 بنسبة 10 - 40%)[cite: 1]. وفي المقابل، تسجل التربة نقصاً حاداً في عنصر الزنك المتاح بتراكيز ضئيلة تتراوح بين 0.3 - 2.0 mg/kg[cite: 1].",
      "metadata": {
        "parameters": {
          "exchangeable_calcium": "2000 - 8000 mg/kg[cite: 1]",
          "calcium_carbonate_caco3_pct": "10 - 40%[cite: 1]",
          "available_zinc_range": "0.3 - 2.0 mg/kg[cite: 1]"
        },
        "calcareous_impact": "Inhibition of Micronutrient Uptake[cite: 1, 2]",
        "sensor_mapping": ["Calcium_Ion_Sensor", "Zinc_Ion_Sensor"],
        "confidence_score": 0.95,
        "source": "تقرير الخصائص الكيميائية[cite: 1]"
      }
    },
    {
      "chunk_id": "SOIL_PHYSICOCHEMICAL_INDEX_03",
      "category": "Soil Physics & Electrochemistry",
      "subcategory": "pH, Salinity & Organic Matter",
      "title": "مؤشرات الحموضة والملوحة والمادة العضوية",
      "content": "تسود القلوية على غالبية الترب العُمانية بدرجة حموضة (pH) تتراوح بين 7.5 - 8.5[cite: 1]، مع انخفاض ملحوظ في المادة العضوية بين 0.2 - 1.5%[cite: 1]. بينما تتفاوت الملوحة (EC) تفاوتاً واسعاً من 0.5 إلى أكثر من 8 dS/m حسب القرب من الساحل وطبيعة الموقع[cite: 1].",
      "metadata": {
        "parameters": {
          "ph_range": "7.5 - 8.5[cite: 1]",
          "organic_matter_pct": "0.2 - 1.5%[cite: 1]",
          "ec_range_dsm": "0.5 - >8 dS/m[cite: 1]"
        },
        "soil_classification": "Alkaline / Low Organic / Variable Saline[cite: 1]",
        "sensor_mapping": ["pH_Probe", "EC_Probe"],
        "confidence_score": 0.99,
        "source": "تقرير الخصائص الكيميائية للتربة[cite: 1]"
      }
    },
    {
      "chunk_id": "SOIL_RECOMMENDATIONS_AMENDMENTS_04",
      "category": "Agronomic Action Plans",
      "subcategory": "Soil Amelioration & Fertilization",
      "title": "التوصيات الفنية وإدارة خصوبة التربة العُمانية",
      "content": "لرفع خصوبة التربة يُنصح بانتظام إضافة المادة العضوية والكمبوست أو الفحم الحيوي (Biochar)[cite: 1]، والتركيز على التسميد بالنيتروجين والفوسفور والزنك[cite: 1]. كما يُوصى باستخدام مخلبات العناصر الصغرى بصيغ (EDDHA/EDTA)[cite: 1]، وإدارة الملوحة باستخدام الجبس الزراعي وهيمويك أسيد مع انتظام الري والغسيل الدوري[cite: 1].",
      "metadata": {
        "prescriptions": [
          "إضافة Biochar و Compost لتحسين الاحتفاظ بالمياه والمادة العضوية[cite: 1]",
          "تطبيق مخلبات EDDHA و EDTA لمقاومة الترسيب الكلسي والقلوية[cite: 1]",
          "إضافة الجبس الزراعي والهيوميك أسيد مع الغسيل الدوري لتقليل الملوحة[cite: 1]"
        ],
        "target_deficiencies": ["Nitrogen", "Phosphorus", "Zinc"],
        "ai_recommendation_trigger": "High pH (>7.5) AND Low OM (<1.0%)[cite: 1]",
        "confidence_score": 0.97,
        "source": "تقرير الإدارة والحلول الزراعية[cite: 1]"
      }
    },
    {
      "chunk_id": "GEOLOGY_HEAVY_METALS_BASELINE_05",
      "category": "Geology & Heavy Metals",
      "subcategory": "Natural Background Levels",
      "title": "خلفية المعادن الثقيلة الطبيعية في التربة",
      "content": "تتوزع التراكيز الكلية الطبيعية للمعادن الثقيلة في الترب العُمانية ضمن حدود الخلفية الجيولوجية؛ حيث يسجل النيكل 20 - 200 mg/kg[cite: 2]، والكروم 50 - 300 mg/kg[cite: 2]، بينما تشكل نسبة الحديد الكلي 1 - 5% وزناً[cite: 2].",
      "metadata": {
        "baseline_concentrations": {
          "nickel_ni": "20 - 200 mg/kg[cite: 2]",
          "chromium_cr": "50 - 300 mg/kg[cite: 2]",
          "iron_fe_pct": "1 - 5% wt[cite: 2]"
        },
        "environmental_status": "Natural Non-Polluted Background[cite: 2]",
        "confidence_score": 0.96,
        "source": "تقرير خلفية العناصر الثقيلة والخصائص الجيولوجية[cite: 2]"
      }
    },
    {
      "chunk_id": "GEOLOGY_OPHIOLITE_ANOMALIES_06",
      "category": "Geology & Heavy Metals",
      "subcategory": "Ophiolite Complex Impact",
      "title": "تأثير صخور الأفيولايت والارتفاع الجيولوجي الطبيعي",
      "content": "تشهد المناطق المرتبطة بسلاسل صخور الأفيولايت ارتفاعاً طبيعياً في تراكيز النيكل (200 - 2000 mg/kg)[cite: 2]، الكروم (300 - 3000 mg/kg)[cite: 2]، والكوبالت (20 - 200 mg/kg)[cite: 2]. ويُعد هذا الارتفاع ظاهرة جيولوجية طبيعية أصلية ولا يُعزى لأي تلوث بشري[cite: 2].",
      "metadata": {
        "ophiolite_concentrations": {
          "nickel_ni": "200 - 2000 mg/kg[cite: 2]",
          "chromium_cr": "300 - 3000 mg/kg[cite: 2]",
          "cobalt_co": "20 - 200 mg/kg[cite: 2]"
        },
        "origin": "Geogenic / Lithogenic (Ophiolite Rock Weathering)[cite: 2]",
        "contamination_flag": false,
        "confidence_score": 0.99,
        "source": "دليل الجيولوجيا وتأثير صخور الأفيولايت[cite: 2]"
      }
    },
    {
      "chunk_id": "GEOLOGY_BIOAVAILABILITY_METHODS_07",
      "category": "Geology & Analytical Chemistry",
      "subcategory": "Bioavailability & Extraction Standards",
      "title": "الإتاحة الحيوية وطرق استخلاص المعادن",
      "content": "تساهم القلوية المرتفعة (pH 7.5 - 8.5) ووجود كربونات الكالسيوم بسببت تثبيت المعادن في تقليل الإتاحة النباتية والسمية الحيوية للنيكل والكروم[cite: 2]. ولتقييم الجزء المتاح فعلياً للنبات، يُوصى باستخدام أساليب استخلاص محددة مثل DTPA أو Mehlich-3[cite: 2].",
      "metadata": {
        "influencing_factors": ["High pH[cite: 2]", "High CaCO3[cite: 2]"],
        "recommended_extraction_methods": ["DTPA Extraction[cite: 2]", "Mehlich-3 Extraction[cite: 2]"],
        "toxicity_risk": "Low (Due to immobilization by alkalinity)[cite: 2]",
        "confidence_score": 0.94,
        "source": "تقرير الإتاحة الحيوية والتقييم المعملي[cite: 2]"
      }
    },
    {
      "chunk_id": "SOIL_TEXTURE_COASTAL_08",
      "category": "Soil Physics & Geography",
      "subcategory": "Coastal Governorates",
      "title": "قوام التربة في المناطق الساحلية (الباطنة، مسقط، الشرقية)",
      "content": "تتميز التربة في المناطق الساحلية بمحافظات شمال وجنوب الباطنة ومسقط وشمال وجنوب الشرقية بقوام رملي إلى رملي طميية[cite: 4]. وتتصف بالنفاذية العالية وتزايد مخاطر الملوحة الثانوية نتيجة تداخل مياه البحر أو الري بالمياه المالحة[cite: 4].",
      "metadata": {
        "governorates": ["Batinah North", "Batinah South", "Muscat", "Sharqiyah North", "Sharqiyah South"],
        "texture_class": "Sandy to Loamy Sand[cite: 4]",
        "permeability": "High[cite: 4]",
        "salinity_risk": "High (Secondary Salinization)[cite: 4]",
        "confidence_score": 0.97,
        "source": "دليل قوام التربة بالمحافظات[cite: 4]"
      }
    },
    {
      "chunk_id": "SOIL_TEXTURE_INTERIOR_VALLEYS_09",
      "category": "Soil Physics & Geography",
      "subcategory": "Wadi & Interior Agricultural Lands",
      "title": "قوام التربة في الأودية والمزارع الداخلية",
      "content": "تسود في الأودية والمزارع الداخلية (مثل المحافظات الداخلية والظاهرة) تربة طميية رملية وغرينية[cite: 4]. تتميز هذه الترب بدرجة خصوبة وسعة احتفاظ بالرطوبة أفضل نسبياً مع تصريف متوازن يناسب الزراعة[cite: 4].",
      "metadata": {
        "governorates": ["Ad Dakhiliyah", "Ad Dhahirah"],
        "texture_class": "Sandy Loam & Silty[cite: 4]",
        "drainage": "Moderate / Balanced[cite: 4]",
        "agricultural_suitability": "High[cite: 4]",
        "confidence_score": 0.96,
        "source": "دليل قوام التربة بالمحافظات[cite: 4]"
      }
    },
    {
      "chunk_id": "SOIL_TEXTURE_MOUNTAIN_10",
      "category": "Soil Physics & Geography",
      "subcategory": "Mountainous Ecosystems",
      "title": "قوام التربة في المناطق الجبلية (مسندم، الجبل الأخضر، سلاسل الجبال)",
      "content": "تتكون التربة في المناطق الجبلية بمحافظة مسندم، الجبل الأخضر، وسلاسل جبال مسقط والداخلية من تربة حصوية وصخرية ضحلة[cite: 4]. تتسم هذه الترب بعمق تجذيري محدود وتستند فوق طبقات من الصخور الجيرية[cite: 4].",
      "metadata": {
        "regions": ["Musandam", "Jebel Akhdar", "Muscat Mountains", "Dakhiliyah Mountains"],
        "texture_class": "Gravelly / Shallow Rocky[cite: 4]",
        "bedrock": "Limestone[cite: 4]",
        "rooting_depth_limitation": true,
        "confidence_score": 0.95,
        "source": "دليل قوام التربة بالمحافظات[cite: 4]"
      }
    },
    {
      "chunk_id": "SOIL_TEXTURE_DESERT_11",
      "category": "Soil Physics & Geography",
      "subcategory": "Arid & Desert Zones",
      "title": "قوام التربة في المناطق الصحراوية (الوسطى، نجد، الظاهرة الصحراوية)",
      "content": "تتصف المناطق الصحراوية في محافظة الوسطى، أراضي نجد، والمناطق الممتدة من الظاهرة بتربة رملية وحصوية فقيرة جداً بالمادة العضوية[cite: 4]. تمتاز بمعدلات صرف مرتفعة للغاية وضعف الشحنات الكهرومغناطيسية لتربيتها[cite: 4].",
      "metadata": {
        "regions": ["Al Wusta", "Najd Desert", "Dhahirah Arid Zones"],
        "texture_class": "Sandy & Coarse Gravelly[cite: 4]",
        "drainage": "Extremely High[cite: 4]",
        "organic_matter_status": "Ultra-Low[cite: 4]",
        "confidence_score": 0.98,
        "source": "دليل قوام التربة بالمحافظات[cite: 4]"
      }
    },
    {
      "chunk_id": "SOIL_TEXTURE_SALALAH_PLAIN_12",
      "category": "Soil Physics & Geography",
      "subcategory": "Southern Fertile Plains",
      "title": "قوام التربة في سهل صلالة (محافظة ظفار)",
      "content": "تمتاز تربة سهل صلالة بمحافظة ظفار بقوام طيني غريني عالي الخصوبة[cite: 4]. وتُعتبر من أجود أنواع الترب في السلطنة لقدرتها المرتفعة على الاحتفاظ بالماء والمغذيات وملاءمتها للزراعات الاستوائية والمحاصيل المختلفة[cite: 4].",
      "metadata": {
        "region": "Salalah Plain (Dhofar Governorate)",
        "texture_class": "Silty Clay[cite: 4]",
        "fertility_rating": "Very High[cite: 4]",
        "water_retention": "High[cite: 4]",
        "confidence_score": 0.99,
        "source": "دليل قوام التربة بالمحافظات[cite: 4]"
      }
    },
    {
      "chunk_id": "FLORA_FORAGE_SPECIES_13",
      "category": "Wild Flora & Botany",
      "subcategory": "High-Value Pasture Plants",
      "title": "التنوع النباتي والأشجار والنباتات الرعوية البرية",
      "content": "تزخر البيئة العُمانية بعائلات نباتية متنوعة مثل الأقنثيات، القطيفية، الدفليات، النجمية، الفولية، والبخوريات[cite: 3]. وتبرز أنواع رعوية عالية القيمة الغذائية للإبل والمواشي ومنها: شجر الغاف (Prosopis cineraria)[cite: 3, 4]، السلم (Acacia ehrenbergiana)[cite: 3]، الخوشيان (Diplotaxis harra)[cite: 3]، والرمث (Hammada salicornica)[cite: 3].",
      "metadata": {
        "forage_species": [
          {"local_name": "الغاف", "scientific_name": "Prosopis cineraria", "value": "High Forage & Shade[cite: 3, 4]"},
          {"local_name": "السلم", "scientific_name": "Acacia ehrenbergiana", "value": "High Pastoral Value[cite: 3]"},
          {"local_name": "الخوشيان", "scientific_name": "Diplotaxis harra", "value": "Nutritious Pasture[cite: 3]"},
          {"local_name": "الرمث", "scientific_name": "Hammada salicornica", "value": "Camel Feed[cite: 3]"}
        ],
        "confidence_score": 0.97,
        "source": "دليل التنوع النباتي والنباتات البرية[cite: 3, 4]"
      }
    },
    {
      "chunk_id": "FLORA_TOXIC_NON_FORAGE_14",
      "category": "Wild Flora & Botany",
      "subcategory": "Toxic & Non-Edible Plants",
      "title": "النباتات البرية السامة وغير الرعوية",
      "content": "تتضمن البيئة المحلية بعض النباتات السامة وغير الصالحة لرعي المواشي والإبل، ومن أبرزها: الأشخر (Calotropis procera)[cite: 3]، الحرمل (Rhazya stricta)[cite: 3]، الحنظل (Citrullus colocynthis)[cite: 3]، والعدن (Adenium obesum)[cite: 3].",
      "metadata": {
        "toxic_species": [
          {"local_name": "الأشخر", "scientific_name": "Calotropis procera", "toxicity": "High Toxic Latex[cite: 3]"},
          {"local_name": "الحرمل", "scientific_name": "Rhazya stricta", "toxicity": "Alkaloid Toxicity[cite: 3]"},
          {"local_name": "الحنظل", "scientific_name": "Citrullus colocynthis", "toxicity": "Severe Gastrointestinal Irritant[cite: 3]"},
          {"local_name": "العدن", "scientific_name": "Adenium obesum", "toxicity": "Cardiac Glycosides[cite: 3]"}
        ],
        "grazing_safety_flag": "DO_NOT_GRAZE",
        "confidence_score": 0.98,
        "source": "دليل النباتات البرية[cite: 3]"
      }
    },
    {
      "chunk_id": "FLORA_ETHNOBOTANY_MEDICINAL_15",
      "category": "Ethnobotany & Traditional Uses",
      "subcategory": "Medicinal & Industrial Applications",
      "title": "الاستخدامات الطبية والشعبية للنباتات البرية العُمانية",
      "content": "تُستغل العديد من النباتات البرية في الموروث الشعبي والطبي المحالي، مثل أشجار اللبان (Boswellia sacra)، الصبر، الخروع، واللصف[cite: 3]. تُستخدم هذه النباتات في معالجة الجروح، اضطرابات الجهاز الهضمي، والأمراض الجلدية، فضلاً عن استخداماتها في صناعات الدباغة والتطوير الزراعي[cite: 3].",
      "metadata": {
        "medicinal_plants": [
          {"name": "اللبان", "scientific_name": "Boswellia sacra", "use": "Resin / Anti-inflammatory[cite: 3]"},
          {"name": "الصبر", "scientific_name": "Aloe vera / Aloe spp.", "use": "Skin & Digestive Treatment[cite: 3]"},
          {"name": "الخروع", "scientific_name": "Ricinus communis", "use": "Traditional Medicinal Oil[cite: 3]"},
          {"name": "اللصف", "scientific_name": "Capparis spinosa", "use": "Joint & Gastrointestinal Uses[cite: 3]"}
        ],
        "industrial_applications": ["Tanning", "Agricultural Development", "Traditional Extracts[cite: 3]"],
        "confidence_score": 0.96,
        "source": "دليل الموروث النباتي والاستخدامات الشعبية[cite: 3]"
      }
    }
  ]
}
