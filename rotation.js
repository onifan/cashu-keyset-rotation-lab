/* Cashu Keyset Rotation Lab · NUT-02 public metadata and input-fee arithmetic. */
(function () {
  "use strict";

  const tracked = ["active", "input_fee_ppk", "final_expiry"];
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);

  function record(value, at) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError(at + " must be an object.");
    }
    return value;
  }

  function label(value, at) {
    if (typeof value !== "string" || !value || value.trim() !== value ||
        /[\u0000-\u001f\u007f]/.test(value)) {
      throw new TypeError(at + " must be a nonempty identifier without surrounding whitespace or control characters.");
    }
    return value;
  }

  function nonnegative(value, at) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(at + " must be a nonnegative safe integer.");
    }
    return value === 0 ? 0 : value;
  }

  function rate(value, at) {
    return value == null ? 0 : nonnegative(value, at);
  }

  function normalizeSnapshot(input) {
    const snapshot = record(input, "Snapshot");
    if (!Array.isArray(snapshot.keysets)) {
      throw new TypeError("Expected a public /v1/keysets snapshot with a keysets array.");
    }
    const seen = new Set();
    const keysets = snapshot.keysets.map(function (value, index) {
      const at = "keysets[" + index + "]";
      const row = record(value, at);
      const id = label(row.id, at + ".id");
      const unit = label(row.unit, at + ".unit");
      const identity = JSON.stringify([unit, id]);
      if (seen.has(identity)) {
        throw new Error(at + " repeats a unit and keyset ID already present in this snapshot.");
      }
      seen.add(identity);
      if (typeof row.active !== "boolean") {
        throw new TypeError(at + ".active must be true or false.");
      }
      return {
        id: id,
        unit: unit,
        active: row.active,
        input_fee_ppk: rate(row.input_fee_ppk, at + ".input_fee_ppk"),
        final_expiry: row.final_expiry == null ? null : nonnegative(row.final_expiry, at + ".final_expiry")
      };
    });
    return { keysets: keysets };
  }

  /** Read only the public fields used by this lab. Does not authenticate IDs or validate public keys. */
  function parseSnapshot(text) {
    if (typeof text !== "string") throw new TypeError("Snapshot must be JSON text.");
    let input;
    try {
      input = JSON.parse(text);
    } catch (_) {
      throw new SyntaxError("Snapshot is not valid JSON. Paste the public /v1/keysets response.");
    }
    return normalizeSnapshot(input);
  }

  function alphabetical(a, b) {
    return a === b ? 0 : a < b ? -1 : 1;
  }

  function indexSnapshot(snapshot) {
    const rows = normalizeSnapshot(snapshot).keysets;
    return new Map(rows.map(row => [JSON.stringify([row.unit, row.id]), row]));
  }

  /** Compare (unit, id) pairs. A missing row records absence from the later snapshot only. */
  function compare(before, after) {
    const left = indexSnapshot(before);
    const right = indexSnapshot(after);
    const keys = new Set([...left.keys(), ...right.keys()]);
    const result = [];
    for (const key of keys) {
      const oldRow = left.get(key) || null;
      const newRow = right.get(key) || null;
      const row = newRow || oldRow;
      const changes = oldRow && newRow ? tracked.filter(field => oldRow[field] !== newRow[field]) : [];
      let status = "unchanged";
      if (!oldRow) status = "added";
      else if (!newRow) status = "missing";
      else if (changes.length) status = "changed";
      result.push({ id: row.id, unit: row.unit, before: oldRow, after: newRow, status: status, changes: changes });
    }
    return result.sort((a, b) => alphabetical(a.unit, b.unit) || alphabetical(a.id, b.id));
  }

  function safeResult(value, field) {
    if (value > maxSafe) {
      throw new RangeError(field + " exceeds the safe integer range. Reduce the input count or fee rate.");
    }
    return Number(value);
  }

  /** Counts of inputs per keyset. Each output row represents a separate single-unit hypothetical transaction. */
  function fee(rows) {
    if (!Array.isArray(rows)) throw new TypeError("Fee inputs must be an array.");
    const totals = new Map();
    for (const [index, value] of rows.entries()) {
      const at = "rows[" + index + "]";
      const row = record(value, at);
      const unit = label(row.unit, at + ".unit");
      const count = BigInt(nonnegative(row.count, at + ".count"));
      const ppk = BigInt(rate(row.input_fee_ppk, at + ".input_fee_ppk"));
      const total = totals.get(unit) || { inputs: 0n, ppk: 0n };
      total.inputs += count;
      total.ppk += count * ppk;
      totals.set(unit, total);
    }
    return Array.from(totals, function ([unit, total]) {
      return {
        unit: unit,
        inputs: safeResult(total.inputs, "Input count"),
        total_ppk: safeResult(total.ppk, "Total ppk"),
        fee: safeResult((total.ppk + 999n) / 1000n, "Fee")
      };
    }).sort((a, b) => alphabetical(a.unit, b.unit));
  }

  const api = Object.freeze({ parseSnapshot, compare, fee });
  if (typeof module === "object" && module.exports) module.exports = api;
  else globalThis.RotationLab = api;
})();
