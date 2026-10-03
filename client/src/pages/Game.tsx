import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BoardTheme, SquareId } from "../lib/types";
import type { Piece } from "../lib/pieces";
import { useChessGame } from "../hooks/useChessGame";
import Board from "../components/Board";
import ChatBox from "../components/ChatBox";
import MoveLog from "../components/MoveLog";
import TurnIndicator from "../components/TurnIndicator";
import ThemePicker from "../components/ThemePicker";
import NavBar from "../components/NavBar";
import NationalityBadge from "../components/NationalityBadge";
import Modal from "../components/Modal";

// Dev tools panel. import.meta.env.DEV is false in production builds, so the
// import below is dropped and the panel's code never reaches the bundle.
const DevPanel = import.meta.env.DEV ? lazy(() => import("../dev/DevPanel")) : null;

export default function Game() {
  const nav = useNavigate();
  const game = useChessGame();
  const [showTheme, setShowTheme] = useState(false);
  const [theme, setTheme] = useState<BoardTheme>("default");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!game.roomCode) nav("/", { replace: true });
  }, [game.roomCode, nav]);

  const copyRoom = () => {
    navigator.clipboard.writeText(game.roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const disabled = Boolean(game.gameOver);

  function handlePieceSelect(p: Piece) {
    game.selectPiece(p);
  }
  function handleSquareClick(sq: SquareId) {
    game.moveTo(sq);
  }
  function handleMoveByDrag(_piece: Piece, target: SquareId) {
    game.moveTo(target);
  }

  return (
    // Fixed-viewport shell — no page scroll.
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#fafafa] text-black">
      {/* ================= Header =================
          One-row header. Left cluster is identity + navigation. Right cluster
          is a single brutalist "control bar" holding room, timer and turn as
          equal-height sibling cells with hard black dividers between them —
          no more three mismatched buttons floating side by side. */}
      <header className="border-b-3 border-black bg-white shrink-0">
        <div className="flex items-stretch justify-between gap-3 px-4 py-2 h-16">
          <div className="flex items-center gap-4 shrink-0">
            <NavBar
              onOpenThemes={() => setShowTheme(true)}
              onReset={game.reset}
              onLeave={() => nav("/")}
            />
            <h1 className="font-display text-2xl tracking-tighter leading-none">
              C H E S S
            </h1>
          </div>

          {/* Single brutalist strip: [ FLAG | ROOM | TIMER | TURN ], all one height. */}
          <div className="brut h-full flex divide-x-[3px] divide-black overflow-hidden">
            {/* NATIONALITY — flag + code. Height matches the cell (h-16 → ~40px inner). */}
            <div className="flex items-center justify-center px-3 bg-white">
              <NationalityBadge heightPx={40} />
            </div>
            {/* ROOM */}
            <div className="flex flex-col justify-center px-4 min-w-[140px]">
              <span className="label opacity-70 text-[10px]">ROOM</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg leading-none">{game.roomCode}</span>
                <button
                  onClick={copyRoom}
                  type="button"
                  className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 border-2 border-black bg-white hover:bg-black hover:text-white leading-none"
                  title="Copy room code"
                >
                  {copied ? "✓" : "COPY"}
                </button>
              </div>
            </div>

            {/* TIMER — the visually dominant control */}
            <div className="flex flex-col items-center justify-center px-6 bg-black text-white min-w-[200px]">
              <span className="label text-[10px] opacity-70">TIME</span>
              <span className="font-mono text-3xl font-bold tabular-nums leading-none tracking-tight">
                {game.timer.hh}:{game.timer.mm}:{game.timer.ss}
              </span>
            </div>

            {/* TURN — informative, colour-flips when it's your move */}
            <TurnIndicator currentTurn={game.currentTurn} me={game.actingPlayer} />
          </div>
        </div>
      </header>

      {/* ================= Main content ================= */}
      <main className="flex-1 min-h-0 flex gap-2 p-2">
        {/* Board — left-aligned, square, fills the available height */}
        <div className="h-full aspect-square shrink-0">
          <Board
            playerId={game.playerId}
            activePlayerId={game.actingPlayer}
            pieces={game.pieces}
            highlightMoves={game.highlightMoves}
            highlightCaptures={game.highlightCaptures}
            recentMove={game.recentMove}
            checkedKingSquare={game.checkedKingSquare}
            selectedKey={game.selectedKey}
            theme={theme}
            disabled={disabled}
            onSelectPiece={handlePieceSelect}
            onSquareClick={handleSquareClick}
            onMoveByDrag={handleMoveByDrag}
          />
        </div>

        {/* Sidebar — moves on top, chat below, fills the rest */}
        <aside className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex-[3] min-h-0">
            <MoveLog
              rows={game.moveRows}
              disabled={disabled}
              onUndo={game.undo}
              onRedo={game.redo}
              onResign={game.resign}
            />
          </div>
          {DevPanel && (
            <Suspense fallback={null}>
              <DevPanel game={game} />
            </Suspense>
          )}
          <div className="flex-[2] min-h-0">
            <ChatBox me={game.playerId} messages={game.messages} onSend={game.sendChat} />
          </div>
        </aside>
      </main>

      <ThemePicker
        open={showTheme}
        onClose={() => setShowTheme(false)}
        theme={theme}
        onChange={setTheme}
      />

      <Modal open={Boolean(game.gameOver)} onClose={game.dismissGameOver} title="GAME OVER">
        <p className="mb-6 font-mono text-lg">{game.gameOver}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              game.dismissGameOver();
              game.reset();
            }}
            className="btn btn-accent"
          >
            REMATCH
          </button>
          <button type="button" onClick={() => nav("/")} className="btn">
            BACK TO MENU
          </button>
        </div>
      </Modal>
    </div>
  );
}
