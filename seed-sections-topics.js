// backend/seed-sections-topics.js
require("dotenv").config();
const mongoose = require("mongoose");

const Section = require("./models/Section");
const Topic   = require("./models/Topic");

const SECTIONS = [
  // -------------------- SAYISAL --------------------
  {
    name: "Natural ədədlər",
    topics: [
      "Natural ədədlər. Natural ədədlərin onluq say sistemində yazılışı",
      "Natural ədədlərin toplanması, çıxılması, vurulması və bölünməsi",
      "Natural ədədlərin bölünmə əlamətləri. Qalıqlı bölmə",
      "Natural ədədlərin sadə vuruqlara ayrılışı. Ən böyük ortaq bölən (ƏBOB).",
      "Ən kiçik ortaq bölünən (ƏKOB)",
    ],
  },
  {
    name: "Adi və onluq kəsrlər",
    topics: [
      "Adi və onluq kəsrlər. Adi və onluq kəsrlərin toplanması, çıxılması, vurulması və bölünməsi",
      "Düzgün və düzgün olmayan kəsrlər. Sonsuz dövrü onluq kəsrlər.",
      "Adi kəsrin onluq kəsrə çevrilməsi. Onluq kəsrin adi kəsrə çevrilməsi",
      "Kəsrlərin müqayisəsi",
      "Ədədin hissəsinin və hissəsinə görə ədədin tapılması",
    ],
  },
  {
    name: "Nisəbət. Tənasüb. Faiz.",
    topics: [
      "Nisəbət. Tənasüb. Tənasübün xassələri. Düz və tərs mütənasiblik",
      "Faiz. Ədədin faizinin tapılması",
      "Faizinə görə ədədin tapılması. İki ədədin faiz nisbəti",
      "Faizə aid məsələlər",
    ],
  },
  {
    name: "Həqiqi ədədlər",
    topics: [
      "Rasional ədədlər. Rasional ədədlər üzərində əməliər",
      "İrrasional ədədlər",
      "Ədədin modulu. Modul daxil olan ifadələrin çevrilməsi",
      "Ədədi orta. Həqiqi ədədlərin müqayisəsi",
      "Ədədin tam və kəsr hissəsi. Ədədin standart şəkli",
    ],
  },
  {
    name: "Tam cəbri ifadələr",
    topics: [
      "Birhədli və onun standart şəkli. Natural üstlü qüvvət",
      "Çoxhədlilər və onlar üzərində əməliər",
      "Müxtəsər vurma düsturları",
      "İfadələrin ədədi qiymətlərinin hesablanması",
      "İfadələrin ən kiçik və ən böyük qiymətlərinin tapılması",
    ],
  },
  {
    name: "Çoxhədlilinin vuruqlara ayrılması",
    topics: [
      "Müxtəsər vurma düsturlarının köməyi ilə vuruqlara ayırma",
      "Müxtəlif üsulların köməyi ilə vuruqlara ayırma",
      "Vuruqlara ayırma üsulu ilə ifadələrin ədədi qiymətinin hesablanması",
    ],
  },
  {
    name: "Rasional kəsrlər",
    topics: [
      "Kəsrlərin ixtisarı. DMQ çoxluğu",
      "İfadələrin sadələşdirilməsi",
      "İfadələrin ədədi qiymətlərinin tapılması",
    ],
  },
  {
    name: "Kvadrat köklər. Həqiqi üstlü qüvvət",
    topics: [
      "Hesabi kvadrat kök və onun xassələri",
      "n-ci dərəcədən kök. Həqiqi üstlü qüvvət və onun xassələri. Ədədlərin müqayisəsi",
      "Kəsrlərin ixtisarı. İfadələrin sadələşdirilməsi və ədədi qiymətinin tapılması",
    ],
  },
  {
    name: "Birməchullu tənliklər və məsələlər",
    topics: [
      "Xətti tənliklər",
      "Kvadrat tənliklər və onların araşdırılması",
      "Viyet teoremi və onun tərsi olan teorem",
      "Rasional tənliklər",
      "Modul işarəsi daxilində dəyişəni olan tənliklər. İrrasional tənliklər",
      "Tənlik qurmaqla məsələlər həlli",
    ],
  },
  {
    name: "Tənliklər sistemi",
    topics: [
      "Xətti tənliklər sistemi",
      "Xətti tənliklər sisteminin həllinin araşdırılması",
      "Biri birdərəcəli, digəri ikidərəcəli və daha yüksək dərəcəli olan tənliklər sistemi",
      "Hər iki tənliyi ikidərəcəli və daha yüksək dərəcəli olan tənliklər sistemi",
      "Tənliklər sistemi qurmaqla məsələlər həlli",
    ],
  },
  {
    name: "Bərabərsizliklər və bərabərsizliklər sistemi",
    topics: [
      "Ədədi bərabərsizliklər və onların əsas xassələri",
      "Birdəyişənli xətti bərabərsizliklər. Birdəyişənli xətti bərabərsizliklər sistemi",
      "İkidərəcəli və yüksək dərəcəli bərabərsizliklər",
      "Rasional bərabərsizliklər",
      "Modul işarəsi daxilində dəyişəni olan bərabərsizliklər",
      "Kvadrat bərabərsizliklər sistemi. İrrasional bərabərsizliklər",
    ],
  },
  {
    name: "Ədədi ardıcıllıqlar. Silsilələr",
    topics: [
      "Ədədi ardıcıllıqlar",
      "Ədədi silsilələr",
      "Həndəsi silsilələr. Sonsuz həndəsi silsilənin cəmi (|q|<1).",
      "Ədədi və həndəsi silsilələrə aid məsələlər",
    ],
  },
  {
    name: "Çoxluqlar",
    topics: [
      "Çoxluqların birləşməsi, kəsişməsi, fərqi",
      "Çoxluqların birləşməsi, kəsişməsi və fərqinin elementlərinin sayı",
    ],
  },

  // -------------------- GEOMETRİ --------------------
  {
    name: "Həndəsənin əsas anlayışları",
    topics: [
      "Düz xətt, şüa, parça. Parçaların ölçülməsi",
      "Bucaq. Bucaqların ölçülməsi. Bucağın tənböləni",
      "Qonşu və qarşılıqlı bucaqlar",
      "İki paralel düz xəttin üçüncü ilə kəsişməsindən alınan bucaqlar",
      "Uyğun tərəfləri paralel və perpendikulyar olan bucaqlar",
    ],
  },
  {
    name: "Üçbucaqlar",
    topics: [
      "Üçbucaq. Üçbucaq bərabərsizliyi. Üçbucağın perimetri",
      "Üçbucağın medianı, tənböləni, hündürlüyü. Medianların və tənbölənlərin xassəsi",
      "Üçbucağın daxili bucaqlarının cəmi. Üçbucağın xarici bucağının xassəsi",
      "Üçbucaqların kongruyentlik əlaməti. Fales teoremi. Üçbucağın orta xətti",
      "Bərabəryanlı üçbucaqlar. Bərabərtərəfli üçbucaqlar",
      "Düzbucaqlı üçbucaq. Pifaqor teoremi. Düzbucaqlı üçbucağın tərəfləri və bucaqları arasındakı münasibətlər",
      "Sinuslar teoremi. Kosinuslar teoremi",
    ],
  },
  {
    name: "Çoxbucaqlılar. Dördbucaqlılar",
    topics: [
      "Qabarıq çoxbucaqlı. Qabarıq çoxbucaqlının daxili və xarici bucaqlarının cəmi. Düzgün çoxbucaqlı",
      "Paraleloqram, onun xassələri və əlamətləri",
      "Düzbucaqlı, kvadrat, romb və onların xassələri",
      "Trapesiya və onun orta xətti",
    ],
  },
  {
    name: "Çevrə və dairə",
    topics: [
      "Çevrə. Dairə. Radius, diametr, vətər. Çevrənin və çevrə qövsünün uzunluğu. Çevrələrin qarşılıqlı vəziyyəti.",
      "Mərkəzi bucaq. Daxilə çəkilmiş bucaq. Toxunanla vətər arasındakı bucaq",
      "Çevrədə mütənasib parçalar. Toxunan və kəsənin xassələri",
      "Çevrənin daxilinə və xaricinə çəkilmiş üçbucaqlar",
      "Çevrənin daxilinı və xaricinə çəkilmiş çoxbucaqlılar",
    ],
  },
];

async function run() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error("❌ MONGO_URI tapılmadı (.env)");
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log("✅ MongoDB bağlantısı quruldu");

    // Tertemiz başla
    await Section.deleteMany({});
    await Topic.deleteMany({});

    let sectionCount = 0;
    let topicCount = 0;

    for (let i = 0; i < SECTIONS.length; i++) {
      const sec = SECTIONS[i];
      const sDoc = await Section.create({
        name: sec.name.trim(),
        order: i + 1,
      });
      sectionCount++;

      for (let j = 0; j < sec.topics.length; j++) {
        const tName = (sec.topics[j] || "").trim();
        if (!tName) continue;
        await Topic.create({
          name: tName,
          sectionId: sDoc._id,
          order: j + 1,
        });
        topicCount++;
      }
    }

    console.log(`🎯 ${sectionCount} bölüm, ${topicCount} konu əlavə olundu`);
  } catch (err) {
    console.error("❌ Xəta:", err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

run();
