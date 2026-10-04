import { useMemo, type CSSProperties } from "react";
import type { GameResult, PlayerId, Profile } from "../lib/types";
import { PLAYER1, PLAYER2 } from "../lib/types";
import Flag from "./Flag";

const LBL = "text-[11px] font-bold tracking-[0.12em] uppercase";

type Props = {
  open: boolean;
  result: GameResult;
  me: PlayerId;
  profiles: Record<PlayerId, Profile | null>;
  nameOf: (p: PlayerId) => string;
  moves: number;
  time: string;
  onRematch: () => void;
  onMenu: () => void;
  onClose: () => void;
  /** Matchmade games: offer a new random opponent. */
  onPlayAgain?: () => void;
  /** Rematch needs the opponent still in the room. */
  canRematch?: boolean;
};

/** End of game: both players side by side, the winner crowned. */
export default function GameOverDialog({
  open,
  result,
  me,
  profiles,
  nameOf,
  moves,
  time,
  onRematch,
  onMenu,
  onClose,
  onPlayAgain,
  canRematch = true,
}: Props) {
  if (!open) return null;
  const winner = result.winner;
  const title = !winner ? "DRAW" : winner === me ? "YOU WIN" : `${nameOf(winner)} WINS`;
  const how = {
    checkmate: "BY CHECKMATE",
    resign: "BY RESIGNATION",
    abandon: "BY ABANDONMENT",
    stalemate: "STALEMATE",
  }[result.kind];
  const loserNote = { checkmate: "CHECKMATED", resign: "RESIGNED", abandon: "LEFT", stalemate: "DRAW" }[result.kind];

  const card = (p: PlayerId) => {
    const isWinner = winner === p;
    const color = p === PLAYER1 ? "WHITE" : "BLACK";
    const tag = !winner ? "DRAW" : isWinner ? "WINNER" : loserNote;
    return (
      <div
        className={[
          "relative flex flex-col items-center gap-2.5 sm:gap-3 px-2 sm:px-4 pt-7 sm:pt-8 pb-4 sm:pb-5 border-3 border-black min-w-0",
          isWinner ? "bg-accent shadow-brut-lg" : "bg-white",
        ].join(" ")}
      >
        {isWinner && <Crown />}
        <Flag country={profiles[p]?.country} height={32} />
        <span
          className="font-display text-lg sm:text-3xl leading-none tracking-tight uppercase truncate max-w-full"
          title={nameOf(p)}
        >
          {nameOf(p)}
        </span>
        <span
          className={`${LBL} text-[10px] sm:text-[11px] px-2 py-0.5 whitespace-nowrap ${isWinner ? "bg-black" : "border-2 border-black"}`}
          style={isWinner ? { color: "#facc15" } : undefined}
        >
          {tag}
        </span>
        <span className={`${LBL} text-[10px] opacity-60`}>{color}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      {winner === me && <Confetti />}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[640px] border-3 border-black shadow-brut-lg bg-white"
      >
        <div className="flex items-center justify-between px-4 py-2.5 bg-black text-white">
          <span className={LBL}>GAME OVER</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 border-2 border-white font-bold leading-none hover:bg-white hover:text-black"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col items-center gap-1.5 px-6 pt-6 pb-2 text-center">
          <h2 id="result-title" className="font-display text-4xl sm:text-5xl leading-none tracking-tight uppercase">
            {title}
          </h2>
          <span className="font-mono text-xs sm:text-[13px] tracking-wide">
            {how} · {moves} MOVES · {time}
          </span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 sm:gap-5 px-4 sm:px-8 pt-12 sm:pt-14 pb-6 sm:pb-7">
          {card(PLAYER1)}
          <span className="font-display text-base sm:text-2xl">VS</span>
          {card(PLAYER2)}
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3.5 px-4 sm:px-6 pt-4 pb-5 sm:pb-6 border-t-3 border-black">
          <button type="button" onClick={onMenu} className="btn">
            BACK TO MENU
          </button>
          {onPlayAgain ? (
            <>
              {canRematch && (
                <button type="button" onClick={onRematch} className="btn">
                  REMATCH
                </button>
              )}
              <button type="button" autoFocus onClick={onPlayAgain} className="btn btn-accent">
                PLAY AGAIN →
              </button>
            </>
          ) : (
            <button type="button" autoFocus onClick={onRematch} disabled={!canRematch} className="btn btn-accent">
              REMATCH →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Crown() {
  return (
    <svg
      width="64"
      height="48"
      viewBox="0 0 64 48"
      aria-label="Winner"
      className="absolute -top-[38px] left-1/2 -translate-x-1/2"
    >
      <path d="M6 36 L10 10 L22 24 L32 4 L42 24 L54 10 L58 36 Z" fill="#facc15" stroke="#000" strokeWidth="3" strokeLinejoin="miter" />
      <rect x="6" y="36" width="52" height="9" fill="#000" />
      <rect x="28" y="22" width="8" height="8" fill="#000" transform="rotate(45 32 26)" />
    </svg>
  );
}

const CONFETTI_COLORS = ["#facc15", "#ffffff", "#a3e635", "#ef4444", "#facc15", "#000000"];

/** Hard-edged paper confetti falling behind the dialog. Off with reduced motion. */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => {
        const wide = Math.random() > 0.5;
        return {
          left: `${Math.random() * 100}%`,
          width: wide ? 14 : 8,
          height: wide ? 8 : 16,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          "--dur": `${3.5 + Math.random() * 3}s`,
          "--delay": `${-Math.random() * 6}s`,
          "--drift": `${Math.round((Math.random() - 0.5) * 160)}px`,
          "--spin": `${Math.random() > 0.5 ? "" : "-"}${360 + Math.round(Math.random() * 720)}deg`,
        } as CSSProperties;
      }),
    []
  );
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      {pieces.map((style, i) => (
        <span key={i} className="confetti-piece" style={style} />
      ))}
    </div>
  );
}
