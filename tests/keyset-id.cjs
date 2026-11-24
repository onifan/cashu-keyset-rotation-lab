"use strict";
const assert = require("node:assert/strict");
const check = require("../keyset-id.js");
const vectors = require("./nut02-vectors.json");

async function main() {
  for (const { key_group, ...published } of vectors.cases) {
    const keys = vectors.key_groups[key_group];
    const reversed = Object.fromEntries(Object.entries(keys).reverse());
    const result = await check({ ...published, keys: reversed });
    assert.equal(result.derived, published.id);
    assert.equal(result.matches, true);
    assert.equal(result.count, Object.keys(keys).length);
  }
  const [legacy, , modern, , noMetadata] = vectors.cases;
  const keys = vectors.key_groups[0];
  const modified = await check({ ...modern, keys, input_fee_ppk: 101 });
  assert.equal(modified.matches, false);
  assert.notEqual(modified.derived, modern.id);
  const normalized = await check({ ...modern, keys, unit: "SAT" });
  assert.equal(normalized.matches, true);
  assert.equal((await check({ ...legacy, keys, input_fee_ppk: 101 })).matches, true);
  for (const fee of [null, undefined, 0]) {
    assert.equal((await check({ ...noMetadata, keys: vectors.key_groups[1],
      input_fee_ppk: fee, final_expiry: null })).matches, true);
  }
  await assert.rejects(check({ ...modern, keys: {} }), /public keys object/);
  await assert.rejects(check({ ...modern, keys: { "02": keys["1"] } }), /positive decimal/);
  await assert.rejects(check({ ...modern, keys: { "1": "00" } }), /compressed public key/);
  await assert.rejects(check({ ...modern, keys, input_fee_ppk: -1 }), /nonnegative/);
  await assert.rejects(check({ ...modern, keys, final_expiry: "2059210353" }), /nonnegative/);
  await assert.rejects(check({ ...modern, keys, id: "02" }), /Expected/);
  console.log("All five official NUT-02 vectors and metadata/format checks passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
