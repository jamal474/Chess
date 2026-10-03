// Dev-only launcher on the menu page: start a one-tab ("solo") game, empty
// or straight at a saved position. Also handles deep links:
//
//   /chess/?dev=solo                     empty solo game
//   /chess/?dev=scholars-mate            saved game, at its default ply
//   /chess/?dev=scholars-mate&ply=4      …at ply 4
//   add &as=black to sit on Black's side of the board

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PLAYER1, PLAYER2, type PlayerId } from "../lib/types";
import {
  clearDevFlags,
  listGames,
  prepareSoloGame,
  seatFromParam,
  type SavedGame,
} from "./devClient";

export default function DevMenu() {
  const nav = useNavigate();
  const [games, setGames] = useState<SavedGame[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [seat, setSeat] = useState<PlayerId>(PLAYER1);
  const handledLink = useRef(false);

  useEffect(() => {
    // StrictMode runs this effect twice. Once a deep link has been followed,
    // do nothing more: in particular don't clearDevFlags() below, which would
    // undo the solo setup (by then the URL no longer carries ?dev=).
    if (handledLink.current) return;

    // Deep link: jump straight into a solo game.
    const params = new URLSearchParams(window.location.search);
    const dev = params.get("dev");
    if (dev) {
      handledLink.current = true;
      const ply = params.get("ply");
      prepareSoloGame({
        as: seatFromParam(params.get("as")),
        load:
          dev === "solo"
            ? undefined
            : { name: dev, ...(ply !== null && /^\d+$/.test(ply) ? { ply: Number(ply) } : {}) },
      });
      nav("/game", { replace: true });
      return;
    }
    clearDevFlags();
    listGames().then((r) => {
      if (!r.ok) return setError(r.error ?? "couldn't list games");
      setGames(r.games ?? []);
    });
  }, [nav]);

  const game = games.find((g) => g.name === selected);

  function start() {
    prepareSoloGame({ as: seat, load: game ? { name: game.name } : undefined });
    nav("/game");
  }

  return (
    <section className="px-6 pb-6 flex justify-center">
      <div className="w-full max-w-4xl border-3 border-dashed border-black bg-white/90 p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="label bg-accent border-2 border-black px-1.5 self-start">DEV</span>
          <span className="font-display text-lg leading-none">SOLO GAME</span>
          <span className="text-xs opacity-70">One tab, both sides.</span>
        </div>

        <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
          <span className="label">START FROM</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="border-3 border-black bg-white px-2 py-2 font-mono text-sm"
          >
            <option value="">Starting position</option>
            {games.map((g) => (
              <option key={g.name} value={g.name} disabled={Boolean(g.error)}>
                {g.title} · {g.error ? "unreadable" : `ply ${g.defaultPly}/${g.plies}`}
              </option>
            ))}
          </select>
          {game?.description && <span className="text-xs opacity-70">{game.description}</span>}
          {error && <span className="label text-red-600">{error}</span>}
        </label>

        <div className="flex flex-col gap-1">
          <span className="label">SIT AS</span>
          <div className="flex">
            {[PLAYER1, PLAYER2].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSeat(p)}
                aria-pressed={seat === p}
                className={[
                  // Not `.label`: it pins the text colour to black.
                  "border-3 border-black px-3 py-2 -ml-[3px] first:ml-0",
                  "text-[11px] font-bold tracking-[0.12em] uppercase",
                  seat === p ? "bg-black text-white" : "bg-white text-black",
                ].join(" ")}
              >
                {p === PLAYER1 ? "WHITE" : "BLACK"}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={start} className="btn btn-accent py-2">
          START SOLO →
        </button>

        <p className="basis-full text-xs font-mono opacity-60">
          Tip: link straight to a position with <code>?dev=&lt;game&gt;&amp;ply=&lt;n&gt;</code>.
          Games live in <code>dev/games/*.pgn</code>.
        </p>
      </div>
    </section>
  );
}
