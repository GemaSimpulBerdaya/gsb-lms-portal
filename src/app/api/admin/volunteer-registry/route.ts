import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Volunteer } from "@/models/Volunteer";
import { TeamAccount } from "@/models/TeamAccount";
import { withAdmin } from "@/lib/apiAuth";
import { TEAM_ACCOUNT_ROLES } from "@/lib/roles";
import { syncVolunteerTeamAssignments } from "@/lib/syncVolunteerTeamAssignments";

/**
 * GET /api/admin/volunteer-registry
 *   ?q=<search>&active=true|false|all
 *
 * List orang di registry. Default: hanya yang isActive=true, sort by name.
 * Tiap entry juga memuat `currentTeam`: { id, teamName, region, role } | null
 * supaya UI admin tahu orang ini lagi di tim mana (untuk konfirmasi pindah).
 */
export const GET = withAdmin(async (request) => {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const active = searchParams.get("active") ?? "true";
    const region = (searchParams.get("region") ?? "").trim();
    const fase = (searchParams.get("fase") ?? "").trim();
    const week = (searchParams.get("week") ?? "").trim();

    const filter: Record<string, unknown> = {};
    if (active === "true") filter.isActive = true;
    else if (active === "false") filter.isActive = false;
    if (region) filter.assignmentRegion = region;
    if (fase) filter.assignmentFase = fase;
    if (week) {
      filter.assignmentWeek = { $regex: `(^|&)${week}(&|$)` };
    }
    // active=all => no filter
    if (q) {
      const matchingTeams = await TeamAccount.find({
        role: { $in: TEAM_ACCOUNT_ROLES },
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
    const teams = await TeamAccount.find({
      role: { $in: TEAM_ACCOUNT_ROLES },
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

    const optionFilter: Record<string, unknown> = {};
    if (active === "true") optionFilter.isActive = true;
    else if (active === "false") optionFilter.isActive = false;
    const [availableRegions, availableFases] = await Promise.all([
      Volunteer.distinct("assignmentRegion", optionFilter),
      Volunteer.distinct("assignmentFase", optionFilter),
    ]);

    return NextResponse.json({
      registryEntries: enriched,
      volunteers: enriched,
      filterOptions: {
        regions: availableRegions.filter(Boolean).sort(),
        fases: availableFases.filter(Boolean).sort((a, b) => a.localeCompare(b, "id-ID")),
        weeks: ["1", "2", "3", "4"],
      },
    });
  } catch (err) {
    console.error("GET /api/admin/volunteer-registry error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil registry relawan" },
      { status: 500 },
    );
  }
});

/**
 * POST /api/admin/volunteer-registry
 * Body: { name, phone?, email?, joinedYear?, notes? }
 *
 * Tambah orang baru ke registry. Email opsional dan harus unik (sparse).
 */
export const POST = withAdmin(async (request) => {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const assignmentRegion = String(body.assignmentRegion ?? "").trim();
    const assignmentRoles = Array.isArray(body.assignmentRoles)
      ? body.assignmentRoles.map((role: unknown) => String(role).trim()).filter(Boolean)
      : [];
    const assignmentFase = String(body.assignmentFase ?? "").trim();
    const assignmentWeek = String(body.assignmentWeek ?? "").trim();
    if (!name || !assignmentRegion || assignmentRoles.length === 0 || !assignmentFase || !assignmentWeek) {
      return NextResponse.json(
        { error: "Nama, lokasi, peran, fase, dan pekan wajib diisi" },
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
      assignmentRegion,
      assignmentRole: assignmentRoles.join(" & "),
      assignmentRoles,
      assignmentFase,
      assignmentWeek,
      isActive: body.isActive !== false,
      notes: typeof body.notes === "string" ? body.notes : "",
    });

    await syncVolunteerTeamAssignments([created._id]);

    return NextResponse.json({ registryEntry: created, volunteer: created });
  } catch (err) {
    console.error("POST /api/admin/volunteer-registry error:", err);
    return NextResponse.json(
      { error: "Gagal menambah relawan" },
      { status: 500 },
    );
  }
});
