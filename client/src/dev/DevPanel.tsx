// Floating dev tools panel on the game page. DEV ONLY (see Game.tsx).
//
//   * Load a saved game (dev/games/*.pgn) or pasted PGN at any ply, and step
//     through it move by move. The relay replays the moves through the real
//     engine, so the position is exactly what playing them would give.
//   * Play both sides from this tab (hot seat).
//   * Copy the current game as PGN, or save it as a new fixture.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChessGame, DevSnapshot } from "../hooks/useChessGame";
import { socket } from "../lib/socket";
import {
  exportGame,
  listGames,
  loadGame,
  onDevResult,
  saveGame,
  type DevResult,
  type SavedGame,
} from "./devClient";

type Status = { kind: "ok" | "error" | "busy"; text: string } | null;
type Loaded = { name: string; pgn?: string; ply: number; total: number; tokens: string[] };

export default function DevPanel({ game }: { game: ChessGame }) {
  const [open, setOpen] = useState(() => sessionStorage.getItem("devPanelOpen") !== "false");
  const [games, setGames] = useState<SavedGame[]>([]);
  const [selected, setSelected] = useState("");
  const [pasted, setPasted] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const busy = status?.kind === "busy";

  const refreshGames = useCallback(() => {
    listGames().then((r) => {
      if (r.ok) setGames(r.games ?? []);
      else setStatus({ kind: "error", text: r.error ?? "couldn't list games" });
    });
  }, []);
  useEffect(refreshGames, [refreshGames]);

  useEffect(() => {
    sessionStorage.setItem("devPanelOpen", String(open));
  }, [open]);

  // Results of loads this panel didn't start (solo start from the menu / deep link).
  const applyResult = useCallback((r: DevResult, pgn?: string) => {
    if (r.tokens && r.name) {
      setLoaded({ name: r.name, pgn, ply: r.ply ?? 0, total: r.total ?? 0, tokens: r.tokens });
      if (r.name !== "pasted") setSelected(r.name);
    }
    if (r.ok) {
      setStatus(r.name ? { kind: "ok", text: `Loaded ${r.name} at ply ${r.ply}/${r.total}` } : null);
    } else {
      setStatus({ kind: "error", text: r.error ?? "failed" });
    }
  }, []);
  useEffect(() => onDevResult((r) => applyResult(r)), [applyResult]);

  // Keep ply in step when the other tab loads something.
  useEffect(() => {
    const onState = (s: DevSnapshot) =>
      setLoaded((prev) => (prev && prev.name === s.name ? { ...prev, ply: s.ply } : prev));
    socket.on("dev:state", onState);
    return () => {
      socket.off("dev:state", onState);
    };
  }, []);

  async function load(src: { name?: string; pgn?: string }, ply?: number) {
    setStatus({ kind: "busy", text: "Replaying…" });
    const r = await loadGame({ ...src, ply });
    applyResult(r, src.pgn);
  }

  const stepTo = (ply: number) => {
    if (!loaded || busy) return;
    const target = Math.max(0, Math.min(ply, loaded.total));
    load(loaded.pgn ? { pgn: loaded.pgn } : { name: loaded.name }, target);
  };

  async function copyPgn() {
    const r = await exportGame();
    if (!r.ok || !r.pgn) return setStatus({ kind: "error", text: r.error ?? "export failed" });
    await navigator.clipboard.writeText(r.pgn);
    setStatus({ kind: "ok", text: `Copied ${r.plies} plies as PGN` });
  }

  async function save(overwrite = false) {
    const r = await saveGame(saveName.trim(), saveDesc.trim(), overwrite);
    if (!r.ok) {
      if (r.error?.includes("already exists") && window.confirm(`${r.error}. Overwrite it?`)) {
        return save(true);
      }
      return setStatus({ kind: "error", text: r.error ?? "save failed" });
    }
    setStatus({ kind: "ok", text: `Saved ${r.plies} plies to ${r.file}` });
    refreshGames();
  }

  const selectedGame = games.find((g) => g.name === selected);

  // Tokens grouped into numbered move pairs for the clickable move list.
  const pairs = useMemo(() => {
    const t = loaded?.tokens ?? [];
    const out: { n: number; plies: [number, string][] }[] = [];
    t.forEach((tok, i) => {
      if (i % 2 === 0) out.push({ n: i / 2 + 1, plies: [] });
      out[out.length - 1].plies.push([i + 1, tok]);
    });
    return out;
  }, [loaded?.tokens]);

  const header = (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={[
        "w-full bg-accent px-3 py-1.5 flex items-center justify-between text-left",
        open ? "border-b-3 border-black" : "",
      ].join(" ")}
      title={open ? "Collapse dev tools" : "Expand dev tools"}
    >
      <span className="label">
        DEV TOOLS
        {loaded && <span className="opacity-60"> · {loaded.name} · ply {loaded.ply}/{loaded.total}</span>}
      </span>
      <span className="label">{open ? "▾" : "▸"}</span>
    </button>
  );

  if (!open) return <div className="brut shrink-0">{header}</div>;

  return (
    // Sits in the sidebar between the move log and the chat; scrolls inside
    // itself so it never pushes those off screen.
    <div className="brut shrink min-h-0 max-h-[55%] flex flex-col text-sm">
      {header}

      <div className="overflow-y-auto p-3 flex flex-col gap-3">
        {/* Status first, so errors are visible without scrolling the panel. */}
        {status && (
          <p
            className={[
              "text-xs font-mono border-2 border-black px-2 py-1",
              status.kind === "error" ? "bg-red-100" : status.kind === "busy" ? "bg-white" : "bg-lime-100",
            ].join(" ")}
          >
            {status.text}
          </p>
        )}
        {/* Hot seat */}
        {game.dev && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={game.dev.hotSeat}
              onChange={(e) => game.dev!.setHotSeat(e.target.checked)}
              className="w-4 h-4 accent-black"
            />
            <span>
              <b>Play both sides</b>
              <span className="opacity-60"> · you move for whoever is to play</span>
            </span>
          </label>
        )}

        {/* Load */}
        <fieldset className="border-t-3 border-black pt-2 flex flex-col gap-2">
          <legend className="label pr-2">LOAD A POSITION</legend>
          <div className="flex gap-2">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="flex-1 min-w-0 border-2 border-black px-1.5 py-1 font-mono text-xs"
            >
              <option value="">Saved game…</option>
              {games.map((g) => (
                <option key={g.name} value={g.name} disabled={Boolean(g.error)}>
                  {g.title} ({g.error ? "unreadable" : `${g.plies} plies`})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selected || busy}
              onClick={() => load({ name: selected })}
              className="btn btn-primary py-1 px-3 text-xs"
            >
              LOAD
            </button>
          </div>
          {selectedGame?.description && <p className="text-xs opacity-70 -mt-1">{selectedGame.description}</p>}
          {selectedGame?.error && <p className="text-xs text-red-600 -mt-1">{selectedGame.error}</p>}

          <details>
            <summary className="label cursor-pointer">OR PASTE PGN / MOVES</summary>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={"1. e4 e5 2. Nf3 Nc6\nor: e2e4 e7e5 g1f3"}
              rows={4}
              className="mt-1 w-full border-2 border-black p-1.5 font-mono text-xs resize-y"
            />
            <button
              type="button"
              disabled={!pasted.trim() || busy}
              onClick={() => load({ pgn: pasted })}
              className="btn py-1 px-3 text-xs"
            >
              LOAD PASTED
            </button>
          </details>
        </fieldset>

        {/* Stepper */}
        {loaded && (
          <fieldset className="border-t-3 border-black pt-2 flex flex-col gap-2">
            <legend className="label pr-2">
              {loaded.name.toUpperCase()} · PLY {loaded.ply}/{loaded.total}
            </legend>
            <div className="flex items-center gap-1">
              {[
                ["⏮", 0, "Start"],
                ["◀", loaded.ply - 1, "Back one ply"],
                ["▶", loaded.ply + 1, "Forward one ply"],
                ["⏭", loaded.total, "End"],
              ].map(([label, ply, title]) => (
                <button
                  key={title as string}
                  type="button"
                  title={title as string}
                  disabled={busy}
                  onClick={() => stepTo(ply as number)}
                  className="border-2 border-black w-8 h-7 hover:bg-black hover:text-white disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
              <input
                type="range"
                min={0}
                max={loaded.total}
                value={loaded.ply}
                disabled={busy}
                onChange={(e) => setLoaded({ ...loaded, ply: Number(e.target.value) })}
                onPointerUp={(e) => stepTo(Number((e.target as HTMLInputElement).value))}
                onKeyUp={(e) => stepTo(Number((e.target as HTMLInputElement).value))}
                className="flex-1 accent-black"
              />
            </div>
            <ol className="font-mono text-xs leading-6 max-h-28 overflow-y-auto">
              {pairs.map((p) => (
                <li key={p.n} className="inline mr-1.5">
                  <span className="opacity-50">{p.n}.</span>
                  {p.plies.map(([ply, tok]) => (
                    <button
                      key={ply}
                      type="button"
                      disabled={busy}
                      onClick={() => stepTo(ply)}
                      title={`Go to the position after ${tok}`}
                      className={[
                        "px-1 ml-0.5",
                        ply === loaded.ply ? "bg-black text-white" : "hover:bg-accent",
                        ply > loaded.ply ? "opacity-40" : "",
                      ].join(" ")}
                    >
                      {tok}
                    </button>
                  ))}
                </li>
              ))}
            </ol>
          </fieldset>
        )}

        {/* Save */}
        <fieldset className="border-t-3 border-black pt-2 flex flex-col gap-2">
          <legend className="label pr-2">SAVE THIS GAME</legend>
          <div className="flex flex-wrap gap-2">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))}
              placeholder="file-name"
              aria-label="File name"
              className="w-36 border-2 border-black px-1.5 py-1 font-mono text-xs"
            />
            <input
              value={saveDesc}
              onChange={(e) => setSaveDesc(e.target.value)}
              placeholder="Description (optional)"
              aria-label="Description"
              className="flex-1 min-w-[140px] border-2 border-black px-1.5 py-1 text-xs"
            />
            <button
              type="button"
              disabled={!saveName.trim()}
              onClick={() => save()}
              className="btn btn-primary py-1 px-3 text-xs"
              title="Write dev/games/<file-name>.pgn"
            >
              SAVE
            </button>
            <button type="button" onClick={copyPgn} className="btn py-1 px-3 text-xs" title="Copy the moves so far as PGN">
              COPY PGN
            </button>
          </div>
        </fieldset>


      </div>
    </div>
  );
}
