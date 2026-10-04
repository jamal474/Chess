import { useEffect, useState } from "react";
import type { Country } from "../lib/types";
import type { LobbyStats } from "../hooks/useLobbyStats";
import type { MatchState } from "../hooks/useMatchmaking";
import Flag from "./Flag";

const LBL = "text-[11px] font-bold tracking-[0.12em] uppercase";

function useElapsed(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [since]);
  if (!since) return "0:00";
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The menu's main card: find a random opponent, see the search, cancel it. */
export default function PlayOnlineCard({
  state,
  stats,
  name,
  country,
  message,
  onFind,
  onCancel,
  onEditProfile,
}: {
  state: MatchState;
  stats: LobbyStats | null;
  name: string;
  country: Country | null;
  message: string | null;
  onFind: () => void;
  onCancel: () => void;
  onEditProfile: () => void;
}) {
  const searching = state.status === "searching";
  const elapsed = useElapsed(searching ? state.since : null);
  const others = stats ? Math.max(0, stats.searching - (searching ? 1 : 0)) : null;

  return (
    <section className="brut-lg bg-white flex flex-col" aria-labelledby="play-online-title">
      <div className="flex items-center justify-between gap-3 border-b-3 border-black px-4 sm:px-6 py-3">
        <span id="play-online-title" className={LBL}>
          01 · PLAY ONLINE
        </span>
        {stats && (
          <span className="font-mono text-xs uppercase tracking-wider whitespace-nowrap">
            <span className="inline-block w-2 h-2 bg-lime-500 mr-1.5 align-middle" aria-hidden="true" />
            {stats.online} online
          </span>
        )}
      </div>

      {!searching ? (
        <div className="flex flex-col md:flex-row md:items-center gap-4 sm:gap-6 px-4 sm:px-6 py-5">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <p className="m-0 font-display text-2xl sm:text-3xl leading-none tracking-tight">FIND AN OPPONENT</p>
            <p className="m-0 text-sm leading-snug">
              Get paired with the next player looking for a game.
              {others !== null && others > 0 && (
                <>
                  {" "}
                  <b>{others}</b> {others === 1 ? "is" : "are"} looking right now.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={onEditProfile}
              className="self-start flex items-center gap-2 text-sm hover:underline"
            >
              <span className="opacity-70">playing as</span>
              <Flag country={country} height={14} />
              <b className="uppercase">{name || "— set a name"}</b>
            </button>
          </div>
          <button type="button" onClick={onFind} className="btn btn-accent text-lg py-4 px-6 shrink-0">
            FIND OPPONENT →
          </button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:items-center gap-4 sm:gap-6 px-4 sm:px-6 py-5" aria-live="polite">
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              <p className="m-0 font-display text-2xl sm:text-3xl leading-none tracking-tight">SEARCHING…</p>
              <span className="font-mono text-xl font-bold tabular-nums">{elapsed}</span>
            </div>
            <div className="searching-bar h-3 border-2 border-black" aria-hidden="true" />
            <p className="m-0 text-sm">
              {others ? (
                <>
                  <b>{others}</b> other {others === 1 ? "player is" : "players are"} searching
                </>
              ) : (
                "You're first in line — the next player to search plays you."
              )}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="btn text-lg py-4 px-6 shrink-0">
            ✕ CANCEL
          </button>
        </div>
      )}

      {message && (
        <p role="status" className={`m-0 border-t-3 border-black px-4 sm:px-6 py-2 bg-accent ${LBL}`}>
          {message}
        </p>
      )}
    </section>
  );
}
