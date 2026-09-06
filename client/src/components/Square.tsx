import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { BoardTheme, SquareId } from "../lib/types";

type Props = {
  id: SquareId;
  parity: 0 | 1;                 // 0 = dark, 1 = light square in the theme
  theme: BoardTheme;
  isMove: boolean;
  isCapture: boolean;
  isRecent: boolean;
  isCheck: boolean;
  isSelected: boolean;
  onClick: () => void;
  children: ReactNode;
};

export default function Square({
  id,
  parity,
  theme,
  isMove,
  isCapture,
  isRecent,
  isCheck,
  isSelected,
  onClick,
  children,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `sq::${id}` });

  // Highlight priority is: check > selected > capture > move > recent > base.
  const highlightClass = isCheck
    ? "sq-check"
    : isSelected
    ? "sq-selected"
    : isCapture
    ? "sq-capture"
    : isMove
    ? "sq-move"
    : isRecent
    ? "sq-recent"
    : "";

  const themeClass = parity === 0 ? `theme-${theme}-dark` : `theme-${theme}-light`;

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={[
        "relative flex items-center justify-center transition-shadow",
        themeClass,
        highlightClass,
        isOver ? "sq-hover" : "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
