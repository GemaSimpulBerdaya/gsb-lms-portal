/**
 * Endpoint generator PDF rapor untuk 1 siswa.
 *
 * Usage: GET /api/admin/grades/pdf?studentId=...&semester=...
 *
 * Mereuse `aggregateReports` dari `/api/admin/grades` agar shape data sama
 * persis. Perbedaan: endpoint ini stream PDF, bukan JSON.
 */

import { NextResponse } from "next/server";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import connectDB from "@/lib/mongodb";
import { withAdmin } from "@/lib/apiAuth";
import { aggregateReports } from "@/lib/reportAggregator";
import { ReportDocument } from "@/lib/pdf/ReportTemplate";
import { getSemesterDisplayLabel } from "@/lib/semesterLabel";

// React-PDF perlu Node runtime (bukan edge) karena pakai Buffer/stream native.
export const runtime = "nodejs";
// Jangan pernah dicache — output bergantung data live.
export const dynamic = "force-dynamic";

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9_\-]+/g, "_").slice(0, 80) || "rapor";
}

export const GET = withAdmin(async (request) => {
  const { searchParams } = request.nextUrl;
  const semester = searchParams.get("semester");
  const studentId = searchParams.get("studentId");

  if (!semester || !studentId) {
    return NextResponse.json(
      { error: "Query 'semester' dan 'studentId' wajib diisi" },
      { status: 400 }
    );
  }

  await connectDB();

  try {
    const data = await aggregateReports({ semester, studentId });
    if (data.length === 0) {
      return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    }

    const payload = data[0];
    const semesterLabel = await getSemesterDisplayLabel(semester);
    const displayPayload = { ...payload, semester: semesterLabel };
    // `renderToStream` expect ReactElement<DocumentProps>. ReportDocument
    // adalah wrapper yang mereturn <Document>, jadi secara runtime valid.
    // Cast diperlukan karena TS signature @react-pdf tidak generik terhadap
    // props wrapper.
    const stream = await renderToStream(
      React.createElement(ReportDocument, { data: displayPayload }) as unknown as Parameters<
        typeof renderToStream
      >[0]
    );

    // Convert Node stream -> Web ReadableStream (Next 15+ App Router native).
    const webStream =
      (stream as unknown as { toWeb?: () => ReadableStream }).toWeb?.() ??
      toWebStream(stream);

    const filename = `rapor_${safeFilename(payload.name)}_${safeFilename(semesterLabel)}.pdf`;
    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ADMIN GRADES PDF ERROR:", error);
    return NextResponse.json(
      { error: "Gagal generate PDF rapor" },
      { status: 500 }
    );
  }
});

// Fallback bila Readable.toWeb tidak tersedia (Node < 18).
function toWebStream(nodeStream: NodeJS.ReadableStream): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer | string) => {
        controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      (nodeStream as { destroy?: () => void }).destroy?.();
    },
  });
}
