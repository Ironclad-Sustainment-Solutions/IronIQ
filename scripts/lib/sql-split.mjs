// Shared with run-schema.mjs -- splits a SQL script into individual
// top-level statements the same way psql effectively does when running
// each one as its own implicit transaction. Naive splitting on `;`
// breaks inside dollar-quoted function bodies, string/identifier
// literals, and comments, so this tracks those contexts explicitly.
// Extracted into its own module specifically so run-schema.mjs (fresh
// database setup) and scripts/apply-missing-schema-additions.mjs (safe
// catch-up on an already-partially-migrated database) share the exact
// same, already-tested parsing logic rather than two copies that could
// quietly drift apart.

export function splitStatements(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];

    // Line comment: copy through to end of line untouched.
    if (ch === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? n : end + 1;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Block comment (non-nested -- sufficient for this schema's usage).
    if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Single-quoted string literal, with '' as the escape for a literal quote.
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          j += 1;
          break;
        }
        j += 1;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // Double-quoted identifier.
    if (ch === '"') {
      let j = i + 1;
      while (j < n && sql[j] !== '"') j += 1;
      j = Math.min(j + 1, n);
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // Dollar-quoted string: $$ ... $$ or $tag$ ... $tag$.
    if (ch === "$") {
      const tagMatch = /^\$[a-zA-Z_]*\$/.exec(sql.slice(i));
      if (tagMatch) {
        const tag = tagMatch[0];
        const closeIdx = sql.indexOf(tag, i + tag.length);
        const stop = closeIdx === -1 ? n : closeIdx + tag.length;
        current += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }

    // Top-level statement terminator.
    if (ch === ";") {
      current += ch;
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = "";
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const trimmedTail = current.trim();
  if (trimmedTail.length > 0) statements.push(trimmedTail);
  return statements;
}
