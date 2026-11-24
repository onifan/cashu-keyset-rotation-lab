/* NUT-02 keyset ID derivation from public keys. Uses the browser's SHA-256. */
(function () {
  "use strict";

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function optionalInteger(value, name) {
    if (value == null) return 0;
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(name + " must be a nonnegative safe integer or null.");
    }
    return value;
  }

  async function checkKeyset(row) {
    if (!isRecord(row)) throw new TypeError("Paste one public keyset object.");
    if (typeof row.id !== "string" || !/^(00[0-9a-f]{14}|01[0-9a-f]{64})$/i.test(row.id)) {
      throw new TypeError("Expected an 8-byte V1 ID (00) or a 33-byte V2 ID (01).");
    }
    if (!isRecord(row.keys) || !Object.keys(row.keys).length) {
      throw new TypeError("Provide the public keys object indexed by denomination.");
    }

    const pairs = Object.entries(row.keys).map(([amount, key]) => {
      if (!/^[1-9][0-9]*$/.test(amount)) {
        throw new TypeError("Denominations must be positive decimal integers without leading zeroes.");
      }
      if (typeof key !== "string" || !/^(02|03)[0-9a-f]{64}$/i.test(key)) {
        throw new TypeError("Each denomination needs a 33-byte compressed public key in hex.");
      }
      return [amount, key.toLowerCase()];
    });
    // Canonical decimals sort numerically by length then digits, including amounts beyond 2^53.
    pairs.sort(([a], [b]) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
    const announced = row.id.toLowerCase();
    const v1 = announced.startsWith("00");
    let bytes;
    if (v1) {
      const joined = pairs.map(pair => pair[1]).join("");
      bytes = Uint8Array.from(joined.match(/../g), hex => parseInt(hex, 16));
    } else {
      if (typeof row.unit !== "string" || !row.unit || /[\s|]/u.test(row.unit)) {
        throw new TypeError("V2 needs the unit from the mint's public keyset metadata.");
      }
      const fee = optionalInteger(row.input_fee_ppk, "input_fee_ppk");
      const expiry = optionalInteger(row.final_expiry, "final_expiry");
      let text = pairs.map(([amount, key]) => amount + ":" + key).join(",");
      text += "|unit:" + row.unit.toLowerCase();
      if (fee) text += "|input_fee_ppk:" + fee;
      if (expiry) text += "|final_expiry:" + expiry;
      bytes = new TextEncoder().encode(text);
    }
    if (!globalThis.crypto?.subtle) {
      throw new Error("This browser needs HTTPS, localhost or a supported local file to calculate SHA-256.");
    }
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hex = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
    const derived = v1 ? "00" + hex.slice(0, 14) : "01" + hex;
    return { version: v1 ? 1 : 2, derived, matches: derived === announced, count: pairs.length };
  }

  if (typeof module === "object" && module.exports) module.exports = checkKeyset;
  else globalThis.checkCashuKeyset = checkKeyset;
})();
