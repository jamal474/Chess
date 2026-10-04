import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { PLAYER1, type BoardTheme, type PlayerId, type SquareId } from "../lib/types";
import { pieceKey, type Piece } from "../lib/pieces";
import Square from "./Square";
import ChessPiece, { ChessPieceOverlay } from "./ChessPiece";

type Props = {
  /** Orientation: the board is drawn from this player's side. */
  playerId: PlayerId;
  /** Whose pieces can be dragged. Defaults to playerId (differs only in dev hot-seat mode). */
  activePlayerId?: PlayerId;
  pieces: Piece[];
  highlightMoves: SquareId[];
  highlightCaptures: SquareId[];
  recentMove: { from: SquareId; to: SquareId } | null;
  checkedKingSquare: SquareId | null;
  selectedKey: string | null;
  theme: BoardTheme;
  disabled: boolean;
  onSelectPiece: (piece: Piece) => void;
  onSquareClick: (square: SquareId) => void;
  onMoveByDrag: (piece: Piece, target: SquareId) => void;
};

const rowsFor = (p: PlayerId): number[] =>
  p === PLAYER1 ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
const colsFor = (p: PlayerId): number[] =>
  p === PLAYER1 ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];

export default function Board({
  playerId,
  activePlayerId = playerId,
  pieces,
  highlightMoves,
  highlightCaptures,
  recentMove,
  checkedKingSquare,
  selectedKey,
  theme,
  disabled,
  onSelectPiece,
  onSquareClick,
  onMoveByDrag,
}: Props) {
  const bySquare = useMemo(() => {
    const m = new Map<SquareId, Piece>();
    for (const p of pieces) m.set(p.square, p);
    return m;
  }, [pieces]);

  const [dragged, setDragged] = useState<Piece | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onDragStart(e: DragStartEvent) {
    const p = e.active.data.current?.piece as Piece | undefined;
    if (p) {
      setDragged(p);
      onSelectPiece(p);
    }
  }
  function onDragEnd(e: DragEndEvent) {
    setDragged(null);
    if (!e.over) return;
    const target = String(e.over.id).replace(/^sq::/, "") as SquareId;
    const piece = e.active.data.current?.piece as Piece | undefined;
    if (piece) onMoveByDrag(piece, target);
  }

  const rows = rowsFor(playerId);
  const cols = colsFor(playerId);

  // The board is exactly 8×8 squares and fills its (square) parent, so every
  // square is square. Coordinates sit inside the edge squares instead of in
  // gutters around the board, which used to stretch the squares sideways.
  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div
        className={[
          "w-full h-full grid grid-rows-8 border-3 border-black shadow-brut bg-black",
          disabled ? "pointer-events-none" : "",
        ].join(" ")}
      >
        {rows.map((row, ri) => (
          <div key={row} className="grid grid-cols-8 min-h-0">
            {cols.map((col, ci) => {
              const id: SquareId = `${row}${col}`;
              const parity: 0 | 1 = ((row + col) % 2) as 0 | 1;
              const piece = bySquare.get(id);
              const selected =
                Boolean(piece) && selectedKey === pieceKey(piece!);
              return (
                <Square
                  key={id}
                  id={id}
                  parity={parity}
                  theme={theme}
                  rankLabel={ci === 0 ? String(row) : undefined}
                  fileLabel={ri === rows.length - 1 ? String.fromCharCode(96 + col) : undefined}
                  isMove={highlightMoves.includes(id)}
                  isCapture={highlightCaptures.includes(id)}
                  isRecent={
                    Boolean(recentMove) &&
                    (recentMove!.from === id || recentMove!.to === id)
                  }
                  isCheck={checkedKingSquare === id}
                  isSelected={selected}
                  onClick={() => onSquareClick(id)}
                >
                  {piece && (
                    <ChessPiece
                      piece={piece}
                      draggable={
                        !disabled &&
                        piece.color === (activePlayerId === PLAYER1 ? "W" : "B")
                      }
                      selected={selected}
                      onSelect={() => onSelectPiece(piece)}
                    />
                  )}
                </Square>
              );
            })}
          </div>
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragged ? <ChessPieceOverlay piece={dragged} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
