import { useEffect, useState } from "react";

const LBL = "text-[11px] font-bold tracking-[0.12em] uppercase";

/**
 * Over the board while the opponent's seat is empty: the game is paused and
 * whoever joins with the room code takes the seat.
 */
export default function PausedOverlay({
  who,
  roomCode,
  moves,
  colorName,
  gameOver,
}: {
  /** Name of the player who left, if we knew it. */
  who: string | null;
  roomCode: string;
  moves: number;
  /** The colour the newcomer will play. */
  colorName: string;
  /** The game had already ended: a newcomer starts a new one. */
  gameOver: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-[420px] border-3 border-black shadow-brut-lg bg-white"
      >
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-black text-white">
          <span className={LBL}>{gameOver ? "OPPONENT LEFT" : "GAME PAUSED"}</span>
          <span className="flex items-center gap-1.5 font-mono text-xs opacity-80">
            <span className="inline-block w-2 h-2 bg-accent animate-pulse" aria-hidden="true" />
            WAITING
          </span>
        </div>
        <div className="flex flex-col gap-3 px-4 sm:px-6 pt-5 pb-5">
          <p className="m-0 font-display text-xl sm:text-2xl leading-tight uppercase break-words">
            {who ? `${who} left the game` : "Your opponent left"}
          </p>
          <p className="m-0 text-sm leading-snug">
            {gameOver ? (
              <>Whoever joins with this code starts a new game with you.</>
            ) : (
              <>
                The clock is stopped{moves > 0 ? ` at move ${moves}` : ""}. Whoever joins with this code takes over{" "}
                <b>{colorName}</b> and play carries on from here.
              </>
            )}
          </p>
        </div>
        <div className="flex items-stretch border-t-3 border-black">
          <div className="flex-1 min-w-0 px-4 py-2 flex flex-col">
            <span className={`${LBL} text-[10px] opacity-70`}>ROOM CODE</span>
            <span className="font-mono text-xl font-bold tracking-widest truncate">{roomCode}</span>
          </div>
          <button
            type="button"
            onClick={copy}
            className={`${LBL} px-5 border-l-3 border-black bg-accent hover:bg-black hover:text-white`}
          >
            {copied ? "✓ COPIED" : "COPY"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Matchmade games: the opponent's connection dropped. They have until
 * `deadline` (local ms) to come back, otherwise you win.
 */
export function GraceOverlay({ who, deadline }: { who: string | null; deadline: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((deadline - now) / 1000));
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div role="status" aria-live="polite" className="w-full max-w-[400px] border-3 border-black shadow-brut-lg bg-white">
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-black text-white">
          <span className={LBL}>OPPONENT DISCONNECTED</span>
          <span className="flex items-center gap-1.5 font-mono text-xs opacity-80">
            <span className="inline-block w-2 h-2 bg-accent animate-pulse" aria-hidden="true" />
            WAITING
          </span>
        </div>
        <div className="flex flex-col items-center gap-2 px-4 sm:px-6 pt-5 pb-6 text-center">
          <p className="m-0 font-display text-xl sm:text-2xl leading-tight uppercase break-words">
            {who ? `${who} lost connection` : "Your opponent lost connection"}
          </p>
          <span className="font-mono text-5xl font-bold tabular-nums leading-none py-2">{clock}</span>
          <p className="m-0 text-sm leading-snug">
            The clock is stopped. If they&apos;re not back by then, <b>you win</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
