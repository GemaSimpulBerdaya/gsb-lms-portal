import { strict as assert } from "node:assert";
import {
  findVolunteerWeekConflict,
  removeVolunteerAssignment,
} from "../src/lib/scheduleAssignments";
import { buildTeamMembersByRegion } from "../src/lib/scheduleTeamMembers";

const schedules = [
  {
    region: "Sekolah Master",
    fase: "FASE A",
    kbmDates: [{ week: 2, petugas: ["volunteer-1"] }],
  },
];

assert.deepEqual(
  findVolunteerWeekConflict(
    [{ week: 2, petugas: ["volunteer-1"] }],
    schedules
  ),
  {
    volunteerId: "volunteer-1",
    week: 2,
    region: "Sekolah Master",
    fase: "FASE A",
  }
);

assert.equal(
  findVolunteerWeekConflict(
    [{ week: 3, petugas: ["volunteer-1"] }],
    schedules
  ),
  null
);

const sourceSchedule = {
  kbmDates: [
    { week: 2, petugas: ["volunteer-1", "volunteer-2"] },
    { week: 3, petugas: ["volunteer-1"] },
  ],
};
assert.equal(
  removeVolunteerAssignment(sourceSchedule, 2, "volunteer-1"),
  true
);
assert.deepEqual(sourceSchedule.kbmDates, [
  { week: 2, petugas: ["volunteer-2"] },
  { week: 3, petugas: ["volunteer-1"] },
]);
assert.equal(
  removeVolunteerAssignment(sourceSchedule, 2, "volunteer-3"),
  false
);

assert.deepEqual(
  buildTeamMembersByRegion([
    { region: "Sekolah Master", members: [{ volunteerId: "volunteer-1" }] },
    { region: "Rumah Belajar", members: [{ volunteerId: "volunteer-2" }] },
  ]),
  {
    "Sekolah Master": [{ volunteerId: "volunteer-1" }],
    "Rumah Belajar": [{ volunteerId: "volunteer-2" }],
  }
);

console.log("schedule assignment check passed");
