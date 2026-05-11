import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";
import AnakDidik from "@/models/AnakDidik";
import { Schedule } from "@/models/Schedule";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    // 1. Ambil relawan utama untuk dihubungkan ke jadwal
    const relawan = await Relawan.findOne({ email: "admin@gsb.id" });
    if (!relawan) {
      return NextResponse.json({ error: "User admin@gsb.id tidak ditemukan. Silakan register dulu." }, { status: 400 });
    }

    // 2. Buat Jadwal Mengajar untuk Relawan
    await Schedule.findOneAndUpdate(
      { relawanId: relawan._id },
      {
        relawanId: relawan._id,
        region: "Jakarta",
        level: "SD",
        activeWeek: 3
      },
      { upsert: true }
    );

    // 3. Buat Data Murid Dummy
    const dummyStudents = [
      { name: "Budi Santoso", region: "Jakarta", category: "SD", parentName: "Bpk. Santoso" },
      { name: "Siti Aminah", region: "Jakarta", category: "SD", parentName: "Ibu Aminah" },
      { name: "Andi Wijaya", region: "Jakarta", category: "SD", parentName: "Bpk. Wijaya" },
      { name: "Rina Pratama", region: "Bandung", category: "SMP", parentName: "Ibu Rina" },
      { name: "Dedi Kurniawan", region: "Bandung", category: "SMP", parentName: "Bpk. Kurniawan" },
      { name: "Lani Cahaya", region: "Surabaya", category: "TK", parentName: "Ibu Lani" },
      { name: "Fajar Ramadhan", region: "Jakarta", category: "DISABILITAS", parentName: "Bpk. Fajar" },
      { name: "Gita Lestari", region: "Jakarta", category: "SD", parentName: "Ibu Gita" },
      { name: "Hendra Saputra", region: "Jakarta", category: "SD", parentName: "Bpk. Hendra" },
      { name: "Indah Permata", region: "Jakarta", category: "SD", parentName: "Ibu Indah" },
    ];

    await AnakDidik.deleteMany({ region: { $in: ["Jakarta", "Bandung", "Surabaya"] } });
    const createdStudents = await AnakDidik.insertMany(dummyStudents);

    // 4. Buat Modul Dummy
    const { Module } = await import("@/models/Core");
    await Module.deleteMany({});
    const dummyModules = [
      { title: "Mengenal Angka", slug: "mengenal-angka", category: "OFFLINE", subCategory: "SD", week: 1, description: "Belajar dasar matematika" },
      { title: "Membaca Lancar", slug: "membaca-lancar", category: "OFFLINE", subCategory: "SD", week: 2, description: "Belajar literasi dasar" },
      { title: "Etika & Sopan Santun", slug: "etika-sopan-santun", category: "OFFLINE", subCategory: "SD", week: 3, description: "Pembentukan karakter" },
      { title: "Alam Sekitar", slug: "alam-sekitar", category: "OFFLINE", subCategory: "SD", week: 4, description: "Pengenalan lingkungan" },
      // Modul SNBT (Online)
      { title: "Kalkulus Dasar", slug: "kalkulus-dasar", category: "SNBT", subCategory: "Matematika", order: 1, description: "Materi limit dan turunan" },
      { title: "Grammar Master", slug: "grammar-master", category: "SNBT", subCategory: "Bahasa Inggris", order: 1, description: "Tenses and Structure" },
      { title: "Pemahaman Bacaan", slug: "pemahaman-bacaan", category: "SNBT", subCategory: "Bahasa Indonesia", order: 1, description: "Teknik membaca cepat" },
    ];
    const createdModules = await Module.insertMany(dummyModules);

    // 5. Buat Laporan Dummy
    const { Report } = await import("@/models/Report");
    await Report.deleteMany({ relawanId: relawan._id });
    await Report.create([
      { relawanId: relawan._id, title: "Kunjungan Minggu 1", description: "Anak-anak sangat antusias belajar angka.", date: new Date(Date.now() - 14 * 86400000), location: "Jakarta" },
      { relawanId: relawan._id, title: "Kunjungan Minggu 2", description: "Fokus pada kelancaran membaca.", date: new Date(Date.now() - 7 * 86400000), location: "Jakarta" },
    ]);

    // 6. Buat Nilai Dummy (Evaluasi)
    const { NilaiOffline } = await import("@/models/Relawan");
    await NilaiOffline.deleteMany({ relawanId: relawan._id });
    await NilaiOffline.create([
      { anakDidikId: createdStudents[0]._id, relawanId: relawan._id, moduleId: createdModules[0]._id, type: "TUGAS", week: 1, score: 85, semester: "2026-Genap", notes: "Bagus sekali" },
      { anakDidikId: createdStudents[1]._id, relawanId: relawan._id, moduleId: createdModules[0]._id, type: "TUGAS", week: 1, score: 78, semester: "2026-Genap", notes: "Perlu latihan lagi" },
      { anakDidikId: createdStudents[0]._id, relawanId: relawan._id, moduleId: createdModules[1]._id, type: "KUIS", week: 2, score: 90, semester: "2026-Genap", notes: "Luar biasa" },
    ]);

    // 7. Buat Kuis Dummy (SMA)
    const { Quiz } = await import("@/models/SMA");
    await Quiz.deleteMany({});
    await Quiz.create({
      moduleId: createdModules[4]._id, // Kalkulus Dasar
      passingScore: 70,
      questions: [
        {
          question: "Berapakah turunan dari f(x) = x^2?",
          options: ["x", "2x", "x^3", "2"],
          correctAnswer: 1 // 2x
        },
        {
          question: "Limit x mendekati 0 dari sin(x)/x adalah...",
          options: ["0", "Infinity", "1", "-1"],
          correctAnswer: 2 // 1
        }
      ]
    });

    return NextResponse.json({ 
      message: "Seluruh data dummy berhasil dibuat!",
      details: {
        schedule: "Jakarta - SD (Week 3)",
        students: createdStudents.length,
        modules: createdModules.length,
        reports: 2,
        evaluations: 3
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
