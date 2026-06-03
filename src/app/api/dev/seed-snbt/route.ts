import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Module, type IModule } from "@/models/Module";
import { Quiz } from "@/models/Quiz";
import { UserProgress } from "@/models/UserProgress";
import { notFoundInProduction } from "../_utils";

const subjects = [
  {
    name: "Penalaran Matematika",
    modules: [
      {
        title: "Bilangan dan Operasi Dasar",
        description: "Pelajari konsep bilangan bulat, pecahan, desimal, dan operasi dasar matematika untuk SNBT",
        fileUrl: "https://www.youtube.com/embed/d8pGpvLPCWY?rel=0",
      },
      {
        title: "Aljabar dan Persamaan",
        description: "Persamaan linear, kuadrat, sistem persamaan, dan pertidaksamaan",
        fileUrl: "https://www.youtube.com/embed/XB3NlM1WkUs?rel=0",
      },
      {
        title: "Geometri dan Trigonometri",
        description: "Bangun datar, bangun ruang, kesebangunan, dan trigonometri dasar",
        fileUrl: "https://www.youtube.com/embed/_B6O2VhAHUg?rel=0",
      },
      {
        title: "Statistika dan Peluang",
        description: "Mean, median, modus, peluang kejadian, dan kombinasi-permutasi",
        fileUrl: "https://www.youtube.com/embed/sTx8Kn_xJ3c?rel=0",
      },
    ],
  },
  {
    name: "Bahasa Indonesia",
    modules: [
      {
        title: "Ide Pokok dan Simpulan Bacaan",
        description: "Cara menemukan ide pokok, gagasan utama, dan menyimpulkan isi teks bacaan",
        fileUrl: "https://www.youtube.com/embed/rLmWwHL6NWI?rel=0",
      },
      {
        title: "Kalimat Efektif dan Ejaan",
        description: "PUEBI, kalimat efektif, diksi, dan penggunaan tanda baca yang benar",
        fileUrl: "https://www.youtube.com/embed/oJJS7O5CR0A?rel=0",
      },
      {
        title: "Kesesuaian Paragraf dan Wacana",
        description: "Kohesi, koherensi, pola pengembangan paragraf, dan jenis wacana",
        fileUrl: "https://www.youtube.com/embed/tA7_eYpYqbE?rel=0",
      },
    ],
  },
  {
    name: "Bahasa Inggris",
    modules: [
      {
        title: "Reading Comprehension",
        description: "Strategi memahami teks Bahasa Inggris, main idea, inference, dan vocabulary",
        fileUrl: "https://www.youtube.com/embed/d9gO5P_MdZc?rel=0",
      },
      {
        title: "Grammar dan Structure",
        description: "Tenses, subject-verb agreement, conditional sentences, dan relative clauses",
        fileUrl: "https://www.youtube.com/embed/-4lVNMGUeoI?rel=0",
      },
      {
        title: "Vocabulary dan Context Clues",
        description: "Strategi menebak arti kata dari konteks, sinonim, antonim, dan word formation",
        fileUrl: "https://www.youtube.com/embed/3GOkSLB5L2Y?rel=0",
      },
    ],
  },
  {
    name: "Pengetahuan Kuantitatif",
    modules: [
      {
        title: "Logika dan Penalaran Deduktif",
        description: "Silogisme, logika proposisi, dan penarikan kesimpulan logis",
        fileUrl: "https://www.youtube.com/embed/2PQ0JYP5BCw?rel=0",
      },
      {
        title: "Pola Bilangan dan Barisan",
        description: "Pola bilangan, barisan aritmatika, geometri, dan deret tak hingga",
        fileUrl: "https://www.youtube.com/embed/AJQ6nIhA3uE?rel=0",
      },
      {
        title: "Analisis Data dan Grafik",
        description: "Membaca tabel, diagram, grafik, dan interpretasi data statistik",
        fileUrl: "https://www.youtube.com/embed/1A5ZqYvSK_0?rel=0",
      },
    ],
  },
];

