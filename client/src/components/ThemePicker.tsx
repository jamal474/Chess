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
    <Modal open={open} onClose={onClose} title="BOARD THEME">
      <div className="grid grid-cols-3 gap-3">
        {BOARD_THEMES.map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={[
              "brut flex flex-col items-stretch overflow-hidden",
              theme === t ? "outline outline-4 outline-accent" : "",
            ].join(" ")}
          >
            <div className="grid grid-cols-2 h-16">
              <div className={`theme-${t}-dark`} />
              <div className={`theme-${t}-light`} />
              <div className={`theme-${t}-light`} />
              <div className={`theme-${t}-dark`} />
            </div>
            <span className="label bg-black text-white py-1">{t.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
