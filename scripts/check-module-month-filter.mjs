import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/app/(admin)/admin/modules/_panels/ModulesPanel.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("panel.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "filteredModules") callback = node.initializer.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert(callback);
const modules = [1, 12, null, undefined].map((month, i) => ({ _id: String(i), title: "Modul", month, subject: "Matematika", fase: "TUNAS", semester: "2026-2" }));
function filter(overrides) {
  const context = vm.createContext({ modules, search: "", filterSub: "ALL", filterLevel: "ALL", selectedSemester: "ALL", filterMonth: "ALL", ...overrides });
  return Array.from(vm.runInContext(ts.transpile(`(${callback})()`), context), (m) => m._id);
}
assert.deepEqual(filter({ filterMonth: "1" }), ["0"]);
assert.deepEqual(filter({ filterMonth: "12" }), ["1"]);
assert.deepEqual(filter({}), ["0", "1", "2", "3"]);
for (const extra of [{ search: "Tidak ada" }, { filterSub: "IPA" }, { filterLevel: "PUCUK" }, { selectedSemester: "2027-1" }]) {
  assert.deepEqual(filter({ filterMonth: "1", ...extra }), []);
}
console.log("PASS: January/December, all months including unset dates, and combined filters.");
