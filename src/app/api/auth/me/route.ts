import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await Relawan.findById(session.id).select("name email role region teamName");
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user session:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
