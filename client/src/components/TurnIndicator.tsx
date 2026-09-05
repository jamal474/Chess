import type { PlayerId } from "../lib/types";
import { PLAYER1 } from "../lib/types";

export default function TurnIndicator({ currentTurn }: { currentTurn: PlayerId }) {
  const whiteTurn = currentTurn === PLAYER1;
  return (
    <div className="flex items-center gap-4">
      <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${whiteTurn ? "bg-green-400" : "bg-slate-200"}`}>
        <img src="/images/Wpawn.png" alt="" className="h-8 w-8 object-contain" />
        <span className="text-sm font-semibold">White</span>
      </div>
      <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${!whiteTurn ? "bg-green-400" : "bg-slate-200"}`}>
        <img src="/images/Bpawn.png" alt="" className="h-8 w-8 object-contain" />
        <span className="text-sm font-semibold">Black</span>
      </div>
    </div>
  );
}
