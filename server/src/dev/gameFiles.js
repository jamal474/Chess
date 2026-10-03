// Reads and writes PGN fixtures in the dev games folder (dev/games/ at the
// repo root by default, overridable with DEV_GAMES_DIR).

const fs = require("fs/promises");
const path = require("path");
const { parsePgn } = require("./pgn");

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

class GameFiles {
  constructor(dir) {
    this.dir = dir;
  }

  static validName(name) {
    return typeof name === "string" && NAME_RE.test(name);
  }

  _file(name) {
    if (!GameFiles.validName(name)) {
      throw new Error("game names use lowercase letters, digits, - and _ (e.g. scholars-mate)");
    }
    return path.join(this.dir, `${name}.pgn`);
  }

  async list() {
    let entries;
    try {
      entries = await fs.readdir(this.dir);
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
    const out = [];
    for (const f of entries.filter((e) => e.endsWith(".pgn")).sort()) {
      const name = f.slice(0, -4);
      try {
        const { tags, moves } = parsePgn(await fs.readFile(path.join(this.dir, f), "utf8"));
        out.push({
          name,
          title: tags.Event && tags.Event !== "?" ? tags.Event : name,
          description: tags.Description || "",
          plies: moves.length,
          defaultPly: defaultPly(tags, moves),
        });
      } catch (err) {
        out.push({ name, title: name, description: "", plies: 0, defaultPly: 0, error: err.message });
      }
    }
    return out;
  }

  async read(name) {
    let text;
    try {
      text = await fs.readFile(this._file(name), "utf8");
    } catch (err) {
      if (err.code === "ENOENT") throw new Error(`no saved game called "${name}" in ${this.dir}`);
      throw err;
    }
    return parsePgn(text);
  }

  async write(name, text, { overwrite = false } = {}) {
    const file = this._file(name);
    await fs.mkdir(this.dir, { recursive: true });
    try {
      await fs.writeFile(file, text, { flag: overwrite ? "w" : "wx" });
    } catch (err) {
      if (err.code === "EEXIST") throw new Error(`"${name}.pgn" already exists`);
      throw err;
    }
    return file;
  }
}

function defaultPly(tags, moves) {
  const n = Number(tags.Ply);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, moves.length) : moves.length;
}

module.exports = { GameFiles, defaultPly };
