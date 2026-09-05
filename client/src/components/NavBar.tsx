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
        className="rounded-md bg-black p-2 text-white shadow-md hover:bg-slate-800"
        title="Menu"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>
      {open && (
        <ul className="absolute left-0 mt-2 min-w-[220px] overflow-hidden rounded-md border border-black/30 bg-white shadow-xl z-40">
          <li
            className="cursor-pointer px-4 py-2 hover:bg-slate-100"
            onClick={() => {
              setOpen(false);
              onOpenThemes();
            }}
          >
            Board Theme
          </li>
          <li
            className="cursor-pointer px-4 py-2 hover:bg-slate-100"
            onClick={() => {
              setOpen(false);
              onReset();
            }}
          >
            Restart Game
          </li>
          <li
            className="cursor-pointer px-4 py-2 text-red-600 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onLeave();
            }}
          >
            Leave to Menu
          </li>
        </ul>
      )}
    </div>
  );
}
