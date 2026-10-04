import { useEffect, useRef } from "react";
import type { MoveRow } from "../hooks/useChessGame";
import { PanelHeader } from "./PanelHeader";

/** The move list. Collapsing it leaves just the header with the last move. */
export default function MoveLog({
  rows,
  open,
  onToggle,
}: {
  rows: MoveRow[];
  open: boolean;
  onToggle: () => void;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [rows, open]);

  const last = rows[rows.length - 1];
  const lastMove = last ? (last.black ? `${last.i}… ${last.black}` : `${last.i}. ${last.white}`) : null;
  const lastIsBlack = Boolean(last?.black);

  return (
    <section className="brut flex flex-col h-full min-h-0">
      <PanelHeader title="MOVES" count={rows.length} open={open} onToggle={onToggle}>
        {!open && lastMove && (
          <span className="font-mono text-xs px-1.5 py-0.5 bg-accent text-black truncate">LAST {lastMove}</span>
        )}
      </PanelHeader>
      {open && (
        <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-sm font-mono border-collapse">
            <thead className="sticky top-0 bg-white border-b-2 border-black">
              <tr>
                <th className="w-10 py-1 label text-left px-2">#</th>
                <th className="text-left py-1 label px-2">WHITE</th>
                <th className="text-left py-1 label px-2">BLACK</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const isLast = idx === rows.length - 1;
                return (
                  <tr key={r.i} className="border-t border-black/20 odd:bg-white even:bg-black/[0.03]">
                    <td className="py-1 px-2 opacity-50">{r.i}</td>
                    <td className={`py-1 px-2 ${isLast && !lastIsBlack ? "bg-accent" : ""}`}>{r.white}</td>
                    <td className={`py-1 px-2 ${isLast && lastIsBlack ? "bg-accent" : ""}`}>{r.black}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-xs opacity-40 label">
                    MOVE TO START THE LOG
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
