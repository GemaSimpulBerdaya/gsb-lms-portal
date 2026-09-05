export function buildTeamMembersByRegion<T>(
  entries: { region: string; members: T[] }[]
): Record<string, T[]> {
  return Object.fromEntries(
    entries.map(({ region, members }) => [region, members])
  );
}

export function filterTeamMembersByName<T extends { name: string }>(
  members: T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
  if (!normalizedQuery) return members;
  return members.filter((member) =>
    member.name.toLocaleLowerCase("id-ID").includes(normalizedQuery),
  );
}
