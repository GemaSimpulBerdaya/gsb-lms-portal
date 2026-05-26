import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { Volunteer } from "@/models/Volunteer";
import { Relawan, TEAM_MEMBER_ROLES, type TeamMemberRole } from "@/models/Relawan";
import { getSessionUser } from "@/lib/session";

/**
 * Bulk import relawan dari Excel.
 *
 * Body (JSON):
 *   {
 *     rows: [
 *       {
 *         name: string,           // wajib
 *         phone?: string,
 *         email?: string,         // sparse unique di registry
 *         joinedYear?: number,
 *         notes?: string,
 *         // ── auto-buat akun tim + assign anggota (opsional) ──
 *         teamName?: string,      // kalau diisi: orang ini akan ditambahkan ke tim
 *         teamEmail?: string,     // wajib kalau teamName diisi (untuk akun login)
 *         teamRegion?: string,    // opsional (default: kosong)
 *         teamPassword?: string,  // opsional (default: 'password123')
 *         role?: "FACILITATOR" | "PENGAJAR" | "DOKUMENTASI",  // default FACILITATOR
 *       }
 *     ]
 *   }
 *
 * Logic:
 *   1. Untuk tiap row, upsert Volunteer di registry by name (case-sensitive exact)
 *   2. Kalau teamName + teamEmail diisi, upsert Relawan akun tim:
 *      - Kalau akun baru: hash password (default 'password123')
 *      - Kalau akun ada: pakai password existing
 *   3. Push orang ke members[] tim itu (skip kalau orang sudah anggota tim ini)
 *   4. Detect transfer: kalau orang sudah jadi anggota tim lain, masuk ke
 *      `transfers[]` di response — admin handle manual lewat UI
 *
 * Response:
 *   {
 *     totalRows, registryCreated, registryUpdated,
 *     teamsCreated, teamsUpdated, membersAdded,
 *     transfers: [{ name, fromTeam, toTeam }],
 *     errors: [{ row, name, error }],
 *   }
 */

interface RawRow {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  joinedYear?: unknown;
  notes?: unknown;
  teamName?: unknown;
  teamEmail?: unknown;
  teamRegion?: unknown;
  teamPassword?: unknown;
  role?: unknown;
}

function asStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function asInt(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const rows = Array.isArray(body?.rows) ? (body.rows as RawRow[]) : null;
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "Field 'rows' kosong atau bukan array" },
        { status: 400 },
      );
    }

    let registryCreated = 0;
    let registryUpdated = 0;
    let membersAdded = 0;
    const teamsTouched = new Map<string, { created: boolean }>();
    const transfers: { name: string; fromTeam: string; toTeam: string }[] = [];
    const errors: { row: number; name?: string; error: string }[] = [];

    // Cache password hash untuk default supaya tidak hash 100x kalau impor besar.
    let defaultHashPromise: Promise<string> | null = null;
    const getDefaultHash = () => {
      if (!defaultHashPromise) {
        defaultHashPromise = bcrypt.hash("password123", 10);
      }
      return defaultHashPromise;
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = asStr(r.name);
      if (!name) {
        errors.push({ row: i + 1, error: "Kolom 'name' kosong" });
        continue;
      }

      try {
        // ── Step 1: upsert Volunteer registry ──
        const phone = asStr(r.phone);
        const email = asStr(r.email);
        const joinedYear = asInt(r.joinedYear);
        const notes = asStr(r.notes);

        const existingVol = await Volunteer.findOne({ name });
        let volunteer;
        if (existingVol) {
          // Update only kalau ada nilai baru.
          if (phone !== undefined) existingVol.phone = phone;
          if (email !== undefined) existingVol.email = email;
          if (joinedYear !== undefined) existingVol.joinedYear = joinedYear;
          if (notes !== undefined) existingVol.notes = notes;
          if (existingVol.isActive === false) existingVol.isActive = true;
          await existingVol.save();
          volunteer = existingVol;
          registryUpdated++;
        } else {
          volunteer = await Volunteer.create({
            name,
            phone,
            email,
            joinedYear,
            notes,
            isActive: true,
          });
          registryCreated++;
        }

        // ── Step 2: optional team assignment ──
        const teamName = asStr(r.teamName);
        const teamEmail = asStr(r.teamEmail);
        if (!teamName) continue; // tidak ada tim, skip step 2

        if (!teamEmail) {
          errors.push({
            row: i + 1,
            name,
            error: "teamName diisi tapi teamEmail kosong (wajib untuk akun login)",
          });
          continue;
        }

        const teamRegion = asStr(r.teamRegion);
        const customTeamPassword = asStr(r.teamPassword);
        const roleRaw = asStr(r.role)?.toUpperCase();
        const role: TeamMemberRole = (TEAM_MEMBER_ROLES as readonly string[]).includes(roleRaw ?? "")
          ? (roleRaw as TeamMemberRole)
          : "FACILITATOR";

        let team = await Relawan.findOne({ email: teamEmail });
        let teamWasCreated = false;
        if (!team) {
          const passwordHash = customTeamPassword
            ? await bcrypt.hash(customTeamPassword, 10)
            : await getDefaultHash();
          team = await Relawan.create({
            email: teamEmail,
            password: passwordHash,
            role: "RELAWAN",
            name: teamName,
            teamName,
            region: teamRegion,
            members: [],
          });
          teamWasCreated = true;
        } else {
          // Sinkron field tim kalau berubah dari Excel.
          if (team.teamName !== teamName) team.teamName = teamName;
          if (teamRegion && team.region !== teamRegion) team.region = teamRegion;
          if (customTeamPassword) {
            team.password = await bcrypt.hash(customTeamPassword, 10);
          }
        }

        // Track tim disentuh untuk stats.
        if (!teamsTouched.has(teamEmail)) {
          teamsTouched.set(teamEmail, { created: teamWasCreated });
        }

        // ── Step 3: cek anggota tim, deteksi transfer, push members[] ──
        const volId = String(volunteer._id);

        // Cek apakah orang ini sudah jadi anggota tim LAIN.
        const otherTeam = await Relawan.findOne({
          _id: { $ne: team._id },
          "members.volunteerId": volunteer._id,
        });
        if (otherTeam) {
          transfers.push({
            name,
            fromTeam: otherTeam.teamName ?? "(tanpa nama)",
            toTeam: teamName,
          });
          // Default behavior: SKIP transfer otomatis. Admin harus konfirmasi
          // manual via UI (TeamMembersModal). Aman supaya impor tidak
          // tidak sengaja mengganggu data tim aktif.
          await team.save();
          continue;
        }

        // Skip kalau sudah anggota tim ini.
        const alreadyMember = team.members?.some(
          (m) => String(m.volunteerId) === volId,
        );
        if (!alreadyMember) {
          team.members = team.members ?? [];
          team.members.push({
            volunteerId: volunteer._id,
            role,
            joinedAt: new Date(),
          });
          membersAdded++;
        }

        await team.save();
      } catch (err) {
        errors.push({
          row: i + 1,
          name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    let teamsCreated = 0;
    let teamsUpdated = 0;
    for (const [, info] of teamsTouched) {
      if (info.created) teamsCreated++;
      else teamsUpdated++;
    }

    return NextResponse.json({
      message: "Bulk import selesai",
      totalRows: rows.length,
      registryCreated,
      registryUpdated,
      teamsCreated,
      teamsUpdated,
      membersAdded,
      transfers,
      errors,
    });
  } catch (error) {
    console.error("Bulk import volunteers error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