function generateQuestions(subjectName: string, moduleTitle: string) {
  const questionBank: Record<string, { question: string; options: string[]; correctAnswer: number; explanation: string }[]> = {
    "Penalaran Matematika": [
      {
        question: "Hasil dari 25 × (36 ÷ 9) + 14 adalah...",
        options: ["104", "114", "124", "134"],
        correctAnswer: 1,
        explanation: "Kerjakan operasi dalam kurung: 36 ÷ 9 = 4. 25 × 4 = 100. 100 + 14 = 114.",
      },
      {
        question: "Sebuah persegi panjang memiliki panjang (x + 3) cm dan lebar (x - 1) cm. Jika luasnya 60 cm², berapakah nilai x?",
        options: ["5", "7", "9", "11"],
        correctAnswer: 1,
        explanation: "Luas = p × l = (x+3)(x-1) = x² + 2x - 3 = 60. x² + 2x - 63 = 0. (x+9)(x-7) = 0. x = 7 (positif).",
      },
      {
        question: "Nilai dari 3! + 4! adalah...",
        options: ["18", "28", "30", "48"],
        correctAnswer: 2,
        explanation: "3! = 6, 4! = 24. 6 + 24 = 30.",
      },
      {
        question: "Dalam suatu kelas, perbandingan jumlah siswa laki-laki dan perempuan adalah 3:5. Jika jumlah seluruh siswa 40 orang, berapa selisih siswa laki-laki dan perempuan?",
        options: ["8", "10", "12", "15"],
        correctAnswer: 1,
        explanation: "Jumlah perbandingan = 8. Laki-laki = 3/8 × 40 = 15. Perempuan = 5/8 × 40 = 25. Selisih = 25 - 15 = 10.",
      },
      {
        question: "Rata-rata nilai ulangan 5 siswa adalah 78. Jika seorang siswa baru bergabung dengan nilai 88, rata-rata menjadi...",
        options: ["79.5", "80", "80.5", "81"],
        correctAnswer: 1,
        explanation: "Total nilai 5 siswa = 5 × 78 = 390. Total nilai 6 siswa = 390 + 88 = 478. Rata-rata baru = 478 ÷ 6 = 79.67 ≈ 80.",
      },
    ],
    "Bahasa Indonesia": [
      {
        question: 'Bacalah kalimat berikut: "Meskipun cuaca sangat buruk, para nelayan tetap melaut untuk mencari nafkah." Kata "meskipun" dalam kalimat tersebut menyatakan hubungan...',
        options: ["Sebab-akibat", "Konsesif", "Syarat", "Tujuan"],
        correctAnswer: 1,
        explanation: "Konjungsi 'meskipun' menyatakan hubungan konsesif (pertentangan/ pengakuan).",
      },
      {
        question: "Penulisan kata depan 'di' yang benar terdapat pada kalimat...",
        options: ["Buku itu diletakkan didalam laci", "Ia bermain di lapangan", "Disini sangat ramai", "Dimana rumahmu?"],
        correctAnswer: 1,
        explanation: "'di lapangan' ditulis terpisah karena menunjukkan tempat. 'di' sebagai kata depan ditulis terpisah, sedangkan 'di' sebagai imbuhan (awalan) ditulis serangkai.",
      },
      {
        question: "Kalimat berikut yang mengandung kata tidak baku adalah...",
        options: ["Kami sedang memproses data tersebut", "Aktivitas belajar mengajar berjalan lancar", "Kita harus mengaktifkan semua sistem", "Praktik baik ini perlu dijadikan contoh"],
        correctAnswer: 2,
        explanation: "Bentuk baku adalah 'mengaktifkan' → 'mengaktifkan' sudah baku. 'Praktek' adalah bentuk tidak baku dari 'praktik'. Semua kata baku.",
      },
      {
        question: "Makna imbuhan 'per-an' pada kata 'perindustrian' adalah...",
        options: ["Hasil", "Tempat", "Hal yang berkaitan dengan", "Proses"],
        correctAnswer: 2,
        explanation: "Imbuhan per-an pada 'perindustrian' menyatakan hal yang berkaitan dengan industri.",
      },
      {
        question: "Bacalah paragraf berikut: (1) Sampah plastik menjadi masalah serius di Indonesia. (2) Banyak sekali sampah plastik berakhir di laut. (3) Hal ini mengancam ekosistem laut. (4) Diperlukan kesadaran masyarakat untuk mengurangi sampah plastik. Kalimat utama paragraf tersebut adalah kalimat nomor...",
        options: ["(1)", "(2)", "(3)", "(4)"],
        correctAnswer: 0,
        explanation: "Kalimat (1) memuat gagasan utama, yaitu sampah plastik sebagai masalah serius. Kalimat (2)-(4) merupakan kalimat penjelas.",
      },
    ],
    "Bahasa Inggris": [
      {
        question: '"The government has implemented several policies to reduce carbon emissions." The word "implemented" is closest in meaning to...',
        options: ["Removed", "Applied", "Delayed", "Cancelled"],
        correctAnswer: 1,
        explanation: "'Implemented' berarti 'diterapkan/dilaksanakan' yang sinonim dengan 'applied'.",
      },
      {
        question: '"If I had studied harder, I would have passed the exam." This sentence implies that...',
        options: ["I studied hard and passed", "I didn't study hard enough", "I will study harder", "I always study hard"],
        correctAnswer: 1,
        explanation: "Kalimat conditional type 3 (past unreal) menunjukkan situasi yang tidak terjadi. Artinya: saya tidak belajar keras jadi tidak lulus.",
      },
      {
        question: "Which sentence is grammatically correct?",
        options: ["She don't like coffee", "She doesn't likes coffee", "She doesn't like coffee", "She not like coffee"],
        correctAnswer: 2,
        explanation: "Subject 'she' (third person singular) menggunakan 'doesn't' + base verb 'like'.",
      },
      {
        question: "The antonym of 'abundant' is...",
        options: ["Plentiful", "Scarce", "Ample", "Sufficient"],
        correctAnswer: 1,
        explanation: "'Abundant' berarti berlimpah. Lawan katanya adalah 'scarce' (langka).",
      },
    ],
    "Pengetahuan Kuantitatif": [
      {
        question: "Jika x + y = 10 dan x - y = 4, maka nilai x × y adalah...",
        options: ["20", "21", "24", "25"],
        correctAnswer: 1,
        explanation: "x + y = 10, x - y = 4. Jumlahkan: 2x = 14, x = 7. Substitusi: 7 + y = 10, y = 3. x × y = 21.",
      },
      {
        question: "Diketahui barisan: 3, 7, 11, 15, ... Suku ke-10 barisan tersebut adalah...",
        options: ["35", "39", "43", "47"],
        correctAnswer: 1,
        explanation: "Barisan aritmatika dengan a = 3, b = 4. Un = a + (n-1)b. U10 = 3 + (9)4 = 3 + 36 = 39.",
      },
      {
        question: "Nilai dari 2⁵ × 2⁻³ adalah...",
        options: ["2", "4", "8", "16"],
        correctAnswer: 1,
        explanation: "2⁵ × 2⁻³ = 2⁵⁻³ = 2² = 4.",
      },
      {
        question: "Jika A = {1, 2, 3, 4} dan B = {3, 4, 5, 6}, maka A ∩ B adalah...",
        options: ["{1, 2, 3, 4, 5, 6}", "{3, 4}", "{1, 2, 5, 6}", "{1, 2, 3, 4}"],
        correctAnswer: 1,
        explanation: "A ∩ B adalah irisan (anggota yang ada di kedua himpunan) = {3, 4}.",
      },
    ],
  };

  const questions = questionBank[subjectName] || [
    { question: "Soal contoh untuk " + moduleTitle, options: ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"], correctAnswer: 0, explanation: "Ini adalah pembahasan contoh." },
  ];

  return questions.map((q) => ({
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
  }));
}

export async function GET() {
  const productionGuard = notFoundInProduction();
  if (productionGuard) return productionGuard;

  try {
    await connectDB();

    // Cek apakah sudah ada data
    const existing = await Module.countDocuments({ programType: "SNBT" });
    if (existing > 0) {
      return NextResponse.json({
        message: `Data sudah ada (${existing} modul). Hapus dulu pakai POST /api/dev/seed-snbt dengan method DELETE`,
        count: existing,
      });
    }

    let order = 0;
    const moduleIds: { subject: string; id: string }[] = [];
    let totalModules = 0;

    for (const subject of subjects) {
      let previousModuleId: string | null = null;

      for (const mod of subject.modules) {
        order++;
        const slug = mod.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-");

        const moduleDoc: IModule = await Module.create({
          title: mod.title,
          slug: `snbt-${slug}`,
          description: mod.description,
          programType: "SNBT",
          fase: "SMA",
          subject: subject.name,
          fileUrl: mod.fileUrl,
          order,
          semester: "2025-1",
          prerequisiteModule: previousModuleId,
        });

        moduleIds.push({ subject: subject.name, id: moduleDoc._id.toString() });
        previousModuleId = moduleDoc._id.toString();
        totalModules++;
      }
    }

    // Buat quiz untuk tiap module
    let quizCount = 0;
    for (const entry of moduleIds) {
      const mod = await Module.findById(entry.id);
      const questions = generateQuestions(mod?.subject || entry.subject, mod?.title || "");

      await Quiz.create({
        moduleId: entry.id,
        questions,
        passingScore: 75,
      });
      quizCount++;
    }

    return NextResponse.json({
      message: `Seed SNBT berhasil!`,
      modules: totalModules,
      quizzes: quizCount,
      subjects: subjects.map((s) => s.name),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal seed data" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const productionGuard = notFoundInProduction();
  if (productionGuard) return productionGuard;

  try {
    await connectDB();
    const modulesDeleted = await Module.deleteMany({ programType: "SNBT" });
    // Dapatkan moduleIds yang terhapus
    const deletedModules = await Module.find({ programType: "SNBT" }).select("_id");
    const deletedIds = deletedModules.map((m) => m._id);
    const quizzesDeleted = await Quiz.deleteMany({ moduleId: { $in: deletedIds } });
    // Reset progress siswa terkait modul SNBT
    await UserProgress.updateMany(
      {},
      { $pull: { completedModules: { $in: deletedIds } } }
    );

    return NextResponse.json({
      message: "Data SNBT berhasil dihapus",
      modulesDeleted: modulesDeleted.deletedCount,
      quizzesDeleted: quizzesDeleted.deletedCount,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal hapus data" },
      { status: 500 }
    );
  }
}
