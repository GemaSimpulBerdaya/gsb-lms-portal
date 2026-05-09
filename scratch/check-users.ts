import mongoose from "mongoose";
import { Relawan } from "../src/models/Relawan";

const uri = "mongodb+srv://gsb:gsb123@gsb-lms.wk8sgsr.mongodb.net/GSB_LMS?appName=gsb-lms";

async function run() {
  try {
    await mongoose.connect(uri);
    const users = await Relawan.find();
    console.log("=== DAFTAR USER DI DATABASE ===");
    users.forEach(u => {
      console.log(`Email: ${u.email}`);
      console.log(`Role:  ${u.role}`);
      console.log(`Nama:  ${u.name || u.teamName || "-"}`);
      console.log("------------------------------");
    });
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

run();
