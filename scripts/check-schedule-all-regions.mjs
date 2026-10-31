import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise actual save helpers without connecting to any database.
const source = readFileSync(new URL("../src/app/api/admin/schedules/route.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("route.ts", source, ts.ScriptTarget.Latest, true);
const helpers = ast.statements.filter((node) => ts.isFunctionDeclaration(node)
  && ["loadTeamMemberIds", "filterPetugasByMembership"].includes(node.name?.text));
assert.equal(helpers.length, 2);
const mapping = readFileSync(new URL("../src/lib/volunteerRegistryImportMapping.ts", import.meta.url), "utf8");
const allRegions = mapping.match(/VOLUNTEER_ALL_REGIONS = "([^"]+)"/)[1];
const volunteers = [
  { _id: "local", isActive: true, assignmentRegion: "Offline Sasak Panjang" },
  { _id: "all", isActive: true, assignmentRegion: allRegions },
  { _id: "inactive", isActive: false, assignmentRegion: allRegions },
  { _id: "other", isActive: true, assignmentRegion: "Offline Depok" },
];
const context = vm.createContext({
  VOLUNTEER_ALL_REGIONS: allRegions,
  TeamAccount: { findById: () => ({ select: () => ({ lean: async () => ({ members: [{ volunteerId: "member" }] }) }) }) },
  Volunteer: { find: (query) => ({ select: () => ({ lean: async () => volunteers.filter((v) =>
    v.isActive === query.isActive && (typeof query.assignmentRegion === "string"
      ? v.assignmentRegion === query.assignmentRegion
      : query.assignmentRegion.$in.includes(v.assignmentRegion))) }) }) },
});
vm.runInContext(ts.transpile(helpers.map((node) => node.getText(ast)).join("\n")), context);
const ids = await context.loadTeamMemberIds("team", "Offline Sasak Panjang");
const result = context.filterPetugasByMembership([
  { week: 1, petugas: ["all", "local", "member", "inactive", "other", "unknown"] },
], ids);
assert.deepEqual(Array.from(result[0].petugas), ["all", "local", "member"]);
console.log("PASS: save retains all-region, local and team volunteers; rejects inactive, other-region and unknown volunteers. No DB connection.");
