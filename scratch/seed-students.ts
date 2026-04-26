export {};
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGODB_LMS_URI = process.env.MONGODB_LMS_URI;

// Import models using require
// We need to point to the actual files
const { AnakDidik } = require("../src/models/Relawan");
const { UserProgress } = require("../src/models/SMA");

if (!MONGODB_LMS_URI) {
  console.error("❌ MONGODB_LMS_URI tidak ditemukan di .env.local");
  process.exit(1);
}

const dummyAnakDidik = [
  { name: "Ahmad Fauzi", region: "Jakarta Selatan", category: "SD", parentName: "Bpk. Ridwan" },
  { name: "Siti Aminah", region: "Jakarta Selatan", category: "TK", parentName: "Ibu Fatimah" },
  { name: "Budi Santoso", region: "Depok", category: "SMP", parentName: "Bpk. Joko" },
  { name: "Lestari Putri", region: "Depok", category: "SD", parentName: "Ibu Ratna" },
  { name: "Rizky Ramadhan", region: "Bekasi", category: "SMP", parentName: "Bpk. Andi" },
  { name: "Dewi Sartika", region: "Bekasi", category: "SD", parentName: "Ibu Sari" },
  { name: "Fikri Haikal", region: "Jakarta Timur", category: "SD", parentName: "Bpk. Yusuf" },
  { name: "Nabila Syakieb", region: "Jakarta Timur", category: "TK", parentName: "Ibu Linda" },
  { name: "Guntur Pratama", region: "Tangerang", category: "SMP", parentName: "Bpk. Bambang" },
  { name: "Indah Permata", region: "Tangerang", category: "SD", parentName: "Ibu Mega" },
  { name: "Zidan Alfarisi", region: "Jakarta Selatan", category: "DISABILITAS", parentName: "Bpk. Lukman" },
  { name: "Maya Sofia", region: "Depok", category: "DISABILITAS", parentName: "Ibu Hana" }
];

const dummySiswaSMA = [
  { externalUserId: "STUDENT-SMA-001", completedModules: [], quizScores: [] },
  { externalUserId: "STUDENT-SMA-002", completedModules: [], quizScores: [] },
  { externalUserId: "STUDENT-SMA-003", completedModules: [], quizScores: [] }
];

async function seed() {
  try {
    console.log("⏳ Menghubungkan ke MongoDB...");
    await mongoose.connect(MONGODB_LMS_URI!);
    console.log("✅ Terhubung ke database.");

    // Clear existing data (optional, but good for clean seed)
    // console.log("🧹 Membersihkan data lama...");
    // await AnakDidik.deleteMany({});
    // await UserProgress.deleteMany({});

    console.log("🌱 Memasukkan data AnakDidik...");
    await AnakDidik.insertMany(dummyAnakDidik);
    
    console.log("🌱 Memasukkan data Progres Siswa SMA...");
    await UserProgress.insertMany(dummySiswaSMA);

    console.log("✨ Seed data berhasil diselesaikan!");
  } catch (error) {
    console.error("❌ Gagal melakukan seed data:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Koneksi database diputus.");
  }
}

seed();
