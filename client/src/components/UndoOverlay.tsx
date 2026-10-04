import { useEffect, useState } from "react";

const LBL = "text-[11px] font-bold tracking-[0.12em] uppercase";

/** Seconds left until `deadline` (local ms), ticking. */
function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [deadline]);
  if (!deadline) return { secs: 0, left: 0 };
  const left = Math.max(0, deadline - now);
  return { secs: Math.ceil(left / 1000), left };
}

/** Three boxes: used, (this request), left. */
function UndoPips({ used, max, requesting }: { used: number; max: number; requesting: boolean }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => {
        const kind = i < used ? "used" : requesting && i === used ? "this" : "left";
        return (
          <span
            key={i}
            className={[
              "w-[18px] h-[18px] border-2 border-black",
              kind === "used"
                ? "bg-black"
                : kind === "this"
                ? "bg-[repeating-linear-gradient(-45deg,#000_0_3px,#fff_3px_6px)]"
                : "bg-white",
            ].join(" ")}
          />
        );
      })}
    </span>
  );
}

/**
 * Shown to the player who is asked: covers the board only, so chat stays
 * usable. Escape declines.
 */
export function UndoRequestDialog({
  opponentName,
  move,
  used,
  max,
  deadline,
  totalMs,
  onAllow,
  onDecline,
}: {
  opponentName: string;
  move: string | null;
  used: number;
  max: number;
  deadline: number;
  totalMs: number;
  onAllow: () => void;
  onDecline: () => void;
}) {
  const { secs, left } = useCountdown(deadline);
  const pct = totalMs > 0 ? Math.max(0, Math.min(100, (left / totalMs) * 100)) : 0;
  const leftAfter = Math.max(0, max - used - 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDecline();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDecline]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="undo-title"
        className="w-full max-w-[440px] border-3 border-black shadow-brut-lg bg-white"
      >
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-black text-white">
          <span id="undo-title" className={LBL}>
            UNDO REQUEST
          </span>
          <span className="font-mono text-xs opacity-80">AUTO-DECLINE 0:{String(secs).padStart(2, "0")}</span>
        </div>
        <div className="h-1.5 bg-black border-b-3 border-black">
          <div className="h-full bg-accent transition-[width] duration-200 ease-linear" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-col gap-4 px-4 sm:px-6 pt-5 pb-5 sm:pb-6">
          <p className="font-display text-xl leading-tight uppercase m-0">
            {opponentName} wants to take back
          </p>
          {move && (
            <div className="flex items-center gap-4 px-4 py-3 border-3 border-black bg-[#fafafa]">
              <span className="font-mono text-3xl font-bold tracking-tight whitespace-nowrap">{move}</span>
              <span className="text-sm leading-snug hidden sm:block">the board goes back to before this move</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`${LBL} text-[10px] opacity-70`}>{opponentName}&apos;S UNDOS</span>
            <UndoPips used={used} max={max} requesting />
            <span className="font-mono text-xs font-bold">{leftAfter} LEFT AFTER THIS</span>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t-3 border-black">
          <button
            type="button"
            onClick={onDecline}
            className="py-3.5 border-r-3 border-black bg-white font-bold tracking-wider hover:bg-accent"
          >
            ✕ DECLINE
          </button>
          <button
            type="button"
            autoFocus
            onClick={onAllow}
            className="py-3.5 bg-black text-white font-bold tracking-wider hover:bg-white hover:text-black"
          >
            ✓ ALLOW
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shown to the player who asked, over the top of the board. */
export function UndoPendingBar({
  opponentName,
  move,
  deadline,
  onCancel,
}: {
  opponentName: string;
  move: string | null;
  deadline: number;
  onCancel: () => void;
}) {
  const { secs } = useCountdown(deadline);
  return (
    <div className="absolute left-4 right-4 top-4 z-20 flex items-stretch border-3 border-black shadow-brut bg-accent">
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 px-3.5 py-2.5">
        <span className={LBL}>
          UNDO REQUESTED
          {move && <span className="font-mono normal-case tracking-normal"> · {move}</span>}
        </span>
        <span className="text-sm truncate">
          waiting for <span className="uppercase">{opponentName}</span>… {secs}s
        </span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className={`${LBL} px-4 border-l-3 border-black bg-white hover:bg-black hover:text-white`}
      >
        CANCEL
      </button>
    </div>
  );
}

/** A short notice about how an undo request ended. Disappears by itself. */
export function UndoNotice({ text, at }: { text: string | null; at: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!text) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(t);
  }, [text, at]);
  if (!text || !visible) return null;
  return (
    <div
      role="status"
      className={`absolute left-1/2 -translate-x-1/2 top-4 z-20 px-4 py-2.5 border-3 border-black shadow-brut bg-white ${LBL} whitespace-nowrap`}
    >
      {text}
    </div>
  );
}
