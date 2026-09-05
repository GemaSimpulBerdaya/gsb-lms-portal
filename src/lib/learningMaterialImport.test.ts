import { describe, expect, it } from "bun:test";
import {
  canonicalConfiguredValue,
  mapMateriAjarImportRow,
  mapModuleImportRow,
  parseImportMonth,
  slugifyImportTitle,
} from "./learningMaterialImport";

describe("learning material Excel mapping", () => {
  it("returns configured value with canonical casing", () => {
    expect(canonicalConfiguredValue(" matematika ", ["Matematika"])).toBe("Matematika");
    expect(canonicalConfiguredValue("IPA", ["Matematika"])).toBeNull();
  });

  it("maps module columns and generates slug", () => {
    expect(
      mapModuleImportRow({
        "Judul Modul": "Pecahan Dasar",
        Fase: "fase b",
        "Mata Pelajaran": "Matematika",
        Bulan: "Agustus",
        Semester: "2026-2",
        "Link Google Drive": "https://drive.google.com/file/d/abc/view",
      }),
    ).toEqual({
      title: "Pecahan Dasar",
      slug: "pecahan-dasar",
      description: "",
      fase: "fase b",
      subject: "Matematika",
      month: 8,
      semester: "2026-2",
      fileUrl: "https://drive.google.com/file/d/abc/view",
      order: 0,
    });
  });

  it("maps materi ajar aliases", () => {
    expect(
      mapMateriAjarImportRow({
        Judul: "Slide Pecahan",
        Fase: "FASE B",
        Mapel: "Matematika",
        Month: 8,
        "File URL": "https://docs.google.com/presentation/d/abc/edit",
      }),
    ).toMatchObject({
      title: "Slide Pecahan",
      fase: "FASE B",
      subject: "Matematika",
      month: 8,
      fileUrl: "https://docs.google.com/presentation/d/abc/edit",
    });
  });

  it("rejects unknown month labels", () => {
    expect(parseImportMonth("Smarch")).toBe("Smarch");
  });

  it("generates URL-safe slugs from accented titles", () => {
    expect(slugifyImportTitle("Énergi Çağdaş")).toBe("energi-cagdas");
  });
});
