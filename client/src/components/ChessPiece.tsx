import { useDraggable } from "@dnd-kit/core";
import type { MouseEvent } from "react";
import type { Piece } from "../lib/pieces";
import { glyphFor } from "../lib/glyphs";

type Props = {
  piece: Piece;
  draggable: boolean;
  selected: boolean;
  onSelect: () => void; // called on plain click of an own piece (drag-start also selects)
};

// A single piece rendered as an SVG-wrapped Unicode chess glyph. Draggable
// when it's the player's own piece; also handles a plain click to select
// the piece and highlight its legal moves.
export default function ChessPiece({ piece, draggable, selected, onSelect }: Props) {
  const id = `piece::${piece.color}-${piece.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    disabled: !draggable,
    data: { piece },
  });

  // Own piece → clicking it selects (and stops the click from bubbling to the
  // square, which would otherwise try to move a previously-selected piece
  // onto our own square). Opponent piece → let the click bubble so the square
  // handles it as a capture move.
  function onClick(e: MouseEvent<HTMLDivElement>) {
    if (!draggable) return;
    e.stopPropagation();
    onSelect();
  }

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      {...(draggable ? { ...listeners, ...attributes } : {})}
      className={[
        "flex items-center justify-center w-full h-full select-none",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        isDragging ? "opacity-0" : "",
        selected ? "scale-110 transition-transform" : "",
      ].join(" ")}
      aria-label={`${piece.color === "W" ? "white" : "black"} ${piece.id}`}
      role="img"
    >
      <PieceSvg color={piece.color} pieceId={piece.id} />
    </div>
  );
}

// Bare SVG used by both the in-square renderer and the drag overlay.
// The stroke is what keeps every piece legible on every square:
//   • white piece → black stroke  (invisible on white/light squares otherwise)
//   • black piece → white stroke  (invisible on black/dark squares otherwise)
export function PieceSvg({
  color,
  pieceId,
  size = "82%",
}: {
  color: "W" | "B";
  pieceId: string;
  size?: string;
}) {
  const glyph = glyphFor(pieceId);
  const isWhite = color === "W";
  const fill = isWhite ? "#ffffff" : "#000000";
  const stroke = isWhite ? "#000000" : "#ffffff";
  // White pieces need a heavy outline to stand out on light squares; black
  // pieces just need a hairline to separate them from dark squares.
  const strokeWidth = isWhite ? 3.5 : 1.6;

  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: size, height: size, overflow: "visible" }}
      className="glyph"
    >
      <text
        x="50"
        y="54"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="86"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {glyph}
      </text>
    </svg>
  );
}

export function ChessPieceOverlay({ piece }: { piece: Piece }) {
  return (
    <div
      className="flex items-center justify-center pointer-events-none"
      style={{
        width: "min(10vh, 96px)",
        height: "min(10vh, 96px)",
        filter: "drop-shadow(4px 4px 0 rgba(0,0,0,0.6))",
      }}
    >
      <PieceSvg color={piece.color} pieceId={piece.id} size="100%" />
    </div>
  );
}
