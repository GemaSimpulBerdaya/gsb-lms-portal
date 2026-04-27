import connectDB from "../src/lib/mongodb";
import mongoose from "mongoose";

async function check() {
    try {
        await connectDB();
        console.log("Connected to DB:", mongoose.connection.name);
        const collections = await mongoose.connection.db!.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name));
        
        const relawans = await mongoose.connection.db!.collection("relawan").find({}).toArray();
        console.log("Users in 'relawans' collection:", relawans.length);
        if (relawans.length > 0) {
            console.log("Sample user email:", relawans[0].email);
        }
    } catch (e) {
        console.error("Error during check:", e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

check();
