import { BOARD_THEMES, type BoardTheme } from "../lib/types";
import Modal from "./Modal";

export default function ThemePicker({
  open,
  onClose,
  theme,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  theme: BoardTheme;
  onChange: (t: BoardTheme) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Board Theme">
      <label className="mb-3 block text-sm font-semibold text-slate-700">Choose a theme</label>
      <select
        className="w-full rounded-md border-2 border-black bg-white px-3 py-2 text-lg capitalize"
        value={theme}
        onChange={(e) => onChange(e.target.value as BoardTheme)}
      >
        {BOARD_THEMES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {/* Live preview: a 2×2 swatch */}
      <div className="mt-6 grid grid-cols-2 gap-1 mx-auto" style={{ width: 200 }}>
        <div className={`h-24 w-24 theme-${theme}-dark flex items-center justify-center`}>
          <img src="/images/Bbishop.png" alt="" className="h-16 w-16 object-contain" />
        </div>
        <div className={`h-24 w-24 theme-${theme}-light flex items-center justify-center`}>
          <img src="/images/Wbishop.png" alt="" className="h-16 w-16 object-contain" />
        </div>
        <div className={`h-24 w-24 theme-${theme}-light flex items-center justify-center`}>
          <img src="/images/Wbishop.png" alt="" className="h-16 w-16 object-contain" />
        </div>
        <div className={`h-24 w-24 theme-${theme}-dark flex items-center justify-center`}>
          <img src="/images/Bbishop.png" alt="" className="h-16 w-16 object-contain" />
        </div>
      </div>
    </Modal>
  );
}
