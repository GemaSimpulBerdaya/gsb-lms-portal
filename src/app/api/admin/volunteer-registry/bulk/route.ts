import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Volunteer } from "@/models/Volunteer";
import { withAdmin } from "@/lib/apiAuth";

interface RawRow {
  name?: unknown;
  assignmentRegion?: unknown;
  assignmentRole?: unknown;
  assignmentFase?: unknown;
  assignmentWeek?: unknown;
}

const asString = (value: unknown) => String(value ?? "").trim();

export const POST = withAdmin(async (request) => {
  try {
    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? (body.rows as RawRow[]) : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: "Data relawan kosong" }, { status: 400 });
    }

    const volunteers = rows.map((row) => ({
      name: asString(row.name),
      assignmentRegion: asString(row.assignmentRegion),
      assignmentRole: asString(row.assignmentRole),
      assignmentFase: asString(row.assignmentFase),
      assignmentWeek: asString(row.assignmentWeek),
    }));
    const invalidRow = volunteers.findIndex(
      (volunteer) =>
        !volunteer.name ||
        !volunteer.assignmentRegion ||
        !volunteer.assignmentRole ||
        !volunteer.assignmentFase ||
        !volunteer.assignmentWeek,
    );
    if (invalidRow !== -1) {
      return NextResponse.json(
        { error: `Baris ${invalidRow + 2} belum lengkap` },
        { status: 400 },
      );
    }

    const names = volunteers.map((volunteer) => volunteer.name.toLowerCase());
    const duplicateName = names.find((name, index) => names.indexOf(name) !== index);
    if (duplicateName) {
      return NextResponse.json(
        { error: `Nama relawan duplikat di file: ${duplicateName}` },
        { status: 409 },
      );
    }

    await connectDB();
    const existing = await Volunteer.find({
      name: { $in: volunteers.map((volunteer) => volunteer.name) },
    })
      .select({ name: 1 })
      .lean();
    const existingNames = new Set(existing.map((volunteer) => volunteer.name));

    const result = await Volunteer.bulkWrite(
      volunteers.map((volunteer) => ({
        updateOne: {
          filter: { name: volunteer.name },
          update: { $set: { ...volunteer, isActive: true } },
          upsert: true,
        },
      })),
      { ordered: true },
    );

    return NextResponse.json({
      message: "Impor relawan selesai",
      totalRows: volunteers.length,
      created: result.upsertedCount || 0,
      updated: volunteers.filter((volunteer) => existingNames.has(volunteer.name)).length,
    });
  } catch (error) {
    console.error("Bulk import volunteers error:", error);
    return NextResponse.json({ error: "Gagal mengimpor relawan" }, { status: 500 });
  }
});
