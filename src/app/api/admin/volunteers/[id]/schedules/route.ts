import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Schedule } from "@/models/Schedule";
import { Relawan, normalizeTeamMemberRole } from "@/models/Relawan";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await connectDB();
    const team = await Relawan.findById(id).select({ members: 1 }).lean();
    const roleByVolunteerId = new Map(
      ((team as { members?: { volunteerId: unknown; role: unknown }[] })?.members ?? [])
        .map((member) => [
          String(member.volunteerId),
          normalizeTeamMemberRole(member.role) ?? "FASILITATOR",
        ])
    );

    const schedules = await Schedule.find({ relawanId: id })
      .populate("kbmDates.petugas", "name")
      .sort({ createdAt: -1 })
      .lean();

    const enrichedSchedules = schedules.map((schedule) => ({
      ...schedule,
      kbmDates: schedule.kbmDates?.map((kbm) => ({
        ...kbm,
        petugas: kbm.petugas?.map((member: unknown) => {
          const populated = member as { _id?: unknown; name?: string };
          const memberId = String(populated._id ?? member);
          return {
            _id: memberId,
            name: populated.name ?? "(tanpa nama)",
            role: roleByVolunteerId.get(memberId) ?? "FASILITATOR",
          };
        }),
      })),
    }));
    
    return NextResponse.json({ schedules: enrichedSchedules });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
