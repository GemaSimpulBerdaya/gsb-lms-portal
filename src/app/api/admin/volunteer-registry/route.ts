import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Volunteer } from "@/models/Volunteer";
import { Relawan } from "@/models/Relawan";
import { getSessionUser } from "@/lib/session";

/**
 * GET /api/admin/volunteer-registry
 *   ?q=<search>&active=true|false|all
 *
 * List orang di registry. Default: hanya yang isActive=true, sort by name.
 * Tiap entry juga memuat `currentTeam`: { id, teamName, region, role } | null
 * supaya UI admin tahu orang ini lagi di tim mana (untuk konfirmasi pindah).
 */
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const active = searchParams.get("active") ?? "true";

    const filter: Record<string, unknown> = {};
    if (active === "true") filter.isActive = true;
    else if (active === "false") filter.isActive = false;
    // active=all => no filter
    if (q) {
      const matchingTeams = await Relawan.find({ 
        role: "RELAWAN", 
        teamName: { $regex: q, $options: "i" } 
      }).select("members");
      
      const teamMatchIds = matchingTeams.flatMap(t => 
        (t.members || []).map(m => m.volunteerId)
      );

      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { _id: { $in: teamMatchIds } }
      ];
    }

    const volunteers = await Volunteer.find(filter)
      .sort({ name: 1 })
      .limit(500)
      .lean();

    // Cari tim aktif untuk tiap volunteer (cuma 1 tim yang valid). Sekali query
    // pakai $in supaya nggak N+1.
    const ids = volunteers.map((v) => v._id);
    const teams = await Relawan.find({
      role: "RELAWAN",
      "members.volunteerId": { $in: ids },
    })
      .select({ _id: 1, teamName: 1, region: 1, members: 1 })
      .lean();

    // Build map: volunteerId -> { teamId, teamName, region, role }
    const teamByVolunteer = new Map<
      string,
      { id: string; teamName?: string; region?: string; role: string }
    >();
    for (const t of teams) {
      for (const m of (t as { members?: { volunteerId: unknown; role: string }[] }).members ?? []) {
        const key = String(m.volunteerId);
        if (!teamByVolunteer.has(key)) {
          teamByVolunteer.set(key, {
            id: String(t._id),
            teamName: (t as { teamName?: string }).teamName,
            region: (t as { region?: string }).region,
            role: m.role,
          });
        }
      }
    }

    const enriched = volunteers.map((v) => ({
      ...v,
      currentTeam: teamByVolunteer.get(String(v._id)) ?? null,
    }));

    return NextResponse.json({ volunteers: enriched });
  } catch (err) {
    console.error("GET /api/admin/volunteer-registry error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil registry relawan" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/volunteer-registry
 * Body: { name, phone?, email?, joinedYear?, notes? }
 *
 * Tambah orang baru ke registry. Email opsional dan harus unik (sparse).
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Nama wajib diisi" },
        { status: 400 },
      );
    }

    await connectDB();

    // Cegah duplikat email kalau diisi.
    const email =
      typeof body.email === "string" && body.email.trim()
        ? body.email.trim().toLowerCase()
        : undefined;
    if (email) {
      const existing = await Volunteer.findOne({ email });
      if (existing) {
        return NextResponse.json(
          { error: "Email kontak sudah dipakai oleh relawan lain" },
          { status: 400 },
        );
      }
    }

    const created = await Volunteer.create({
      name,
      phone:
        typeof body.phone === "string" && body.phone.trim()
          ? body.phone.trim()
          : undefined,
      email,
      joinedYear:
        typeof body.joinedYear === "number" ? body.joinedYear : undefined,
      isActive: body.isActive !== false,
      notes: typeof body.notes === "string" ? body.notes : "",
    });

    if (body.teamId && body.role) {
      const team = await Relawan.findById(body.teamId);
      if (team) {
        team.members.push({
          volunteerId: created._id as any,
          role: body.role,
        });
        await team.save();
      }
    }

    return NextResponse.json({ volunteer: created });
  } catch (err) {
    console.error("POST /api/admin/volunteer-registry error:", err);
    return NextResponse.json(
      { error: "Gagal menambah relawan" },
      { status: 500 },
    );
  }
}
