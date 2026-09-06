import { PLAYER1, type PlayerId } from "../lib/types";
import { PieceSvg } from "./ChessPiece";

// A single, informative turn card. Colour of the background flips to the
// accent yellow when it's the local player's turn so the whole strip
// glows to draw attention.
export default function TurnIndicator({
  currentTurn,
  me,
}: {
  currentTurn: PlayerId;
  me: PlayerId;
}) {
  const yourTurn = currentTurn === me;
  const color: "W" | "B" = currentTurn === PLAYER1 ? "W" : "B";
  const label = color === "W" ? "WHITE" : "BLACK";

  return (
    <div
      className={[
        "h-full flex items-center gap-3 px-4",
        yourTurn ? "bg-accent" : "bg-white",
      ].join(" ")}
      aria-live="polite"
    >
      {/* A large piece icon of whoever's turn it is */}
      <div className="w-10 h-10 flex items-center justify-center shrink-0">
        <PieceSvg color={color} pieceId="pawn1" size="100%" />
      </div>

      <div className="flex flex-col leading-tight">
        <span className="font-display text-lg tracking-tight">
          {label}'s move
        </span>
        <span className="label text-[10px] opacity-80">
          {yourTurn ? "your turn" : "waiting for opponent…"}
        </span>
      </div>
    </div>
  );
}
