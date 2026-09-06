import type { ReactNode } from "react";

export default function Modal({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="brut-lg w-full max-w-md p-6 bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b-3 border-black pb-3">
          {title && <h2 className="font-display text-2xl leading-none">{title}</h2>}
          {onClose && (
            <button
              onClick={onClose}
              className="text-2xl leading-none font-bold hover:bg-black hover:text-white px-2"
            >
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
