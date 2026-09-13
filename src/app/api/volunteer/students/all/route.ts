import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import Student, { PORTAL_STUDENT_FILTER } from "@/models/Student";

export const GET = withVolunteer(async () => {
  await connectDB();

  const students = await Student.find(PORTAL_STUDENT_FILTER)
    .select("name region fase parentName")
    .sort({ name: 1 });

  return NextResponse.json({
    total: students.length,
    students,
  });
});
