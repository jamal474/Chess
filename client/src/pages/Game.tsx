import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PLAYER1, PLAYER2, type BoardTheme, type PlayerId, type Profile, type SquareId } from "../lib/types";
import { engineId, initialPieces, oppositePlayer, ownColor, type Piece, type PieceColor } from "../lib/pieces";
import { useChessGame, type MoveRow } from "../hooks/useChessGame";
import { useElementSize } from "../hooks/useElementSize";
import Board from "../components/Board";
import ChatBox from "../components/ChatBox";
import MoveLog from "../components/MoveLog";
import ThemePicker from "../components/ThemePicker";
import NavBar from "../components/NavBar";
import PlayerStrip, { StripButton, type StripTone } from "../components/PlayerStrip";
import NamePrompt from "../components/NamePrompt";
import GameOverDialog from "../components/GameOverDialog";
import { UndoNotice, UndoPendingBar, UndoRequestDialog } from "../components/UndoOverlay";
import { saveChosenCountry, useNationality } from "../components/NationalityBadge";
import PausedOverlay from "../components/PausedOverlay";

// Dev tools panel. import.meta.env.DEV is false in production builds, so the
// import below is dropped and the panel's code never reaches the bundle.
const DevPanel = import.meta.env.DEV ? lazy(() => import("../dev/DevPanel")) : null;

// ---- Layout ----
// The board is sized in px from the space left over, so it is always square
// and as large as it can be. The side column has a fixed width instead of
// taking every leftover pixel; any extra width becomes margin.
const SIDE_W = 340;          // moves + chat column
const RAIL_W = 56;           // both panels collapsed
const GAP = 12;              // board column ↔ side column
const STRIP_H = 48;          // player strip
const STRIPS = 2 * STRIP_H + 2 * 8; // two strips + their gaps to the board
const MIN_SIDE_STACKED = 220;       // side panels under the board (portrait)
const RAIL_H_STACKED = 44;

const PANELS_KEY = "chess.panels";
const NAME_KEY = "chess.name";

function readPanels(): { moves: boolean; chat: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(PANELS_KEY) || "null");
    if (v && typeof v.moves === "boolean" && typeof v.chat === "boolean") return v;
  } catch {
    /* ignore */
  }
  return { moves: true, chat: true };
}
function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

// ---- Material ----
const VALUE: Record<string, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
/** "queen__pawn3" → "queen", "rook1" → "rook". */
const kindOf = (id: string) => id.split("__")[0].replace(/\d+$/, "");

function material(pieces: Piece[]) {
  const start = initialPieces();
  const taken = (color: PieceColor) => {
    const present = new Set(pieces.filter((p) => p.color === color).map((p) => engineId(p.id)));
    return start
      .filter((p) => p.color === color && !present.has(p.id))
      .map((p) => p.id)
      .sort((a, b) => VALUE[kindOf(a)] - VALUE[kindOf(b)]);
  };
  const score = (color: PieceColor) =>
    pieces.filter((p) => p.color === color).reduce((n, p) => n + (VALUE[kindOf(p.id)] ?? 0), 0);
  return { takenW: taken("W"), takenB: taken("B"), diff: score("W") - score("B") };
}

/** "12. Bf4" / "12… O-O" — the last move `p` made. */
function lastMoveOf(rows: MoveRow[], p: PlayerId): string | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (p === PLAYER1 && r.white) return `${r.i}. ${r.white}`;
    if (p === PLAYER2 && r.black) return `${r.i}… ${r.black}`;
  }
  return null;
}

