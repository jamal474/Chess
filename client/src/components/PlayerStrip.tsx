import type { ReactNode } from "react";
import type { PieceColor } from "../lib/pieces";
import type { Profile } from "../lib/types";
import Flag from "./Flag";
import { PieceSvg } from "./ChessPiece";

export type StripTone = "accent" | "ink" | "plain";

type Props = {
  profile: Profile | null;
  /** Shown when the player hasn't named themselves yet. */
  fallbackName: string;
  color: PieceColor;
  isYou: boolean;
  /** Seat still empty: show a waiting line instead of a player. */
  waiting?: boolean;
  waitingText?: string;
  waitingHint?: string;
  status: string;
  tone: StripTone;
  /** Engine ids of the opponent's pieces this player has taken. */
  captured: string[];
  /** Material lead in pawns, shown when > 0. */
  advantage: number;
  /** Action cells (undo, resign) at the right end. */
  children?: ReactNode;
};

const TONE: Record<StripTone, string> = {
  accent: "bg-accent text-black",
  ink: "bg-black text-white",
  plain: "bg-white text-black",
};

/**
 * One player's bar above or below the board: flag, name, colour, pieces
 * taken, and whose move it is. Replaces the header's flag + turn indicator.
 */
export default function PlayerStrip({
  profile,
  fallbackName,
  color,
  isYou,
  waiting,
  waitingText = "WAITING FOR OPPONENT…",
  waitingHint,
  status,
  tone,
  captured,
  advantage,
  children,
}: Props) {
  if (waiting) {
    return (
      <div className="brut h-12 shrink-0 flex items-center gap-3 px-2 sm:px-3 min-w-0">
        <Flag country={null} />
        <span className="font-display text-sm sm:text-base tracking-tight truncate uppercase">{waitingText}</span>
        {waitingHint && (
          <span className="label text-[10px] opacity-60 ml-auto hidden sm:block truncate">{waitingHint}</span>
        )}
      </div>
    );
  }

  const takenColor: PieceColor = color === "W" ? "B" : "W";
  return (
    <div className="brut h-12 shrink-0 flex items-stretch min-w-0">
      <div className="shrink-0 flex items-center px-2 sm:px-3 border-r-3 border-black">
        <Flag country={profile?.country} />
      </div>
      <div className="flex-1 min-w-[56px] flex items-baseline gap-2.5 px-2 sm:px-3 self-center overflow-hidden">
        <span className="min-w-0 font-display text-base sm:text-lg tracking-tight leading-none truncate uppercase">
          {profile?.name || fallbackName}
        </span>
        <span className="label text-[10px] opacity-60 whitespace-nowrap hidden sm:inline">
          {color === "W" ? "WHITE" : "BLACK"}
          {isYou ? " · YOU" : ""}
        </span>
      </div>
      {(captured.length > 0 || advantage > 0) && (
        <div className="hidden md:flex items-center gap-1.5 px-2" aria-label={`${captured.length} pieces taken`}>
          <span className="flex items-center -space-x-1.5">
            {captured.map((id, i) => (
              <span key={`${id}-${i}`} className="w-5 h-5 flex items-center justify-center">
                <PieceSvg color={takenColor} pieceId={id} size="100%" />
              </span>
            ))}
          </span>
          {advantage > 0 && <span className="font-mono text-xs font-bold">+{advantage}</span>}
        </div>
      )}
      <div
        className={`shrink-0 sm:min-w-[112px] flex items-center justify-center px-2 sm:px-3 border-l-3 border-black ${TONE[tone]}`}
        aria-live="polite"
      >
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase whitespace-nowrap">{status}</span>
      </div>
      {children}
    </div>
  );
}

/** A full-height cell button for the strip's right end. */
export function StripButton({
  children,
  onClick,
  disabled,
  title,
  ariaLabel,
  variant = "plain",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  variant?: "plain" | "danger" | "pending" | "armed";
}) {
  const look =
    variant === "pending"
      ? "bg-[repeating-linear-gradient(-45deg,#facc15_0_6px,#fff_6px_12px)]"
      : variant === "armed"
      ? "bg-black text-white"
      : variant === "danger"
      ? "bg-white hover:enabled:bg-black hover:enabled:text-white"
      : "bg-white hover:enabled:bg-accent";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`shrink-0 flex items-center justify-center gap-2 min-w-[44px] px-2 sm:px-3 border-l-3 border-black text-[11px] font-bold tracking-[0.12em] uppercase whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed ${look}`}
    >
      {children}
    </button>
  );
}
