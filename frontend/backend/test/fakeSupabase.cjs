"use strict";

/**
 * Minimal in-memory stand-in for the supabase-js query builder, covering
 * exactly the chain shapes this backend uses (.select/.eq/.ilike/.neq/.not/
 * .maybeSingle/.single/.insert/.update/.delete), so route handlers can be
 * exercised end-to-end via real HTTP without a live database. Not a general
 * Postgrest client — extend the matcher list if a new route needs one.
 */

const crypto = require("crypto");

function matches(row, filters) {
  return filters.every(({ type, col, val }) => {
    const rowVal = row[col];
    if (type === "eq") return rowVal === val;
    if (type === "neq") return rowVal !== val;
    if (type === "ilike") return String(rowVal ?? "").toLowerCase() === String(val).toLowerCase();
    if (type === "not-is-null") return rowVal !== null && rowVal !== undefined;
    if (type === "in") return Array.isArray(val) && val.includes(rowVal);
    return true;
  });
}

/** Parses Postgrest .or("and(a.eq.1,b.eq.2),and(a.eq.3,b.eq.4)") into OR-of-AND groups (eq only, sufficient for this codebase's usage). */
function parseOrExpression(expr) {
  const groups = [];
  const andBlocks = expr.match(/and\(([^)]*)\)/g) || [expr];
  for (const block of andBlocks) {
    const inner = block.startsWith("and(") ? block.slice(4, -1) : block;
    const conds = inner.split(",").map((cond) => {
      const [col, op, ...rest] = cond.split(".");
      return { col, op, val: rest.join(".") };
    });
    groups.push(conds);
  }
  return groups;
}

function matchesOrGroups(row, groups) {
  return groups.some((group) =>
    group.every(({ col, op, val }) => {
      const rowVal = row[col];
      if (op === "eq") return String(rowVal) === String(val);
      return true;
    })
  );
}

class FakeQuery {
  constructor(table, mode) {
    this.table = table;
    this.mode = mode; // "select" | "insert" | "update" | "delete"
    this.filters = [];
    this.payload = null;
    this.wantSingle = false;
    this.maybe = false;
  }

  select() {
    if (this.mode === null) this.mode = "select";
    return this;
  }
  eq(col, val) {
    this.filters.push({ type: "eq", col, val });
    return this;
  }
  neq(col, val) {
    this.filters.push({ type: "neq", col, val });
    return this;
  }
  ilike(col, val) {
    this.filters.push({ type: "ilike", col, val });
    return this;
  }
  not(col, op, val) {
    if (op === "is" && val === null) this.filters.push({ type: "not-is-null", col });
    return this;
  }
  or(expr) {
    this.orGroups = parseOrExpression(expr);
    return this;
  }
  in(col, vals) {
    this.filters.push({ type: "in", col, val: vals });
    return this;
  }
  insert(obj) {
    this.mode = "insert";
    this.payload = obj;
    return this;
  }
  update(obj) {
    this.mode = "update";
    this.payload = obj;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  maybeSingle() {
    this.maybe = true;
    this.wantSingle = true;
    return this;
  }
  single() {
    this.wantSingle = true;
    return this;
  }

  _run() {
    const rows = this.table.rows;
    if (this.mode === "insert") {
      const row = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...this.payload,
      };
      rows.push(row);
      return { data: this.wantSingle ? row : [row], error: null };
    }

    const passesRow = (r) =>
      matches(r, this.filters) && (!this.orGroups || matchesOrGroups(r, this.orGroups));
    const matched = rows.filter(passesRow);

    if (this.mode === "update") {
      matched.forEach((row) => Object.assign(row, this.payload));
      return { data: this.wantSingle ? matched[0] || null : matched, error: null };
    }

    if (this.mode === "delete") {
      const remaining = rows.filter((r) => !passesRow(r));
      this.table.rows.length = 0;
      this.table.rows.push(...remaining);
      return { data: matched, error: null };
    }

    // select
    if (this.wantSingle) {
      if (matched.length === 0) {
        return this.maybe ? { data: null, error: null } : { data: null, error: { message: "not found" } };
      }
      return { data: matched[0], error: null };
    }
    return { data: matched, error: null };
  }

  then(resolve, reject) {
    try {
      resolve(this._run());
    } catch (err) {
      reject ? reject(err) : Promise.reject(err);
    }
  }
}

function createFakeSupabase(seed = {}) {
  const tables = {};
  for (const [name, rows] of Object.entries(seed)) {
    tables[name] = { rows: rows.map((r) => ({ ...r })) };
  }

  return {
    _tables: tables,
    from(name) {
      if (!tables[name]) tables[name] = { rows: [] };
      return new FakeQuery(tables[name], null);
    },
  };
}

module.exports = { createFakeSupabase };