export default function Game() {
  const nav = useNavigate();
  const game = useChessGame();
  const nationality = useNationality();
  const [showTheme, setShowTheme] = useState(false);
  const [theme, setTheme] = useState<BoardTheme>("default");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!game.roomCode) nav("/", { replace: true });
  }, [game.roomCode, nav]);

  const me = game.playerId;
  const opp = oppositePlayer(me);

  // ---------- Name prompt ----------
  const [needName, setNeedName] = useState(true);
  const submitProfile = (profile: Profile) => {
    try {
      localStorage.setItem(NAME_KEY, profile.name);
    } catch {
      /* ignore */
    }
    if (profile.country?.code !== nationality?.code) saveChosenCountry(profile.country);
    game.setProfile(profile);
    setNeedName(false);
  };
  const nameOf = useCallback(
    (p: PlayerId) => (game.profiles[p]?.name || (p === me ? "YOU" : "OPPONENT")).toUpperCase(),
    [game.profiles, me]
  );

  // ---------- Panels ----------
  const [panels, setPanels] = useState(readPanels);
  useEffect(() => {
    try {
      localStorage.setItem(PANELS_KEY, JSON.stringify(panels));
    } catch {
      /* ignore */
    }
  }, [panels]);
  // Under the board (phones, portrait) there's room for one panel at a time,
  // so opening one closes the other there.
  const stackedRef = useRef(false);
  const toggleMoves = () =>
    setPanels((p) => ({ moves: !p.moves, chat: stackedRef.current && !p.moves ? false : p.chat }));
  const toggleChat = () =>
    setPanels((p) => ({ chat: !p.chat, moves: stackedRef.current && !p.chat ? false : p.moves }));
  const anyOpen = panels.moves || panels.chat;

  const [seen, setSeen] = useState(0);
  useEffect(() => {
    if (panels.chat) setSeen(game.messages.length);
  }, [panels.chat, game.messages.length]);
  const unread = panels.chat ? 0 : game.messages.slice(seen).filter((m) => m.from !== me).length;

  // ---------- Board size ----------
  const mainRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(mainRef);
  const sideW = anyOpen ? SIDE_W : RAIL_W;
  const besideBoard = Math.min(height - STRIPS, width - sideW - GAP);
  const belowBoard = Math.min(width, height - STRIPS - GAP - (anyOpen ? MIN_SIDE_STACKED : RAIL_H_STACKED));
  // Until the first measurement both sizes are meaningless; assume side-by-side.
  const stacked = width > 0 && height > 0 && belowBoard > besideBoard;
  stackedRef.current = stacked;
  // Arriving in the stacked layout with both open: keep chat, fold moves.
  useEffect(() => {
    if (stacked && panels.moves && panels.chat) setPanels({ moves: false, chat: true });
  }, [stacked, panels.moves, panels.chat]);
  const board = Math.max(160, Math.floor(stacked ? belowBoard : besideBoard));

  // ---------- Opponent left / rejoined ----------
  // The relay forgets a leaver's profile; remember the name to say who left.
  const lastOppName = useRef<string | null>(null);
  if (game.profiles[opp]?.name) lastOppName.current = game.profiles[opp]!.name.toUpperCase();
  const oppAway = game.started && Boolean(game.presence) && !game.presence!.seats[opp];
  const paused = Boolean(game.presence?.paused);
  const [presenceNotice, setPresenceNotice] = useState<{ text: string; at: number } | null>(null);
  const wasAway = useRef(false);
  useEffect(() => {
    if (wasAway.current && !oppAway) setPresenceNotice({ text: "NEW OPPONENT JOINED · PLAY ON", at: Date.now() });
    wasAway.current = oppAway;
  }, [oppAway]);

  // ---------- Status ----------
  const result = game.result;
  const disabled = Boolean(result) || paused;
  const { takenW, takenB, diff } = useMemo(() => material(game.pieces), [game.pieces]);

  const statusFor = (p: PlayerId): { status: string; tone: StripTone } => {
    if (result) {
      if (!result.winner) return { status: "DRAW", tone: "plain" };
      return result.winner === p ? { status: "♔ WINNER", tone: "accent" } : { status: "—", tone: "plain" };
    }
    if (!game.started) return { status: "—", tone: "plain" };
    if (paused) return { status: "PAUSED", tone: "plain" };
    if (game.currentTurn === p) return p === me ? { status: "YOUR MOVE", tone: "accent" } : { status: "THINKING…", tone: "ink" };
    return { status: "WAITING", tone: "plain" };
  };
  const stripProps = (p: PlayerId) => {
    const color = ownColor(p);
    return {
      profile: game.profiles[p],
      fallbackName: p === me ? "YOU" : "OPPONENT",
      color,
      isYou: p === me,
      // Pieces this player took are the other colour's missing ones.
      captured: color === "W" ? takenB : takenW,
      advantage: color === "W" ? diff : -diff,
      ...statusFor(p),
    };
  };

  // ---------- Undo ----------
  const undo = game.undoState;
  const pending = undo.pending;
  const undosLeft = Math.max(0, undo.max - (undo.used[me] ?? 0));
  const hotSeat = Boolean(game.dev?.hotSeat);
  const myMoveMade = game.moveRows.some((r) => (ownColor(me) === "W" ? r.white : r.black));
  const canUndo =
    game.started &&
    !result &&
    !paused &&
    !pending &&
    undosLeft > 0 &&
    (hotSeat ? game.moveRows.length > 0 : game.currentTurn !== me && myMoveMade);
  const deadline = pending ? (undo.receivedAt ?? Date.now()) + pending.expiresIn : null;

  const notice = useMemo(() => {
    const e = game.undoEvent;
    if (!e) return null;
    if (e.by === me) {
      switch (e.type) {
        case "accepted": return `UNDO ACCEPTED · ${undosLeft} LEFT`;
        case "declined": return `${nameOf(opp)} DECLINED YOUR UNDO`;
        case "expired":  return "NO ANSWER · UNDO DECLINED";
        case "failed":   return "NOTHING TO UNDO";
        default:         return null;
      }
    }
    if (e.type === "expired") return "UNDO REQUEST TIMED OUT";
    if (e.type === "cancelled") return `${nameOf(opp)} WITHDREW THE UNDO`;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.undoEvent]);

  // ---------- Resign: second click confirms ----------
  const [resignArmed, setResignArmed] = useState(false);
  useEffect(() => {
    if (!resignArmed) return;
    const t = window.setTimeout(() => setResignArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [resignArmed]);
  const onResign = () => {
    if (!resignArmed) return setResignArmed(true);
    setResignArmed(false);
    game.resign();
  };

  // ---------- Result dialog ----------
  const [resultClosed, setResultClosed] = useState(false);
  useEffect(() => setResultClosed(false), [result]);

  const copyRoom = () => {
    navigator.clipboard.writeText(game.roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const time = `${game.timer.hh}:${game.timer.mm}:${game.timer.ss}`;
  // Header clock drops the hours until there are some.
  const clock = game.timer.hh === "00" ? `${game.timer.mm}:${game.timer.ss}` : time;

  return (
    // Fixed-viewport shell — no page scroll.
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#fafafa] text-black">
      {/* ================= Header: menu, wordmark, room, clock ================= */}
      <header className="border-b-3 border-black bg-white shrink-0">
        <div className="flex items-center justify-between gap-3 px-3 sm:px-4 h-16">
          <div className="flex items-center gap-4 shrink-0">
            <NavBar
              onOpenThemes={() => setShowTheme(true)}
              onReset={game.reset}
              onLeave={() => nav("/")}
            />
            <h1 className="hidden sm:block font-display text-2xl tracking-tighter leading-none">C H E S S</h1>
          </div>

          <div className="brut h-11 min-w-0 flex divide-x-[3px] divide-black overflow-hidden">
            <div className="flex items-center gap-2 sm:gap-2.5 pl-2.5 sm:pl-3.5 pr-2 min-w-0">
              <span className="label opacity-70 text-[10px] hidden sm:inline">ROOM</span>
              <span className="font-mono text-base sm:text-lg font-bold tracking-wider leading-none truncate">{game.roomCode}</span>
              <button
                onClick={copyRoom}
                type="button"
                className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-1 border-2 border-black bg-white hover:bg-black hover:text-white leading-none"
                title="Copy room code"
                aria-label="Copy room code"
              >
                {copied ? "✓" : "COPY"}
              </button>
            </div>
            <div className="shrink-0 flex items-center gap-2.5 px-3 sm:px-4 bg-black text-white" aria-label={`Time ${time}`}>
              <span className="text-[10px] font-bold tracking-[0.12em] opacity-70 hidden sm:inline">TIME</span>
              <span className="font-mono text-lg sm:text-xl font-bold tabular-nums leading-none tracking-tight">{clock}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ================= Board + side column ================= */}
      <main ref={mainRef} className="flex-1 min-h-0 p-4 overflow-hidden">
        <div className={stacked ? "h-full flex flex-col items-center gap-3" : "h-full flex justify-center gap-3"}>
          {/* Board column: opponent, board, you */}
          <div className="flex flex-col gap-2 shrink-0" style={{ width: board }}>
            <PlayerStrip
              {...stripProps(opp)}
              waiting={!game.started || oppAway}
              waitingText={oppAway ? `${lastOppName.current ?? "OPPONENT"} LEFT · WAITING…` : undefined}
              waitingHint={`SHARE ROOM ${game.roomCode}`}
            />

            <div className="relative shrink-0" style={{ width: board, height: board }}>
              <Board
                playerId={me}
                activePlayerId={game.actingPlayer}
                pieces={game.pieces}
                highlightMoves={game.highlightMoves}
                highlightCaptures={game.highlightCaptures}
                recentMove={game.recentMove}
                checkedKingSquare={game.checkedKingSquare}
                selectedKey={game.selectedKey}
                theme={theme}
                disabled={disabled}
                onSelectPiece={(p: Piece) => game.selectPiece(p)}
                onSquareClick={(sq: SquareId) => game.moveTo(sq)}
                onMoveByDrag={(_p: Piece, sq: SquareId) => game.moveTo(sq)}
              />

              {pending && deadline && pending.by !== me && !hotSeat && (
                <UndoRequestDialog
                  opponentName={nameOf(opp)}
                  move={lastMoveOf(game.moveRows, opp)}
                  used={undo.used[opp] ?? 0}
                  max={undo.max}
                  deadline={deadline}
                  totalMs={pending.expiresIn}
                  onAllow={() => game.respondUndo(true)}
                  onDecline={() => game.respondUndo(false)}
                />
              )}
              {pending && deadline && pending.by === me && (
                <UndoPendingBar
                  opponentName={nameOf(opp)}
                  move={lastMoveOf(game.moveRows, me)}
                  deadline={deadline}
                  onCancel={game.cancelUndo}
                />
              )}
              {!pending && <UndoNotice text={notice} at={game.undoEvent?.at ?? 0} />}
              {presenceNotice && !oppAway && <UndoNotice text={presenceNotice.text} at={presenceNotice.at} />}
              {oppAway && !needName && (
                <PausedOverlay
                  who={lastOppName.current}
                  roomCode={game.roomCode}
                  moves={game.moveRows.length}
                  colorName={ownColor(opp) === "W" ? "WHITE" : "BLACK"}
                  gameOver={Boolean(result)}
                />
              )}
            </div>

            <PlayerStrip {...stripProps(me)}>
              {pending?.by === me ? (
                <StripButton variant="pending" disabled>
                  ↶<span className="hidden sm:inline">ASKED…</span>
                </StripButton>
              ) : (
                <StripButton
                  onClick={game.requestUndo}
                  disabled={!canUndo}
                  ariaLabel={`Ask to undo your last move, ${undosLeft} left`}
                  title={
                    undosLeft === 0
                      ? "No undos left this game"
                      : "Ask your opponent to take back your last move"
                  }
                >
                  ↶<span className="hidden sm:inline">{undosLeft === 0 ? "NO UNDOS" : "UNDO"}</span>
                  {undosLeft > 0 && (
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 border-2 border-black font-mono text-[11px] leading-none">
                      {undosLeft}
                    </span>
                  )}
                </StripButton>
              )}
              <StripButton
                variant={resignArmed ? "armed" : "danger"}
                onClick={onResign}
                disabled={disabled || !game.started}
                title={resignArmed ? "Click again to resign" : "Resign"}
                ariaLabel={resignArmed ? "Confirm resign" : "Resign"}
              >
                ✕
                <span className={resignArmed ? "" : "hidden sm:inline"}>{resignArmed ? "SURE?" : "RESIGN"}</span>
              </StripButton>
            </PlayerStrip>
          </div>

          {/* Side column: moves + chat, each collapsible */}
          {anyOpen ? (
            <aside
              className={stacked ? "flex-1 min-h-0 flex flex-col gap-3" : "shrink-0 flex flex-col gap-3"}
              style={stacked ? { width: board } : { width: SIDE_W, height: board + STRIPS }}
            >
              <div className={panels.moves ? (panels.chat ? "flex-[3] min-h-0" : "flex-1 min-h-0") : "shrink-0"}>
                <MoveLog rows={game.moveRows} open={panels.moves} onToggle={toggleMoves} />
              </div>
              <div className={panels.chat ? (panels.moves ? "flex-[2] min-h-0" : "flex-1 min-h-0") : "shrink-0"}>
                <ChatBox
                  me={me}
                  messages={game.messages}
                  onSend={game.sendChat}
                  open={panels.chat}
                  onToggle={toggleChat}
                  unread={unread}
                />
              </div>
            </aside>
          ) : (
            <aside
              className={stacked ? "shrink-0 flex gap-3" : "shrink-0 flex flex-col gap-3"}
              style={stacked ? { width: board, height: RAIL_H_STACKED } : { width: RAIL_W }}
            >
              <RailButton stacked={stacked} onClick={toggleMoves} label="MOVES" ariaLabel="Show moves">
                <span className="font-mono opacity-60">{game.moveRows.length}</span>
              </RailButton>
              <RailButton
                stacked={stacked}
                onClick={toggleChat}
                label="CHAT"
                ariaLabel={unread ? `Show chat, ${unread} unread` : "Show chat"}
                badge={unread || undefined}
              />
            </aside>
          )}
        </div>
      </main>

      {/* Dev builds only: a floating drawer, not part of the layout. */}
      {DevPanel && (
        <Suspense fallback={null}>
          <DevPanel game={game} />
        </Suspense>
      )}

      <ThemePicker
        open={showTheme}
        onClose={() => setShowTheme(false)}
        theme={theme}
        onChange={setTheme}
      />

      <NamePrompt
        open={needName && Boolean(game.roomCode)}
        roomCode={game.roomCode}
        showShare={game.isCreator && !game.started}
        note={
          game.resumed
            ? `JOINING A GAME IN PROGRESS · YOU PLAY ${ownColor(me) === "W" ? "WHITE" : "BLACK"}${
                game.moveRows.length ? ` · MOVE ${game.moveRows.length}` : ""
              }`
            : null
        }
        defaultName={readName()}
        defaultCountry={nationality}
        onSubmit={submitProfile}
      />

      {result && (
        <GameOverDialog
          open={!resultClosed}
          result={result}
          me={me}
          profiles={game.profiles}
          nameOf={nameOf}
          moves={game.moveRows.length}
          time={time}
          onRematch={() => {
            setResultClosed(true);
            game.reset();
          }}
          onMenu={() => nav("/")}
          onClose={() => setResultClosed(true)}
        />
      )}
    </div>
  );
}

/** One button of the collapsed side rail: vertical beside the board, horizontal below it. */
function RailButton({
  stacked,
  onClick,
  label,
  ariaLabel,
  badge,
  children,
}: {
  stacked: boolean;
  onClick: () => void;
  label: string;
  ariaLabel: string;
  badge?: number;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={[
        "btn relative gap-2.5 text-[11px] tracking-[0.16em]",
        stacked ? "flex-1 h-full p-0" : "h-40 p-0 [writing-mode:vertical-rl]",
      ].join(" ")}
    >
      {label}
      {children}
      {badge !== undefined && (
        <span className="absolute -top-2.5 -right-2.5 [writing-mode:horizontal-tb] w-6 h-6 flex items-center justify-center border-2 border-black bg-accent font-mono text-xs">
          {badge}
        </span>
      )}
    </button>
  );
}
