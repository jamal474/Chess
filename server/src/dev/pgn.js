// PGN reading and writing for dev game files.
//
// Accepts ordinary PGN (what lichess / chess.com export) and is lenient about
// what it finds: move numbers, comments, variations, NAGs and the result
// token are all dropped, leaving just the move tokens. Moves may be SAN
// ("Nf3", "exd5", "e8=Q+") or coordinates ("g1f3", "e7e8q").
//
// Tags we read:
//   [Event "..."]        display name
//   [Description "..."]  one-line note shown in the dev panel
//   [Ply "N"]            default stop point (moves are loaded up to ply N)

/** @returns {{ tags: Record<string,string>, moves: string[] }} */
function parsePgn(text) {
  if (typeof text !== "string") throw new Error("PGN must be a string");
  const tags = {};
  let body = text.replace(/\r\n?/g, "\n");

  body = body.replace(/^\s*\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm, (_m, k, v) => {
    tags[k] = v.replace(/\\(.)/g, "$1");
    return "";
  });

  body = body
    .replace(/\{[^}]*\}/g, " ")   // {comments}
    .replace(/;[^\n]*/g, " ")     // ; line comments
    .replace(/\$\d+/g, " ");      // $NAGs
  body = stripVariations(body);

  const moves = [];
  for (let tok of body.split(/\s+/)) {
    if (!tok) continue;
    tok = tok.replace(/^\d+\.(\.\.)?/, ""); // "1." "1..." glued to a move
    if (!tok || /^\.+$/.test(tok)) continue;
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) continue;
    moves.push(tok);
  }
  return { tags, moves };
}

function stripVariations(s) {
  let out = "";
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

/** Builds PGN text from tags and SAN moves, wrapped at ~80 columns. */
function formatPgn(tags, sanMoves) {
  const head = Object.entries(tags)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `[${k} "${String(v).replace(/(["\\])/g, "\\$1")}"]`)
    .join("\n");

  const parts = [];
  sanMoves.forEach((m, i) => parts.push(i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m));
  parts.push("*");

  const lines = [];
  let line = "";
  for (const p of parts) {
    if (line && line.length + 1 + p.length > 80) {
      lines.push(line);
      line = p;
    } else {
      line = line ? `${line} ${p}` : p;
    }
  }
  if (line) lines.push(line);
  return `${head}\n\n${lines.join("\n")}\n`;
}

module.exports = { parsePgn, formatPgn };
