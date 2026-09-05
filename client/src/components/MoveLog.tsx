export type MoveRow = { i: number; white: string; black: string };

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
    <div className="flex h-full flex-col rounded-lg border-2 border-black bg-white shadow-md">
      <div className="border-b border-black/20 px-3 py-2 text-sm font-bold uppercase tracking-wider">
        Moves
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-600">
              <th className="w-10">#</th>
              <th>White</th>
              <th>Black</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.i} className="border-t border-black/10">
                <td className="py-1 pr-2 text-slate-500">{r.i}</td>
                <td className="py-1 pr-2 font-mono">{r.white}</td>
                <td className="py-1 pr-2 font-mono">{r.black}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-around border-t border-black/20 p-2">
        <button
          onClick={onUndo}
          disabled={disabled}
          className="rounded-md bg-slate-100 p-2 hover:bg-slate-200 disabled:opacity-50"
          title="Undo"
        >
          <span className="material-symbols-outlined">undo</span>
        </button>
        <button
          onClick={onRedo}
          disabled={disabled}
          className="rounded-md bg-slate-100 p-2 hover:bg-slate-200 disabled:opacity-50"
          title="Redo"
        >
          <span className="material-symbols-outlined">redo</span>
        </button>
        <button
          onClick={onResign}
          disabled={disabled}
          className="rounded-md bg-slate-100 p-2 hover:bg-slate-200 disabled:opacity-50"
          title="Resign / Exit"
        >
          <span className="material-symbols-outlined">exit_to_app</span>
        </button>
      </div>
    </div>
  );
}
