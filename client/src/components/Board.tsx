import { useMemo } from "react";
import type { BoardTheme, PlayerId, SquareId } from "../lib/types";
import { PLAYER1 } from "../lib/types";
import type { Piece } from "../lib/pieces";
import { ownColor } from "../lib/pieces";

type Props = {
  playerId: PlayerId;
  pieces: Piece[];
  highlightMoves: SquareId[];
  highlightCaptures: SquareId[];
  recentMove: { from: SquareId; to: SquareId } | null;
  checkedKingSquare: SquareId | null;
  selectedKey: string | null;              // "W-pawn1"
  theme: BoardTheme;
  disabled: boolean;
  onPieceSelect: (piece: Piece) => void;
  onSquareClick: (square: SquareId) => void;
  onPieceDragStart: (piece: Piece) => void;
  onDrop: (square: SquareId) => void;
};

// Build the 8 rows/8 cols order for the given player orientation.
function rows(playerId: PlayerId): number[] {
  return playerId === PLAYER1 ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
}
function cols(playerId: PlayerId): number[] {
  return playerId === PLAYER1 ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
}

export function pieceKey(p: { color: "W" | "B"; id: string }) {
  return `${p.color}-${p.id}`;
}

export default function Board({
  playerId,
  pieces,
  highlightMoves,
  highlightCaptures,
  recentMove,
  checkedKingSquare,
  selectedKey,
  theme,
  disabled,
  onPieceSelect,
  onSquareClick,
  onPieceDragStart,
  onDrop,
}: Props) {
  const bySquare = useMemo(() => {
    const m = new Map<SquareId, Piece>();
    for (const p of pieces) m.set(p.square, p);
    return m;
  }, [pieces]);

  const myColor = ownColor(playerId);

  return (
    <div
      className={`grid select-none border-4 border-black shadow-[0_20px_60px_rgba(0,0,0,0.45)] ${
        disabled ? "pointer-events-none opacity-90" : ""
      }`}
      style={{ gridTemplateRows: "repeat(8, minmax(0, 1fr))", width: "min(88vh, 640px)", height: "min(88vh, 640px)" }}
    >
      {rows(playerId).map((row) => (
        <div key={row} className="grid" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
          {cols(playerId).map((col) => {
            const id: SquareId = `${row}${col}`;
            const parity = (row + col) % 2;
            const themeClass = parity === 0 ? `theme-${theme}-dark` : `theme-${theme}-light`;

            const piece = bySquare.get(id);
            const isRecent = recentMove && (recentMove.from === id || recentMove.to === id);
            const isChecked = checkedKingSquare === id;
            const isMove = highlightMoves.includes(id);
            const isCap = highlightCaptures.includes(id);

            const highlightClass = isCap
              ? "sq-capture-highlight"
              : isMove
              ? "sq-move-highlight"
              : isChecked
              ? "sq-check"
              : isRecent
              ? "sq-recent"
              : themeClass;

            return (
              <div
                key={id}
                className={`relative flex items-center justify-center transition-colors ${highlightClass}`}
                onClick={() => onSquareClick(id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(id)}
              >
                {piece && (
                  <img
                    src={piece.image}
                    alt=""
                    draggable={piece.color === myColor && !disabled}
                    onClick={(e) => {
                      if (piece.color === myColor) {
                        e.stopPropagation();
                        onPieceSelect(piece);
                      }
                    }}
                    onDragStart={() => {
                      if (piece.color === myColor) onPieceDragStart(piece);
                    }}
                    className={`h-[80%] w-[80%] object-contain drop-shadow-md ${
                      selectedKey === pieceKey(piece) ? "outline outline-2 outline-red-600" : ""
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
