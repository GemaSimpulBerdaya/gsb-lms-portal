import { describe, expect, it } from "bun:test";
import { filterTeamMembersByName } from "./scheduleTeamMembers";

const members = [
  { volunteerId: "1", name: "Aditia Fahmi", role: "PENGAJAR" },
  { volunteerId: "2", name: "Naufal Akbar", role: "FASILITATOR" },
];

describe("filterTeamMembersByName", () => {
  it("filters names case-insensitively", () => {
    expect(filterTeamMembersByName(members, "fAHmi")).toEqual([members[0]]);
  });

  it("returns all members for blank search", () => {
    expect(filterTeamMembersByName(members, "  ")).toEqual(members);
  });
});
