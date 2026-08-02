import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { TeamAccount } from "@/models/TeamAccount";
import Student from "@/models/Student";
import { Schedule } from "@/models/Schedule";
import { notFoundInProduction } from "../_utils";

export async function POST() {
  const productionGuard = notFoundInProduction();
  if (productionGuard) return productionGuard;

  try {
    await connectDB();

    // 1. Ambil relawan utama untuk dihubungkan ke jadwal
    const relawan = await TeamAccount.findOne({ email: "admin@gsb.com" });
    if (!relawan) {
      return NextResponse.json({ error: "User admin@gsb.com tidak ditemukan. Silakan register dulu." }, { status: 400 });
    }

    // 2. Buat Jadwal Mengajar untuk Relawan
    await Schedule.findOneAndUpdate(
      { teamAccountId: relawan._id },
      {
        teamAccountId: relawan._id,
        region: "Offline Depok",
        fase: "FASE A",
        activeWeek: 3
      },
      { upsert: true }
    );

    // 3. Buat Data Murid Dummy
    const dummyStudents = [
      { name: "Budi Santoso", region: "Offline Depok", fase: "FASE A", parentName: "Bpk. Santoso" },
      { name: "Siti Aminah", region: "Offline Depok", fase: "FASE B", parentName: "Ibu Aminah" },
      { name: "Andi Wijaya", region: "Offline Depok", fase: "FASE C", parentName: "Bpk. Wijaya" },
      { name: "Rina Pratama", region: "Offline Sasak Panjang", fase: "FASE D", parentName: "Ibu Rina" },
      { name: "Dedi Kurniawan", region: "Offline Sasak Panjang", fase: "FASE D", parentName: "Bpk. Kurniawan" },
      { name: "Lani Cahaya", region: "Online Reguler", fase: "FASE E", parentName: "Ibu Lani" },
      { name: "Fajar Ramadhan", region: "Offline Depok", fase: "FASE PELITA", parentName: "Bpk. Fajar" },
      { name: "Gita Lestari", region: "Online Reguler", fase: "FASE A", parentName: "Ibu Gita" },
      { name: "Hendra Saputra", region: "Online Reguler", fase: "FASE B", parentName: "Bpk. Hendra" },
      { name: "Indah Permata", region: "Offline Sasak Panjang", fase: "FASE C", parentName: "Ibu Indah" },
    ];

    await Student.deleteMany({
      $or: [
        { region: { $in: ["Jakarta", "Bandung", "Surabaya"] } },
        { name: { $in: dummyStudents.map((s) => s.name) } },
      ],
    });
    const createdStudents = await Student.insertMany(dummyStudents);

    // 4. Buat Modul Dummy
    const { Module } = await import("@/models/Module");
    await Module.deleteMany({});
    const dummyModules = [
      { title: "Mengenal Angka", slug: "mengenal-angka", programType: "OFFLINE", learningLocation: "Offline Depok", fase: "FASE TUNAS & PUCUK", subject: "Mengenal Angka", week: 1, description: "Belajar dasar matematika" },
      { title: "Membaca Lancar", slug: "membaca-lancar", programType: "OFFLINE", learningLocation: "Offline Depok", fase: "FASE B", subject: "Membaca", week: 2, description: "Belajar literasi dasar" },
      { title: "Literasi Sains Dasar", slug: "literasi-sains-dasar", programType: "OFFLINE", learningLocation: "Offline Sasak Panjang", fase: "FASE C", subject: "Literasi Sains", week: 3, description: "Pengenalan lingkungan dan sains sederhana" },
      { title: "Literasi Numerasi", slug: "literasi-numerasi", programType: "OFFLINE", learningLocation: "Online Reguler", fase: "FASE A", subject: "Literasi Numerasi", week: 4, description: "Latihan numerasi untuk kelas reguler online" },

    ];
    const createdModules = await Module.insertMany(dummyModules);

    // 5. Buat Laporan Dummy
    const { Report } = await import("@/models/Report");
    await Report.deleteMany({ teamAccountId: relawan._id });
    await Report.create([
      { teamAccountId: relawan._id, title: "Kunjungan Minggu 1", description: "Anak-anak sangat antusias belajar angka.", date: new Date(Date.now() - 14 * 86400000), location: "Offline Depok", region: "Offline Depok", fase: "FASE A" },
      { teamAccountId: relawan._id, title: "Kunjungan Minggu 2", description: "Fokus pada kelancaran membaca.", date: new Date(Date.now() - 7 * 86400000), location: "Offline Depok", region: "Offline Depok", fase: "FASE A" },
    ]);

    // 6. Buat Nilai Dummy (Evaluasi)
    const { NilaiOffline } = await import("@/models/NilaiOffline");
    await NilaiOffline.deleteMany({ teamAccountId: relawan._id });
    await NilaiOffline.create([
      { studentId: createdStudents[0]._id, teamAccountId: relawan._id, moduleId: createdModules[0]._id, type: "TUGAS", week: 1, score: 85, semester: "2026-Genap", notes: "Bagus sekali" },
      { studentId: createdStudents[1]._id, teamAccountId: relawan._id, moduleId: createdModules[0]._id, type: "TUGAS", week: 1, score: 78, semester: "2026-Genap", notes: "Perlu latihan lagi" },
      { studentId: createdStudents[0]._id, teamAccountId: relawan._id, moduleId: createdModules[1]._id, type: "TUGAS", week: 2, score: 90, semester: "2026-Genap", notes: "Luar biasa" },
    ]);


    return NextResponse.json({ 
      message: "Seluruh data dummy berhasil dibuat!",
      details: {
        schedule: "Offline Depok - FASE A (Week 3)",
        students: createdStudents.length,
        modules: createdModules.length,
        reports: 2,
        evaluations: 3
      }
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}
