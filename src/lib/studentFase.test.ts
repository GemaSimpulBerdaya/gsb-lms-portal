import { describe, expect, it } from "bun:test";
import { canonicalStudentFase, canonicalStudentFaseUpdate } from "./studentFase";

const configuredFases = ["FASE TUNAS & PUCUK", "FASE A", "FASE B"];

describe("canonicalStudentFase", () => {
  it("returns configured canonical fase case-insensitively", () => {
    expect(canonicalStudentFase(" fase a ", configuredFases)).toBe("FASE A");
  });

  it("rejects legacy fase outside configuration", () => {
    expect(canonicalStudentFase("SD", configuredFases)).toBeNull();
  });

  it("preserves an unchanged legacy fase during unrelated edits", () => {
    expect(canonicalStudentFaseUpdate("SNBT", configuredFases, "SNBT")).toBe("SNBT");
    expect(canonicalStudentFaseUpdate("SD", configuredFases, "SNBT")).toBeNull();
  });
});
