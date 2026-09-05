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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-xl font-bold">{title}</h2>}
          {onClose && (
            <button
              onClick={onClose}
              className="text-2xl leading-none text-slate-500 hover:text-black"
            >
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
