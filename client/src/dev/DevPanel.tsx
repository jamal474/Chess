// Floating dev tools panel on the game page. DEV ONLY (see Game.tsx).
//
//   * Load a saved game (dev/games/*.pgn) or pasted PGN at any ply, and step
//     through it move by move. The relay replays the moves through the real
//     engine, so the position is exactly what playing them would give.
//   * Play both sides from this tab (hot seat).
//   * Copy the current game as PGN, or save it as a new fixture.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

  const LBL = "text-[11px] font-bold tracking-[0.12em] uppercase";
  const field = "w-full border-2 border-black bg-white px-2 py-1.5 text-[13px] outline-none focus:bg-accent/30";
  const flatBtn =
    "border-2 border-black px-3 py-1.5 text-[11px] font-bold tracking-[0.1em] uppercase disabled:opacity-40 disabled:cursor-not-allowed";
  const primaryBtn = `${flatBtn} bg-black text-white hover:enabled:bg-accent hover:enabled:text-black`;
  const plainBtn = `${flatBtn} bg-white hover:enabled:bg-accent`;

  const summary = loaded ? `${loaded.name} · ${loaded.ply}/${loaded.total}` : null;

  // Closed: a small tab in the corner, out of the way of the board and panels.
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Open dev tools"
        className="fixed bottom-3 left-3 z-40 flex items-center gap-2 border-3 border-black bg-accent px-3 py-2 shadow-brut hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brut-sm transition-transform"
      >
        <span className={LBL}>⚙ DEV</span>
        {summary && <span className="font-mono text-[11px] opacity-70 max-w-[160px] truncate">{summary}</span>}
      </button>
    );
  }

  return (
    // Floating drawer: dev builds only, never part of the layout.
    <div
      role="dialog"
      aria-label="Dev tools"
      className="fixed bottom-3 left-3 z-40 w-[min(380px,calc(100vw-24px))] max-h-[min(680px,calc(100vh-88px))] flex flex-col border-3 border-black bg-white shadow-brut-lg text-[13px]"
    >
      <div className="shrink-0 flex items-center gap-2 bg-accent border-b-3 border-black pl-3 pr-1.5 py-1.5">
        <span className={LBL}>⚙ DEV TOOLS</span>
        {summary && <span className="font-mono text-[11px] opacity-70 truncate min-w-0">{summary}</span>}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close dev tools"
          className="ml-auto shrink-0 w-7 h-7 border-2 border-black bg-white font-bold leading-none hover:bg-black hover:text-white"
        >
          ✕
        </button>
      </div>

      {status && (
        <p
          role="status"
          className={[
            "shrink-0 m-0 px-3 py-2 border-b-3 border-black font-mono text-xs break-words",
            status.kind === "error" ? "bg-red-100" : status.kind === "busy" ? "bg-white" : "bg-lime-100",
          ].join(" ")}
        >
          {status.kind === "error" ? "✕ " : status.kind === "busy" ? "… " : "✓ "}
          {status.text}
        </p>
      )}

      <div className="overflow-y-auto min-h-0">
        {game.dev && (
          <Section title="Seat">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={game.dev.hotSeat}
                onChange={(e) => game.dev!.setHotSeat(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-black shrink-0"
              />
              <span className="leading-snug">
                <b>Play both sides</b>
                <br />
                <span className="opacity-70">You move for whoever is to play.</span>
              </span>
            </label>
          </Section>
        )}

        <Section title="Load a position">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="Saved game"
            className={`${field} font-mono`}
          >
            <option value="">Choose a saved game…</option>
            {games.map((g) => (
              <option key={g.name} value={g.name} disabled={Boolean(g.error)}>
                {g.title} ({g.error ? "unreadable" : `${g.plies} plies`})
              </option>
            ))}
          </select>
          {selectedGame?.description && <p className="m-0 text-xs opacity-70">{selectedGame.description}</p>}
          {selectedGame?.error && <p className="m-0 text-xs text-red-600">{selectedGame.error}</p>}
          <button
            type="button"
            disabled={!selected || busy}
            onClick={() => load({ name: selected })}
            className={primaryBtn}
          >
            LOAD GAME
          </button>

          <details className="group">
            <summary className={`${LBL} text-[10px] cursor-pointer opacity-70 select-none py-1`}>
              Or paste PGN / moves
            </summary>
            <div className="flex flex-col gap-2 pt-1">
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder={"1. e4 e5 2. Nf3 Nc6\nor: e2e4 e7e5 g1f3"}
                aria-label="PGN or moves"
                rows={3}
                className={`${field} font-mono text-xs resize-y`}
              />
              <button
                type="button"
                disabled={!pasted.trim() || busy}
                onClick={() => load({ pgn: pasted })}
                className={plainBtn}
              >
                LOAD PASTED
              </button>
            </div>
          </details>
        </Section>

        {loaded && (
          <Section title={`Step through · ply ${loaded.ply} of ${loaded.total}`}>
            <div className="grid grid-cols-4 gap-1.5">
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
                  aria-label={title as string}
                  disabled={busy}
                  onClick={() => stepTo(ply as number)}
                  className="h-8 border-2 border-black bg-white hover:enabled:bg-black hover:enabled:text-white disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={loaded.total}
              value={loaded.ply}
              disabled={busy}
              aria-label="Ply"
              onChange={(e) => setLoaded({ ...loaded, ply: Number(e.target.value) })}
              onPointerUp={(e) => stepTo(Number((e.target as HTMLInputElement).value))}
              onKeyUp={(e) => stepTo(Number((e.target as HTMLInputElement).value))}
              className="w-full accent-black"
            />
            <ol className="m-0 p-2 list-none border-2 border-black bg-[#fafafa] font-mono text-xs leading-6 max-h-32 overflow-y-auto">
              {pairs.map((p) => (
                <li key={p.n} className="inline-block mr-2 whitespace-nowrap">
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
          </Section>
        )}

        <Section title="Save this game">
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">File name (dev/games/…pgn)</span>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))}
              placeholder="pinned-knight"
              className={`${field} font-mono`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Description (optional)</span>
            <input
              value={saveDesc}
              onChange={(e) => setSaveDesc(e.target.value)}
              placeholder="What this position is for"
              className={field}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!saveName.trim()}
              onClick={() => save()}
              className={primaryBtn}
              title="Write dev/games/<file-name>.pgn"
            >
              SAVE
            </button>
            <button type="button" onClick={copyPgn} className={plainBtn} title="Copy the moves so far as PGN">
              COPY PGN
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

/** One titled block of the drawer. Top level, so its inputs keep focus across renders. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 px-3 py-3 border-t-3 border-black first:border-t-0">
      <h3 className="m-0 text-[11px] font-bold tracking-[0.12em] uppercase">{title}</h3>
      {children}
    </section>
  );
}
