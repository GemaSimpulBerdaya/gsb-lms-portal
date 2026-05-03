import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { Relawan, AnakDidik } from "@/models/Relawan";

const MONGODB_URI = process.env.MONGODB_LMS_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_LMS_URI environment variable");
}

export async function GET(request: Request) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI as string);
    }

    const { Settings } = await import("@/models/Settings");
    const { Schedule } = await import("@/models/Schedule");
    const { Module } = await import("@/models/Core");
    
    const { searchParams } = new URL(request.url);
    const querySem = searchParams.get("semester");

    // Get active semester for filtering schedules
    const activeSemesterSetting = await Settings.findOne({ key: "activeSemester" });
    const activeSem = querySem || activeSemesterSetting?.value || "2025-1";

    const totalVolunteers = await Relawan.countDocuments({ role: "RELAWAN" });
    const totalStudents = await AnakDidik.countDocuments();
    const totalSchedules = await Schedule.countDocuments({ semester: activeSem });
    const totalModules = await Module.countDocuments({ semester: activeSem }); 

    const { Report } = await import("@/models/Report");
    
    // Get last 6 months reports trend
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthLabel = d.toLocaleString('id-ID', { month: 'short' });
      const year = d.getFullYear();
      const month = d.getMonth();
      
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      
      const count = await Report.countDocuments({
        date: { $gte: start, $lte: end }
      });
      
      last6Months.push({ name: monthLabel, value: count });
    }

    return NextResponse.json({
      stats: {
        totalVolunteers,
        totalStudents,
        totalSchedules,
        totalModules,
        reportTrend: last6Months
      }
    });

  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data" }, { status: 500 });
  }
}
