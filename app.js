(() => {
  "use strict";
  const el = id => document.getElementById(id);
  function node(tag, text) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    return result;
  }
  const oldSat = { id: "00a1b2c3d4e5f601", unit: "sat", active: true, input_fee_ppk: 100 };
  const newSat = { id: "00a1b2c3d4e5f602", unit: "sat", active: true, input_fee_ppk: 500 };
  const usd = { id: "00a1b2c3d4e5f603", unit: "usd", active: true, input_fee_ppk: 0 };
  const samples = {
    before: { keysets: [oldSat, usd] },
    after: { keysets: [{ ...oldSat, active: false }, newSat, usd] }
  };
  for (const [name, snapshot] of Object.entries(samples)) {
    el(name).value = JSON.stringify(snapshot, null, 2);
  }
  function buildTable(headers) {
    const table = node("table");
    const head = table.createTHead().insertRow();
    for (const label of headers) {
      const cell = node("th", label);
      cell.scope = "col";
      head.append(cell);
    }
    return { table, body: table.createTBody() };
  }
  function describe(row) {
    if (!row) return "Absent from snapshot";
    let text = (row.active ? "Active" : "Inactive") + " · " + row.input_fee_ppk + " ppk";
    if (row.final_expiry !== null) {
      const stamp = new Date(row.final_expiry * 1000);
      const formatted = Number.isFinite(stamp.getTime()) ? stamp.toISOString().slice(0, 10) + " UTC" : String(row.final_expiry);
      text += " · final expiry " + formatted;
    }
    return text;
  }
  function renderDiff(diff) {
    const root = el("changes");
    root.replaceChildren();
    if (!diff.length) {
      root.append(node("p", "Both snapshots contain zero keysets."));
      return;
    }
    const labels = { added: "Newly listed", missing: "No longer listed", changed: "Updated", unchanged: "Unchanged" };
    const { table, body } = buildTable(["Keyset ID", "Unit", "Before", "After", "Change"]);
    for (const row of diff) {
      const line = body.insertRow();
      const key = node("th"); key.scope = "row"; key.append(node("code", row.id)); line.append(key);
      for (const value of [row.unit, describe(row.before), describe(row.after), labels[row.status]]) {
        line.insertCell().textContent = value;
      }
    }
    const scroller = node("div");
    scroller.className = "table-scroll";
    scroller.append(table);
    root.append(scroller);
    if (diff.some(r => !r.after)) root.append(node("p", "A missing row only tells you what this snapshot lists. It cannot establish whether a proof was spent."));
  }
  function renderFees(snapshot) {
    const root = el("fees");
    root.replaceChildren();
    const rows = snapshot.keysets;
    if (!rows.length) { root.append(node("p", "The later snapshot contains no keysets to model.")); return; }
    const units = [...new Set(rows.map(r => r.unit))].sort();
    const label = node("label", "Transaction unit ");
    const select = node("select"); select.id = "fee-unit"; label.htmlFor = select.id;
    for (const unit of units) {
      const option = node("option", unit); option.value = unit; select.append(option);
    }
    if (units.includes("sat")) select.value = "sat";
    root.append(label, select);
    const form = node("div"); root.append(form);
    const values = new Map();
    function draw() {
      form.replaceChildren();
      const group = rows.filter(r => r.unit === select.value);
      const fields = [];
      const { table, body } = buildTable(["Input keyset", "Rate", "Proof count"]);
      for (const row of group) {
        const key = JSON.stringify([row.unit, row.id]);
        const line = body.insertRow();
        const cell = node("th"); cell.scope = "row"; cell.append(node("code", row.id)); line.append(cell);
        line.insertCell().textContent = row.input_fee_ppk + " ppk";
        const input = node("input"); input.type = "number"; input.min = "0"; input.step = "1";
        input.setAttribute("aria-label", "Proof count for " + row.unit + " keyset " + row.id);
        const count = row.id === oldSat.id ? 2 : row.id === newSat.id ? 1 : 0;
        input.value = values.get(key) ?? String(count);
        line.insertCell().append(input);
        fields.push({ row, input });
        input.addEventListener("input", () => { values.set(key, input.value); recalculate(); });
      }
      const scroller = node("div"); scroller.className = "table-scroll"; scroller.append(table);
      const out = node("output"); out.className = "fee-total"; out.setAttribute("aria-live", "polite");
      const detail = node("p");
      function recalculate() {
        try {
          const inputs = fields.map(({ row, input }) => {
            if (!/^[0-9]+$/.test(input.value)) throw new Error("Enter a whole number of proofs, zero or more.");
            return { ...row, count: Number(input.value) };
          });
          const [result] = RotationLab.fee(inputs);
          const unitText = { usd: "US cents", eur: "euro cents", sat: "sat", msat: "msat" };
          out.textContent = "Input fee: " + result.fee + " " + (Object.hasOwn(unitText, result.unit) ? unitText[result.unit] : "base units (" + result.unit + ")");
          detail.textContent = result.inputs + " proofs · " + result.total_ppk + " ppk in total · round up once after dividing by 1,000.";
        } catch (error) {
          out.textContent = error.message;
          detail.textContent = "";
        }
      }
      form.append(scroller, out, detail);
      recalculate();
    }
    select.addEventListener("change", draw);
    draw();
  }
  function compare() {
    const parsed = {};
    for (const name of ["before", "after"]) el(name).removeAttribute("aria-invalid");
    for (const name of ["before", "after"]) {
      try { parsed[name] = RotationLab.parseSnapshot(el(name).value); }
      catch (error) {
        el(name).setAttribute("aria-invalid", "true");
        el("changes").replaceChildren(); el("fees").replaceChildren();
        el("status").textContent = (name === "before" ? "Before rotation" : "After rotation") + ": " + error.message;
        return;
      }
    }
    const diff = RotationLab.compare(parsed.before, parsed.after);
    renderDiff(diff);
    renderFees(parsed.after);
    const changes = diff.filter(row => row.status !== "unchanged").length;
    el("status").textContent = changes + (changes === 1 ? " keyset changed" : " keysets changed") + " across " + diff.length + " compared.";
  }
  el("compare").addEventListener("click", compare);
  compare();
})();
