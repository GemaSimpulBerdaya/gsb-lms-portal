import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withAdmin } from "@/lib/apiAuth";
import { Schedule } from "@/models/Schedule";

export const GET = withAdmin(async () => {
  await connectDB();

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7);

    // Cari schedule yang memiliki kbmDates antara hari ini dan 7 hari ke depan
    const schedules = await Schedule.aggregate([
      { $unwind: "$kbmDates" },
      { 
        $match: { 
          "kbmDates.date": { $gte: today, $lte: endOfWeek } 
        } 
      },
      { $sort: { "kbmDates.date": 1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "volunteers",
          localField: "kbmDates.petugas",
          foreignField: "_id",
          as: "petugasDetails"
        }
      },
      {
        $project: {
          _id: 1,
          region: 1,
          fase: 1,
          date: "$kbmDates.date",
          meetingType: "$kbmDates.meetingType",
          topic: "$kbmDates.topic",
          petugasCount: { $size: "$kbmDates.petugas" },
          petugasNames: "$petugasDetails.name"
        }
      }
    ]);

    return NextResponse.json({ schedules });
  } catch (error: unknown) {
    console.error("ADMIN DASHBOARD SCHEDULES GET ERROR:", error);
    return NextResponse.json({ error: "Gagal mengambil jadwal KBM terdekat" }, { status: 500 });
  }
});
