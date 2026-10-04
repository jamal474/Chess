import { useEffect } from "react";
import type { Country, PlayerId } from "../lib/types";
import { PLAYER1 } from "../lib/types";
import Flag from "./Flag";

const LBL = "text-[11px] font-bold tracking-[0.12em] uppercase";

/** A beat of "you vs them" before the board opens. Calls onDone after `ms`. */
export default function MatchFound({
  me,
  opponent,
  myColor,
  ms = 1200,
  onDone,
}: {
  me: { name: string; country: Country | null };
  opponent: { name: string; country: Country | null };
  myColor: PlayerId;
  ms?: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(t);
  }, [ms, onDone]);

  const side = (p: { name: string; country: Country | null }, color: string, you: boolean) => (
    <div className={`flex flex-col items-center gap-2.5 px-3 py-5 border-3 border-black min-w-0 ${you ? "bg-accent" : "bg-white"}`}>
      <Flag country={p.country} height={32} />
      <span className="font-display text-xl sm:text-2xl leading-none tracking-tight uppercase truncate max-w-full">
        {p.name || "PLAYER"}
      </span>
      <span className={`${LBL} text-[10px] opacity-70`}>
        {color}
        {you ? " · YOU" : ""}
      </span>
    </div>
  );
  const mine = myColor === PLAYER1 ? "WHITE" : "BLACK";
  const theirs = myColor === PLAYER1 ? "BLACK" : "WHITE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div role="alertdialog" aria-labelledby="match-title" className="w-full max-w-[560px] border-3 border-black shadow-brut-lg bg-white">
        <div className="flex items-center justify-between px-4 py-2.5 bg-black text-white">
          <span id="match-title" className={LBL}>
            MATCH FOUND
          </span>
          <span className="font-mono text-xs opacity-80">STARTING…</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-5 px-4 sm:px-8 py-7">
          {side(me, mine, true)}
          <span className="font-display text-xl sm:text-3xl">VS</span>
          {side(opponent, theirs, false)}
        </div>
        <div className="h-1.5 bg-black">
          <div className="h-full bg-accent match-countdown" style={{ animationDuration: `${ms}ms` }} />
        </div>
      </div>
    </div>
  );
}
