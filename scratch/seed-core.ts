export {};
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGODB_LMS_URI = process.env.MONGODB_LMS_URI;

// Import models
const { Relawan } = require("../src/models/Relawan");
const { Module } = require("../src/models/Core");

if (!MONGODB_LMS_URI) {
  console.error("❌ MONGODB_LMS_URI tidak ditemukan");
  process.exit(1);
}

async function seed() {
  try {
    console.log("⏳ Menghubungkan ke MongoDB...");
    await mongoose.connect(MONGODB_LMS_URI);
    console.log("✅ Terhubung.");

    // 1. Seed Relawan
    console.log("🌱 Memasukkan data Relawan...");
    const hashedPassword = await bcrypt.hash("password123", 10);
    
    const dummyRelawan = [
      { email: "admin@gsb.id", password: hashedPassword, teamName: "Team Pusat", region: "Jakarta", role: "ADMIN" },
      { email: "relawan1@gsb.id", password: hashedPassword, teamName: "Team Merdeka", region: "Jakarta Selatan", role: "RELAWAN" },
      { email: "relawan2@gsb.id", password: hashedPassword, teamName: "Team Berdaya", region: "Depok", role: "RELAWAN" },
      { email: "relawan3@gsb.id", password: hashedPassword, teamName: "Team Juara", region: "Bekasi", role: "RELAWAN" }
    ];

    await Relawan.deleteMany({ email: { $in: dummyRelawan.map(r => r.email) } });
    await Relawan.insertMany(dummyRelawan);

    // 2. Seed Modules
    console.log("🌱 Memasukkan data Modul...");
    const dummyModules = [
      // Offline Modules (untuk Relawan)
      { title: "Matematika Dasar SD - Minggu 1", slug: "mtk-sd-w1", description: "Pengenalan angka dan penjumlahan", category: "OFFLINE", subCategory: "SD", week: 1, order: 1 },
      { title: "Bahasa Indonesia SD - Minggu 1", slug: "bi-sd-w1", description: "Membaca lancar", category: "OFFLINE", subCategory: "SD", week: 1, order: 2 },
      { title: "Sains Menyenangkan SMP - Minggu 1", slug: "sains-smp-w1", description: "Eksperimen air", category: "OFFLINE", subCategory: "SMP", week: 1, order: 1 },
      { title: "Etika & Karakter - Disabilitas", slug: "etika-disabilitas", description: "Pembangunan karakter diri", category: "OFFLINE", subCategory: "DISABILITAS", week: 1, order: 1 },
      
      // SNBT Modules (untuk Siswa SMA)
      { title: "Penalaran Matematika (SNBT)", slug: "snbt-mtk-1", description: "Logika matematika dasar", category: "SNBT", subCategory: "Matematika", order: 1 },
      { title: "Pemahaman Bacaan (SNBT)", slug: "snbt-indo-1", description: "Teknik membaca cepat", category: "SNBT", subCategory: "Bahasa Indonesia", order: 1 },
      { title: "Bahasa Inggris (SNBT)", slug: "snbt-ing-1", description: "Structure and Written Expression", category: "SNBT", subCategory: "Bahasa Inggris", order: 1 }
    ];

    await Module.deleteMany({ slug: { $in: dummyModules.map(m => m.slug) } });
    await Module.insertMany(dummyModules);

    console.log("✨ Seed Relawan & Modul berhasil!");
  } catch (error) {
    console.error("❌ Gagal:", error);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
