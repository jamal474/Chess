import { useState } from "react";

type Props = {
  onOpenThemes: () => void;
  onReset: () => void;
  onLeave: () => void;
};

export default function NavBar({ onOpenThemes, onReset, onLeave }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn btn-primary w-11 h-11 p-0 text-xl"
        title="Menu"
        aria-label="Menu"
        aria-expanded={open}
      >
        ☰
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul className="absolute left-0 mt-2 z-40 min-w-[220px] brut bg-white">
            <li
              className="cursor-pointer px-4 py-2 border-b-2 border-black label hover:bg-accent"
              onClick={() => {
                setOpen(false);
                onOpenThemes();
              }}
            >
              BOARD THEME
            </li>
            <li
              className="cursor-pointer px-4 py-2 border-b-2 border-black label hover:bg-accent"
              onClick={() => {
                setOpen(false);
                onReset();
              }}
            >
              RESTART GAME
            </li>
            <li
              className="cursor-pointer px-4 py-2 label hover:bg-black hover:text-white"
              onClick={() => {
                setOpen(false);
                onLeave();
              }}
            >
              LEAVE
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
