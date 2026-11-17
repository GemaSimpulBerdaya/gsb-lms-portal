export type UasCriterionConfig = {
  key: string;
  label: string;
  active?: boolean;
  order?: number;
};

export type UasChecklistComponent = {
  subject: string;
  label: string;
  maxScore: number;
  scoringMode?: "DIRECT_SCORE" | "CHECKLIST_0_4";
  criteria?: UasCriterionConfig[];
  scaleLabels?: string[];
};

export type UasRubricItem = {
  criterionKey: string;
  criterion: string;
  scale: number;
  checked: boolean;
  score: number;
  maxScore: number;
};

export function validateChecklistConfig(component: UasChecklistComponent): string | null {
  if (component.maxScore <= 0) return "maxScore harus lebih besar dari 0";
  if (component.scoringMode !== "CHECKLIST_0_4") return null;
  const criteria = component.criteria ?? [];
  if (criteria.length !== 4) return "Checklist skala 0-4 wajib memiliki 4 indikator";
  if (criteria.some((criterion) => !criterion.key.trim() || !criterion.label.trim())) {
    return "Setiap indikator wajib memiliki kode dan label";
  }
  if (new Set(criteria.map((criterion) => criterion.key)).size !== criteria.length) {
    return "Kode indikator tidak boleh duplikat";
  }
  return null;
}

export function scoreUasChecklist(
  component: UasChecklistComponent,
  selectedKeys: string[],
): { scale: number; score: number; rubricItems: UasRubricItem[] } {
  const error = validateChecklistConfig(component);
  if (error) throw new Error(error);
  const criteria = [...(component.criteria ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (new Set(selectedKeys).size !== selectedKeys.length || selectedKeys.some((key) => !criteria.some((c) => c.key === key))) {
    throw new Error("Indikator UAS tidak valid");
  }
  const perCriterion = component.maxScore / 4;
  const rubricItems = criteria.map((criterion) => {
    const checked = selectedKeys.includes(criterion.key);
    return {
      criterionKey: criterion.key,
      criterion: criterion.label,
      scale: checked ? 1 : 0,
      checked,
      score: checked ? perCriterion : 0,
      maxScore: perCriterion,
    };
  });
  return {
    scale: selectedKeys.length,
    score: Number((selectedKeys.length * perCriterion).toFixed(4)),
    rubricItems,
  };
}

export function scoreUasFromRubricItems(
  component: UasChecklistComponent,
  selectedKeys: string[],
): { scale: number; score: number; rubricItems: UasRubricItem[] } {
  return component.scoringMode === "CHECKLIST_0_4"
    ? scoreUasChecklist(component, selectedKeys)
    : { scale: 0, score: 0, rubricItems: [] };
}

export function selectedKeysFromRubricItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new Error("rubricItems harus berupa array");
  return raw.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (!item || typeof item !== "object") throw new Error("rubricItems tidak valid");
    const value = item as Record<string, unknown>;
    if (value.checked === false) return [];
    if (typeof value.criterionKey !== "string" || !value.criterionKey.trim()) {
      throw new Error("rubricItems.criterionKey wajib diisi");
    }
    return [value.criterionKey];
  });
}
