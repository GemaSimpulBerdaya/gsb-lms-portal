import connectDB from "../src/lib/mongodb";
import { Relawan } from "../src/models/Relawan";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

async function reset() {
    try {
        await connectDB();
        // Hapus user lama
        await Relawan.deleteOne({ email: "admin@gsb.id" });
        
        // Buat user baru dengan password yang pasti
        const hashedPassword = await bcrypt.hash("password123", 10);
        await Relawan.create({
            email: "admin@gsb.id",
            password: hashedPassword,
            teamName: "Tim Pusat GSB",
            region: "Jakarta",
            role: "ADMIN"
        });
        
        console.log("SUCCESS: User admin@gsb.id berhasil di-reset dengan password: password123");
    } catch (e) {
        console.error("ERROR:", e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

reset();
