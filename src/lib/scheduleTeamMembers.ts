export function buildTeamMembersByRegion<T>(
  entries: { region: string; members: T[] }[]
): Record<string, T[]> {
  return Object.fromEntries(
    entries.map(({ region, members }) => [region, members])
  );
}
