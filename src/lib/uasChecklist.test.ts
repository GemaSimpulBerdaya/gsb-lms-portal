import { test, expect } from "bun:test";
import { scoreUasChecklist, validateChecklistConfig } from "./uasChecklist";

const component = {
  subject: "MENYIMAK",
  label: "Menyimak",
  maxScore: 25,
  scoringMode: "CHECKLIST_0_4" as const,
  criteria: [
    { key: "a", label: "Memperhatikan" },
    { key: "b", label: "Membedakan" },
    { key: "c", label: "Mengelompokkan" },
    { key: "d", label: "Mengenali emosi" },
  ],
};

test("tiga indikator menghasilkan skala 3 dan 18,75 dari 25", () => {
  const result = scoreUasChecklist(component, ["a", "b", "c"]);
  expect(result.scale).toBe(3);
  expect(result.score).toBe(18.75);
  expect(result.rubricItems.filter((item) => item.checked)).toHaveLength(3);
});

test("nol indikator bernilai nol, tidak sama dengan belum dinilai", () => {
  expect(scoreUasChecklist(component, []).score).toBe(0);
});

test("indikator tidak dikenal atau duplikat ditolak", () => {
  expect(() => scoreUasChecklist(component, ["x"])).toThrow();
  expect(() => scoreUasChecklist(component, ["a", "a"])).toThrow();
});

test("konfigurasi checklist harus empat indikator unik dengan bobot positif", () => {
  expect(validateChecklistConfig(component)).toBeNull();
  expect(validateChecklistConfig({ ...component, criteria: component.criteria.slice(0, 3) })).toBeTruthy();
  expect(validateChecklistConfig({ ...component, maxScore: 0 })).toBeTruthy();
  expect(validateChecklistConfig({ ...component, criteria: [component.criteria[0], component.criteria[0], ...component.criteria.slice(2)] })).toBeTruthy();
});
