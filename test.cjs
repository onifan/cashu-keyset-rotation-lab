"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { parseSnapshot, compare, fee } = require("./rotation.js");

const sat = (id, active, extra = {}) => ({ id, unit: "sat", active, ...extra });
const snapshot = (...keysets) => parseSnapshot(JSON.stringify({ keysets }));
const a = "00aa000000000001";
const b = "01" + "ab".repeat(32);
const c = "00cc000000000003";
const d = "00dd000000000004";
const oldRows = snapshot(sat(a, true), sat(c, false), sat(d, true, { unit: "usd" }));
const newRows = snapshot(
  sat(a, false, { input_fee_ppk: 100, final_expiry: 1893456000 }),
  sat(b, true, { input_fee_ppk: 400 }),
  sat(d, true, { unit: "usd", input_fee_ppk: null, final_expiry: null })
);

assert.deepEqual(oldRows.keysets[0], {
  id: a, unit: "sat", active: true, input_fee_ppk: 0, final_expiry: null
});
assert.deepEqual(snapshot(sat(a, true, { unknown_public_field: 42 })), snapshot(sat(a, true)));
assert.equal(snapshot(sat(a, false, { final_expiry: 0 })).keysets[0].final_expiry, 0);
assert.deepEqual(snapshot(), { keysets: [] });
const diffs = compare(oldRows, newRows);
assert.deepEqual(diffs.map(row => [row.unit, row.id, row.status]), [
  ["sat", a, "changed"], ["sat", c, "missing"], ["sat", b, "added"], ["usd", d, "unchanged"]
]);
assert.deepEqual(diffs[0].changes, ["active", "input_fee_ppk", "final_expiry"]);
assert.equal(diffs[0].before.active, true);
assert.equal(diffs[0].after.active, false);
assert.equal(diffs[1].after, null);
assert.equal(diffs[2].before, null);
assert.deepEqual(compare(newRows, { keysets: newRows.keysets.slice().reverse() }).map(x => x.status),
  ["unchanged", "unchanged", "unchanged"]);
const sameIDAcrossUnits = snapshot(sat(a, true), sat(a, true, { unit: "usd" }));
assert.deepEqual(compare(sameIDAcrossUnits, snapshot(sat(a, true))).map(x => x.status),
  ["unchanged", "missing"]);

assert.throws(() => parseSnapshot("cashuA-not-json"), /public \/v1\/keysets/);
assert.throws(() => parseSnapshot('{"proofs":[]}'), /keysets array/);
assert.throws(() => parseSnapshot('[]'), /object/);
assert.throws(() => snapshot(sat(a, true), sat(a, false)), /repeats/);
assert.throws(() => snapshot(sat(a, "false")), /active/);
assert.throws(() => snapshot(sat("", false)), /\.id/);
assert.throws(() => snapshot(sat(a, false, { unit: "sat\n" })), /\.unit/);
assert.throws(() => snapshot(sat(a, false, { final_expiry: "123" })), /final_expiry/);
assert.throws(() => snapshot(sat(a, false, { input_fee_ppk: -1 })), /input_fee_ppk/);
assert.throws(() => snapshot(sat(a, false, { input_fee_ppk: 0.2 })), /input_fee_ppk/);
assert.throws(() => snapshot(sat(a, false, { input_fee_ppk: Number.MAX_SAFE_INTEGER + 1 })), /input_fee_ppk/);
// Multiple active rows in a unit are valid. An unknown ID or unit is an opaque label.
assert.equal(snapshot(sat(a, true), sat(b, true), sat("future-format-id", true, { unit: "widgets" })).keysets.length, 3);

const f = (unit, count, input_fee_ppk) => ({ unit, count, input_fee_ppk });
// The NUT-02 example charges 1 sat for 3 inputs at 100 ppk.
assert.deepEqual(fee([f("sat", 3, 100)]), [{ unit: "sat", inputs: 3, total_ppk: 300, fee: 1 }]);
for (const [count, expected] of [[0, 0], [1, 1], [10, 1], [11, 2], [20, 2]]) {
  assert.equal(fee([f("sat", count, 100)])[0].fee, expected);
}
assert.deepEqual(fee([f("sat", 2, 100), f("sat", 2, 400), f("usd", 1, 1)]), [
  { unit: "sat", inputs: 4, total_ppk: 1000, fee: 1 },
  { unit: "usd", inputs: 1, total_ppk: 1, fee: 1 }
]);
assert.deepEqual(fee([f("sat", 2), f("sat", 2, null), f("sat", 2, 0)]), [
  { unit: "sat", inputs: 6, total_ppk: 0, fee: 0 }
]);
assert.deepEqual(fee([]), []);
assert.throws(() => fee([f("sat", -1, 5)]), /count/);
assert.throws(() => fee([f("sat", 1.5, 5)]), /count/);
assert.throws(() => fee([f("sat", 1, "100")]), /input_fee_ppk/);
assert.throws(() => fee([f("sat", 1, Number.NaN)]), /input_fee_ppk/);
assert.throws(() => fee([f("sat", 2, Number.MAX_SAFE_INTEGER)]), /Total ppk/);
assert.throws(() => fee([f("sat", Number.MAX_SAFE_INTEGER, 0), f("sat", 1, 0)]), /Input count/);
assert.equal(fee([f("sat", 1, Number.MAX_SAFE_INTEGER)])[0].fee, 9007199254741);

const browserContext = {};
vm.runInNewContext(fs.readFileSync(require.resolve("./rotation.js"), "utf8"), browserContext);
assert.equal(browserContext.RotationLab.fee([f("sat", 3, 100)])[0].fee, 1);
console.log("Cashu rotation core assertions passed.");
