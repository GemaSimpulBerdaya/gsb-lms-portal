import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import AnakDidik from "@/models/AnakDidik";

export const GET = withVolunteer(async () => {
  await connectDB();

  const students = await AnakDidik.find()
    .select("name region fase parentName")
    .sort({ name: 1 });

  return NextResponse.json({
    total: students.length,
    students,
  });
});
