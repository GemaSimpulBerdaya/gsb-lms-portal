import { DEFAULT_FASE_CONFIG } from "@/lib/reportDefaults";
import { Settings } from "@/models/Settings";

export function canonicalStudentFase(
  value: unknown,
  configuredFases: readonly string[],
): string | null {
  const fase = typeof value === "string" ? value.trim().toUpperCase() : "";
  return configuredFases.find((item) => item.trim().toUpperCase() === fase) ?? null;
}

export function canonicalStudentFaseUpdate(
  value: unknown,
  configuredFases: readonly string[],
  existingFase: unknown,
): string | null {
  const canonical = canonicalStudentFase(value, configuredFases);
  if (canonical) return canonical;
  const valueText = typeof value === "string" ? value.trim().toUpperCase() : "";
  const existingText = typeof existingFase === "string" ? existingFase.trim().toUpperCase() : "";
  return valueText && valueText === existingText ? String(existingFase).trim() : null;
}

export async function getConfiguredStudentFases(): Promise<string[]> {
  const doc = await Settings.findOne({ key: "faseConfig" })
    .select({ value: 1 })
    .lean<{ value?: Record<string, unknown> }>();
  const config = doc?.value && typeof doc.value === "object"
    ? doc.value
    : DEFAULT_FASE_CONFIG;
  return Object.keys(config);
}
