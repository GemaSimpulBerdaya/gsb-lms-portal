import { NextResponse } from "next/server";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import connectDB from "@/lib/mongodb";
import { withAdmin } from "@/lib/apiAuth";
import { aggregateReports } from "@/lib/reportAggregator";
import { ReportDocument } from "@/lib/pdf/ReportTemplate";
import type { ReportPayload } from "@/lib/pdf/reportTypes";
import { getSemesterDisplayLabel } from "@/lib/semesterLabel";

// React-PDF and ZIP buffer assembly need Node APIs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ZipEntry = {
  name: string;
  data: Buffer;
  modifiedAt?: Date;
};

export const GET = withAdmin(async (request) => {
  const { searchParams } = request.nextUrl;
  const semester = cleanParam(searchParams.get("semester"));
  const fase = pickPhase(searchParams);
  const region = optionalFilter(searchParams.get("region"));
  const search = cleanParam(searchParams.get("search"))?.toLowerCase();

  if (!semester) {
    return NextResponse.json({ error: "Query 'semester' wajib diisi" }, { status: 400 });
  }

  if (!fase) {
    return NextResponse.json(
      { error: "Query 'fase' atau 'level' wajib diisi dan tidak boleh ALL" },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    const reports = await aggregateReports({ semester, region, fase });
    const filteredReports = search
      ? reports.filter((report) => report.name.toLowerCase().includes(search))
      : reports;

    if (filteredReports.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada siswa sesuai filter rapor" },
        { status: 404 }
      );
    }

    const usedNames = new Set<string>();
    const entries: ZipEntry[] = [];
    const semesterLabel = await getSemesterDisplayLabel(semester);

    for (const report of filteredReports) {
      const pdf = await renderReportPdf({ ...report, semester: semesterLabel });
      const filename = uniqueFilename(
        `rapor_${safeFilename(report.name)}_${safeFilename(semesterLabel)}.pdf`,
        usedNames
      );
      entries.push({ name: filename, data: pdf });
    }

    const archiveName = `rapor_${safeFilename(fase)}_${safeFilename(semesterLabel)}.zip`;
    const zip = createZip(entries);

    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${archiveName}"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ADMIN GRADES RAPORT ARCHIVE ERROR:", error);
    return NextResponse.json(
      { error: "Gagal generate arsip rapor" },
      { status: 500 }
    );
  }
});

function cleanParam(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalFilter(value: string | null): string | null {
  const normalized = cleanParam(value);
  if (!normalized || normalized.toUpperCase() === "ALL") return null;
  return normalized;
}

function pickPhase(searchParams: URLSearchParams): string | null {
  return optionalFilter(searchParams.get("fase")) ?? optionalFilter(searchParams.get("level"));
}

function safeFilename(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "rapor"
  );
}

function uniqueFilename(filename: string, usedNames: Set<string>): string {
  const dotIndex = filename.lastIndexOf(".");
  const base = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex >= 0 ? filename.slice(dotIndex) : "";
  let candidate = filename;
  let counter = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${base}_${counter}${ext}`;
    counter += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

async function renderReportPdf(data: ReportPayload): Promise<Buffer> {
  const stream = await renderToStream(
    React.createElement(ReportDocument, { data }) as unknown as Parameters<
      typeof renderToStream
    >[0]
  );

  return streamToBuffer(stream);
}

function streamToBuffer(nodeStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    nodeStream.on("data", (chunk: Buffer | Uint8Array | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    nodeStream.on("end", () => resolve(Buffer.concat(chunks)));
    nodeStream.on("error", reject);
  });
}

function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  const now = new Date();
  let offset = 0;

  for (const entry of entries) {
    const filename = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const crc = crc32(data);
    const { dosDate, dosTime } = toDosDateTime(entry.modifiedAt ?? now);

    if (filename.length > 0xffff || data.length > 0xffffffff || offset > 0xffffffff) {
      throw new Error("ZIP entry terlalu besar untuk format ZIP standar");
    }

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(filename.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(filename.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, filename, data);
    centralParts.push(centralHeader, filename);
    offset += localHeader.length + filename.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);

  if (
    entries.length > 0xffff ||
    centralSize > 0xffffffff ||
    centralOffset > 0xffffffff
  ) {
    throw new Error("ZIP archive terlalu besar untuk format ZIP standar");
  }

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(centralOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

function toDosDateTime(date: Date): { dosDate: number; dosTime: number } {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  return { dosDate, dosTime };
}

const CRC_TABLE = createCrcTable();

function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }

  return table;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}
