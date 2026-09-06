import type { MoveRow } from "../hooks/useChessGame";

export default function MoveLog({
  rows,
  onUndo,
  onRedo,
  onResign,
  disabled,
}: {
  rows: MoveRow[];
  onUndo: () => void;
  onRedo: () => void;
  onResign: () => void;
  disabled: boolean;
}) {
  return (
    <div className="brut flex flex-col h-full">
      <div className="border-b-3 border-black bg-black px-3 py-2 flex items-center justify-between">
        <span className="label text-white">MOVES</span>
        <span className="label text-white opacity-60 font-mono">{rows.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm font-mono border-collapse">
          <thead className="sticky top-0 bg-white border-b-2 border-black">
            <tr>
              <th className="w-10 py-1 label text-left px-2">#</th>
              <th className="text-left py-1 label px-2">WHITE</th>
              <th className="text-left py-1 label px-2">BLACK</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.i} className="border-t border-black/20 odd:bg-white even:bg-black/[0.03]">
                <td className="py-1 px-2 opacity-60">{r.i}</td>
                <td className="py-1 px-2">{r.white}</td>
                <td className="py-1 px-2">{r.black}</td>
              </tr>
            ))}
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
      <div className="grid grid-cols-3 border-t-3 border-black">
        <button
          onClick={onUndo}
          disabled={disabled}
          className="btn shadow-none border-0 border-r-3 border-black"
          title="Undo"
        >
          ↶ UNDO
        </button>
        <button
          onClick={onRedo}
          disabled={disabled}
          className="btn shadow-none border-0 border-r-3 border-black"
          title="Redo"
        >
          ↷ REDO
        </button>
        <button
          onClick={onResign}
          disabled={disabled}
          className="btn shadow-none border-0"
          title="Resign"
        >
          ✕ RESIGN
        </button>
      </div>
    </div>
  );
}
