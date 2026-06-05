import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { Relawan, type TeamMemberRole } from "@/models/Relawan";
import { Volunteer } from "@/models/Volunteer";
import { notFoundInProduction } from "../_utils";

/**
 * Dev-only seed untuk konsep tim multi-anggota.
 *
 * Membuat:
 *   - 12 orang di registry Volunteer
 *   - 4 akun tim Relawan sesuai Lokasi Belajar aktif
 *   - Setiap tim punya 3 anggota: 1 FASILITATOR + 1 PENGAJAR + 1 DOKUMENTASI
 *
 * Aman di-rerun: pakai email/teamName upsert. Idempotent.
 *
 * POST /api/dev/seed-volunteers
 */
export async function POST() {
  const productionGuard = notFoundInProduction();
  if (productionGuard) return productionGuard;

  try {
    await connectDB();

    // ── 1. Registry orang ────────────────────────────────────
    const orang = [
      { name: "Budi Santoso", phone: "081234567001", joinedYear: 2024, notes: "Mahasiswa Pendidikan" },
      { name: "Andi Wijaya", phone: "081234567002", joinedYear: 2024 },
      { name: "Citra Lestari", phone: "081234567003", email: "citra@example.com", joinedYear: 2024 },
      { name: "Dimas Pratama", phone: "081234567004", joinedYear: 2025 },
      { name: "Eka Putri", phone: "081234567005", joinedYear: 2025, notes: "Aktif di Offline Depok" },
      { name: "Fajar Ramadhan", phone: "081234567006", joinedYear: 2024 },
      { name: "Gita Permata", phone: "081234567007", email: "gita@example.com", joinedYear: 2025 },
      { name: "Hendra Saputra", phone: "081234567008", joinedYear: 2024 },
      { name: "Indah Maharani", phone: "081234567009", joinedYear: 2025 },
      { name: "Joko Susilo", phone: "081234567010", joinedYear: 2024 },
      { name: "Kartika Dewi", phone: "081234567011", joinedYear: 2025 },
      { name: "Lukman Hakim", phone: "081234567012", joinedYear: 2024 },
    ];

    const registryDocs: Record<string, { _id: unknown }> = {};
    for (const o of orang) {
      const doc = await Volunteer.findOneAndUpdate(
        { name: o.name },
        { $setOnInsert: { ...o, isActive: true } },
        { upsert: true, new: true },
      );
      registryDocs[o.name] = doc as { _id: unknown };
    }

    // ── 2. Akun tim ──────────────────────────────────────────
    const passwordHash = await bcrypt.hash("password123", 10);

    type TeamSeed = {
      email: string;
      teamName: string;
      region: string;
      members: { name: string; role: TeamMemberRole }[];
    };

    const teams: TeamSeed[] = [
      {
        email: "tim.depok1@gsb.com",
        teamName: "Tim Offline Depok 1",
        region: "Offline Depok",
        members: [
          { name: "Budi Santoso", role: "FASILITATOR" },
          { name: "Andi Wijaya", role: "PENGAJAR" },
          { name: "Citra Lestari", role: "DOKUMENTASI" },
        ],
      },
      {
        email: "tim.depok2@gsb.com",
        teamName: "Tim Offline Depok 2",
        region: "Offline Depok",
        members: [
          { name: "Dimas Pratama", role: "FASILITATOR" },
          { name: "Eka Putri", role: "PENGAJAR" },
          { name: "Fajar Ramadhan", role: "DOKUMENTASI" },
        ],
      },
      {
        email: "tim.sasak1@gsb.com",
        teamName: "Tim Offline Sasak Panjang 1",
        region: "Offline Sasak Panjang",
        members: [
          { name: "Gita Permata", role: "FASILITATOR" },
          { name: "Hendra Saputra", role: "PENGAJAR" },
          { name: "Indah Maharani", role: "DOKUMENTASI" },
        ],
      },
      {
        email: "tim.online-reguler1@gsb.com",
        teamName: "Tim Online Reguler 1",
        region: "Online Reguler",
        members: [
          { name: "Joko Susilo", role: "FASILITATOR" },
          { name: "Kartika Dewi", role: "PENGAJAR" },
          { name: "Lukman Hakim", role: "DOKUMENTASI" },
        ],
      },
    ];

    await Relawan.deleteMany({
      email: {
        $in: [
          "tim.bekasi1@gsb.com",
          "tim.bekasi2@gsb.com",
          "tim.tangsel1@gsb.com",
          "tim.bandung1@gsb.com",
        ],
      },
    });

    const seededTeams: { teamName: string; email: string; region: string; members: number }[] = [];
    for (const t of teams) {
      const memberDocs = t.members
        .map((m) => {
          const v = registryDocs[m.name];
          if (!v) return null;
          return {
            volunteerId: v._id,
            role: m.role,
            joinedAt: new Date(),
          };
        })
        .filter((m): m is NonNullable<typeof m> => m !== null);

      await Relawan.findOneAndUpdate(
        { email: t.email },
        {
          $setOnInsert: {
            email: t.email,
            password: passwordHash,
            role: "RELAWAN",
            name: t.teamName,
          },
          $set: {
            teamName: t.teamName,
            region: t.region,
            members: memberDocs,
          },
        },
        { upsert: true, new: true },
      );

      seededTeams.push({
        teamName: t.teamName,
        email: t.email,
        region: t.region,
        members: memberDocs.length,
      });
    }

    return NextResponse.json({
      message: "Seed relawan berhasil",
      registry: orang.length,
      teams: seededTeams,
      defaultPassword: "password123",
      note: "Login: tim.depok1@gsb.com / password123 (dst.)",
    });
  } catch (error: unknown) {
    console.error("Seed volunteers error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
