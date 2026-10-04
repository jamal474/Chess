import type { ReactNode } from "react";

/** Black header bar of a side panel, with its collapse / expand toggle. */
export function PanelHeader({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="h-10 shrink-0 flex items-center gap-2.5 pl-3 pr-1.5 bg-black text-white min-w-0">
      <span className="text-[11px] font-bold tracking-[0.12em] uppercase">{title}</span>
      {count !== undefined && <span className="font-mono text-[11px] opacity-60">{count}</span>}
      {children}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${open ? "Collapse" : "Expand"} ${title.toLowerCase()}`}
        title={open ? "Collapse" : "Expand"}
        className="ml-auto shrink-0 w-7 h-7 border-2 border-white bg-black text-white font-mono font-bold leading-none hover:bg-white hover:text-black"
      >
        {open ? "–" : "+"}
      </button>
    </div>
  );
}
