// useChessGame — a single hook that owns the game state and all socket wiring.
// The React tree below only reads state and calls back into the returned
// `actions` object. All side-effects happen here.
//
// Lifecycle:
//   mount:  emit createRoom / joinRoom depending on session-storage flags
//   during: socket listeners drive board / move-log / chat / timers
//   unmount: detaches every listener; the socket stays alive so it can be
//            re-attached from another mount without renegotiating.
//
// Latency: the relay pushes `legalMoves` for the side to move at the start of
// every turn, plus check / mate / promotion with the move itself. So:
//   * selecting a piece highlights from that list, no request;
//   * your own move is shown immediately (optimistically) and rolled back if
//     the relay's ack says it was rejected;
//   * nothing is ever requested to find out about check or promotion.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { log } from "../lib/logger";
import { playCapture, playMove, playNotify } from "../lib/audio";
import {
  engineId,
  initialPieces,
  isPiece,
  moveNotation,
  objPosition,
  oppositePlayer,
  ownColor,
  pieceKey,
  strPosition,
  type Piece,
  type PieceColor,
} from "../lib/pieces";
import {
  PLAYER1,
  PLAYER2,
  type GameResult,
  type PlayerId,
  type PosObj,
  type Presence,
  type Profile,
  type Profiles,
  type SquareId,
  type UndoEvent,
  type UndoState,
} from "../lib/types";
import { useTimer } from "./useTimer";
import { matchTicket } from "../lib/session";

export type ChatMsg = { from: PlayerId; text: string };

/** Board state pushed by the relay's dev tools after loading a game (dev only). */
export type DevSnapshot = {
  name: string;
  ply: number;
  total: number;
  pieces: Piece[];
  turn: PlayerId;
  moveRows: MoveRow[];
  recentMove: { from: SquareId; to: SquareId } | null;
};
export type MoveRow = { i: number; white: string; black: string };

/** The whole position, sent to a player taking over a seat mid-game. */
type Snapshot = {
  pieces: Piece[];
  moveRows: MoveRow[];
  recentMove: { from: SquareId; to: SquareId } | null;
  turn: PlayerId;
  elapsed: number;
};

// Leaving the game page tells the relay, so the other player isn't left
// waiting on an empty seat. Deferred a tick: React (StrictMode, fast refresh)
// unmounts and remounts the page, and a remount cancels the pending leave.
let pendingLeave: number | null = null;

/** Legal moves of the side to move, keyed by engine piece id. */
type LegalMoves = { player: PlayerId; moves: Record<string, PosObj[]> };

/** A move shown before the relay confirmed it. */
type PendingMove = {
  color: PieceColor;
  engineId: string;
  to: SquareId;
  notation: string;
  undo: { pieces: Piece[]; recentMove: { from: SquareId; to: SquareId } | null; legal: LegalMoves | null };
};

const ACK_TIMEOUT_MS = 8000;

const NO_PROFILES: Profiles = { [PLAYER1]: null, [PLAYER2]: null };
const FRESH_UNDO: UndoState = { max: 3, used: { [PLAYER1]: 0, [PLAYER2]: 0 }, pending: null };

export type ChessGame = {
  // room
  roomCode: string;
  isCreator: boolean;
  /** A matchmade game: the seat is held by a ticket, not a shared room code. */
  isMatch: boolean;
  /** The relay called the match off before it started (the opponent never came). */
  matchCancelled: { requeued: boolean } | null;
  playerId: PlayerId;
  /** Who this tab moves for right now: playerId, or whoever's turn it is in hot-seat mode. */
  actingPlayer: PlayerId;

  // state
  /** True once both players are in and the engine has set up the board. */
  started: boolean;
  profiles: Profiles;
  undoState: UndoState;
  /** The latest undo outcome, for a short notice; `at` tells repeats apart. */
  undoEvent: (UndoEvent & { at: number }) | null;
  /** Seats and pause state; null until something changes after the start. */
  presence: Presence | null;
  /** This tab took over a seat in a game already under way. */
  resumed: boolean;
  pieces: Piece[];
  currentTurn: PlayerId;
  checkedPlayer: PlayerId | null;
  checkedKingSquare: SquareId | null;
  recentMove: { from: SquareId; to: SquareId } | null;
  highlightMoves: SquareId[];
  highlightCaptures: SquareId[];
  selectedKey: string | null;
  messages: ChatMsg[];
  moveRows: MoveRow[];
  result: GameResult | null;
  timer: ReturnType<typeof useTimer>;

  // actions
  selectPiece: (piece: Piece) => void;
  moveTo: (square: SquareId) => void;
  clearSelection: () => void;
  sendChat: (text: string) => void;
  setProfile: (profile: Profile) => void;
  /** Ask the opponent to take back your last move. */
  requestUndo: () => void;
  cancelUndo: () => void;
  /** Answer the opponent's undo request. */
  respondUndo: (accept: boolean) => void;
  redo: () => void;
  resign: () => void;
  reset: () => void;

  /** Dev builds only: play both sides from one tab. Undefined in production. */
  dev?: { hotSeat: boolean; setHotSeat: (on: boolean) => void };
};

const colorOf = (p: PlayerId): PieceColor => (p === PLAYER1 ? "W" : "B");

export function useChessGame(): ChessGame {
  const isCreator = sessionStorage.getItem("isCreator") === "true";
  const roomCode =
    (isCreator
      ? sessionStorage.getItem("createRoomId")
      : sessionStorage.getItem("joinRoomId")) || "";
  const playerId = (sessionStorage.getItem("playerID") as PlayerId) || PLAYER1;
  const ticket = isCreator ? null : matchTicket();
  const isMatch = Boolean(ticket);

  const [pieces, setPieces] = useState<Piece[]>(() => initialPieces());
  const [currentTurn, setCurrentTurn] = useState<PlayerId>(PLAYER1);
  const [checkedPlayer, setCheckedPlayer] = useState<PlayerId | null>(null);
  const [recentMove, setRecentMove] = useState<
    { from: SquareId; to: SquareId } | null
  >(null);
  const [highlightMoves, setHighlightMoves] = useState<SquareId[]>([]);
  const [highlightCaptures, setHighlightCaptures] = useState<SquareId[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [moveRows, setMoveRows] = useState<MoveRow[]>([]);
  const [result, setResultState] = useState<GameResult | null>(null);
  const [started, setStarted] = useState(false);
  const [profiles, setProfiles] = useState<Profiles>(NO_PROFILES);
  const [undoState, setUndoState] = useState<UndoState>(FRESH_UNDO);
  const [undoEvent, setUndoEvent] = useState<(UndoEvent & { at: number }) | null>(null);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [resumed, setResumed] = useState(false);
  const [matchCancelled, setMatchCancelled] = useState<{ requeued: boolean } | null>(null);

  // Hot seat (dev only): this tab moves for whichever side is to play. In a
  // production build import.meta.env.DEV is false, so this is always off.
  const [hotSeat, setHotSeatState] = useState(
    () => import.meta.env.DEV && sessionStorage.getItem("devHotSeat") === "true"
  );
  const actingPlayer: PlayerId = hotSeat ? currentTurn : playerId;

  const timer = useTimer();
  const timerRef = useRef(timer);
  timerRef.current = timer;

  // Refs, because socket listeners live for the mount lifetime and shouldn't
  // be re-registered whenever state changes.
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const recentMoveRef = useRef(recentMove);
  recentMoveRef.current = recentMove;
  const legalRef = useRef<LegalMoves | null>(null);
  // Re-sent after (re)joining the room: a profile emitted before the socket
  // connected would otherwise reach the relay ahead of createRoom/joinRoom.
  const profileRef = useRef<Profile | null>(null);
  const pendingRef = useRef<PendingMove | null>(null);
  const resultRef = useRef<GameResult | null>(null);
  resultRef.current = result;
  // Updates the ref at once too: a presence update right behind the result
  // (same tick) must already see the game as over, or the clock restarts.
  const setResult = useCallback((r: GameResult | null) => {
    resultRef.current = r;
    setResultState(r);
  }, []);

  // ---------- Low-level piece mutation ----------

  /** Moves (or removes, or revives) a piece, found by its engine id. */
  const setPieceSquare = useCallback(
    (color: PieceColor, id: string, square: SquareId | null) => {
      setPieces((prev) => {
        const next = prev.slice();
        const idx = next.findIndex((p) => isPiece(p, color, id));
        if (idx === -1) {
          // Reviving a captured piece.
          if (square) next.push({ color, id, square });
        } else if (square === null) {
          next.splice(idx, 1);
        } else {
          next[idx] = { ...next[idx], square };
        }
        return next;
      });
    },
    []
  );

  /** Applies a move locally: captures whatever is on `to`, then moves the piece. */
  const applyMove = useCallback((color: PieceColor, id: string, to: SquareId) => {
    setPieces((prev) =>
      prev
        .filter((p) => p.square !== to)
        .map((p) => (isPiece(p, color, id) ? { ...p, square: to } : p))
    );
  }, []);

  const addMoveRow = useCallback((pId: PlayerId, notation: string) => {
    setMoveRows((prev) => {
      const rows = prev.slice();
      if (pId === PLAYER1) {
        rows.push({ i: rows.length + 1, white: notation, black: "" });
      } else if (rows.length > 0) {
        rows[rows.length - 1] = { ...rows[rows.length - 1], black: notation };
      }
      return rows;
    });
  }, []);

  /** Shows `positions` as move / capture squares for `pId`'s pieces. */
  const showTargets = useCallback((pId: PlayerId, positions: PosObj[]) => {
    const mine = colorOf(pId);
    const moves: SquareId[] = [];
    const caps: SquareId[] = [];
    for (const pos of positions) {
      const sq = strPosition(pos);
      const occupied = piecesRef.current.find((p) => p.square === sq);
      if (occupied && occupied.color !== mine) caps.push(sq);
      else moves.push(sq);
    }
    setHighlightMoves(moves);
    setHighlightCaptures(caps);
  }, []);

  // ---------- Socket lifecycle ----------
  useEffect(() => {
    if (!roomCode) return;
    if (pendingLeave !== null) {
      window.clearTimeout(pendingLeave);
      pendingLeave = null;
    }
    const doJoin = () => {
      if (isCreator) {
        log.info("useChessGame", `createRoom ${roomCode} as ${playerId}`);
        socket.emit("createRoom", roomCode, playerId);
        if (import.meta.env.DEV && sessionStorage.getItem("devSolo") === "true") {
          // Dev "solo game": the relay starts the room without a second player.
          import("../dev/devClient").then((m) => m.startSolo(roomCode));
        }
      } else {
        log.info("useChessGame", `joinRoom ${roomCode}${ticket ? " (matched)" : ""}`);
        if (ticket) socket.emit("joinRoom", roomCode, ticket);
        else socket.emit("joinRoom", roomCode);
      }
      if (profileRef.current) socket.emit("setProfile", playerId, profileRef.current);
    };
    if (socket.connected) doJoin();
    else socket.once("connect", doJoin);
    // A dropped connection loses the seat on the relay; take it back.
    const onReconnect = () => doJoin();
    socket.io.on("reconnect", onReconnect);
    return () => {
      socket.off("connect", doJoin);
      socket.io.off("reconnect", onReconnect);
      pendingLeave = window.setTimeout(() => {
        pendingLeave = null;
        socket.emit("leaveRoom");
      }, 0);
    };
  }, [isCreator, playerId, roomCode, ticket]);

  // ---------- Socket handlers ----------
  useEffect(() => {
    const onStart = () => {
      setStarted(true);
      timerRef.current.reset();
    };

    const onLegalMoves = (pId: PlayerId, moves: Record<string, PosObj[]>) => {
      legalRef.current = { player: pId, moves: moves || {} };
    };

    const onServerPieceMove = (
      pId: PlayerId,
      pieceId: string,
      oldPos: PosObj,
      newPos: PosObj
    ) => {
      const color = colorOf(pId);
      const to = strPosition(newPos);
      const pending = pendingRef.current;

      // Our own optimistic move coming back: the board already shows it.
      if (pending && pending.color === color && pending.engineId === pieceId && pending.to === to) {
        pendingRef.current = null;
        addMoveRow(pId, pending.notation);
        return;
      }

      const from = strPosition(oldPos);
      const current = piecesRef.current;
      const mover = current.find((p) => isPiece(p, color, pieceId));
      const captured = current.some((p) => p.square === to);
      applyMove(color, pieceId, to);
      setRecentMove({ from, to });
      captured ? playCapture() : playMove();
      addMoveRow(pId, moveNotation(mover?.id ?? pieceId, to, captured, from));
    };

    const onChangeTurn = (turn: PlayerId) => {
      setCurrentTurn(turn);
      setCheckedPlayer(null);
      setHighlightMoves([]);
      setHighlightCaptures([]);
      setSelectedKey(null);
    };

    // Fallback path: only used if no legalMoves arrived (older relay).
    const onServerPieceFocus = (pId: PlayerId, positions: PosObj[] | null) => {
      if (legalRef.current) return;
      if (!positions) {
        setHighlightMoves([]);
        setHighlightCaptures([]);
        return;
      }
      showTargets(pId, positions);
    };

    const onCheck = (pId: PlayerId) => { log.debug("useChessGame", `check on ${pId}`); setCheckedPlayer(pId); };

    const onCheckMate = (pId: PlayerId) => {
      timerRef.current.stop();
      setCheckedPlayer(pId);
      log.info("useChessGame", `checkmate — ${oppositePlayer(pId)} wins`);
      setResult({ kind: "checkmate", winner: oppositePlayer(pId) });
      playNotify();
    };

    const onStaleMate = () => {
      timerRef.current.stop();
      log.info("useChessGame", "stalemate");
      setResult({ kind: "stalemate", winner: null });
      playNotify();
    };

    const onServerChat = (pId: PlayerId, msg: string) =>
      setMessages((prev) => [...prev, { from: pId, text: msg }]);

    const onServerResign = (pId: PlayerId) => {
      timerRef.current.stop();
      legalRef.current = null;
      setResult({ kind: "resign", winner: oppositePlayer(pId) });
      playNotify();
    };

    const onServerProfiles = (p: Profiles) => setProfiles({ ...NO_PROFILES, ...(p || {}) });

    const onPresence = (p: Presence) => {
      if (!p) return;
      setPresence(p);
      if (p.left) playNotify();
      // The relay owns the clock: it stops while the game is paused.
      timerRef.current.sync(p.elapsed, !p.paused && !resultRef.current);
    };

    // We took over a seat in a game under way: draw the position as it is.
    const onSnapshot = (s: Snapshot) => {
      log.info("useChessGame", `resuming at ${s.moveRows.length} moves, ${s.turn} to move`);
      pendingRef.current = null;
      legalRef.current = null; // fresh legalMoves follow right after
      setPieces(s.pieces);
      setMoveRows(s.moveRows);
      setRecentMove(s.recentMove);
      setCurrentTurn(s.turn);
      setCheckedPlayer(null);
      setHighlightMoves([]);
      setHighlightCaptures([]);
      setSelectedKey(null);
      setResult(null);
      setStarted(true);
      setResumed(true);
      timerRef.current.sync(s.elapsed, true);
    };

    const onServerUndoState = (state: UndoState, event: UndoEvent | null) => {
      if (state) setUndoState({ ...state, receivedAt: Date.now() });
      if (event) {
        setUndoEvent({ ...event, at: Date.now() });
        if (event.type === "requested" && event.by !== playerId) playNotify();
      }
    };

    const onServerReset = () => {
      legalRef.current = null;
      pendingRef.current = null;
      setPieces(initialPieces());
      setCurrentTurn(PLAYER1);
      setCheckedPlayer(null);
      setRecentMove(null);
      setHighlightMoves([]);
      setHighlightCaptures([]);
      setSelectedKey(null);
      setMoveRows([]);
      setResult(null);
      setUndoEvent(null);
      timerRef.current.reset();
    };

    // The engine promotes a pawn as part of the move; this only changes how
    // the piece renders: "pawn3" → "queen__pawn3".
    const onServerPromotion = (pId: PlayerId, pieceId: string, _position: PosObj, newPieceId: string) => {
      const color = colorOf(pId);
      setPieces((prev) =>
        prev.map((p) =>
          p.color === color && p.id === pieceId ? { ...p, id: `${newPieceId}__${pieceId}` } : p
        )
      );
    };

    const onServerUndo = (
      pId: PlayerId,
      pieceId: string,
      position: PosObj,
      isDemoted: string,
      revivedPlayerId: PlayerId,
      revivedPieceId: string,
      revivedPosition: PosObj | null
    ) => {
      const color = colorOf(pId);
      setPieceSquare(color, pieceId, strPosition(position));
      if (isDemoted === "yes") {
        // Was promoted; it's a pawn again.
        setPieces((prev) =>
          prev.map((p) => (p.color === color && p.id.endsWith(`__${pieceId}`) ? { ...p, id: pieceId } : p))
        );
      }
      if (revivedPieceId !== "NIL" && revivedPosition) {
        setPieceSquare(colorOf(revivedPlayerId), revivedPieceId, strPosition(revivedPosition));
      }
      setRecentMove(null);
      setMoveRows((prev) => {
        const rows = prev.slice();
        if (pId === PLAYER1) rows.pop();
        else if (rows.length > 0)
          rows[rows.length - 1] = { ...rows[rows.length - 1], black: "" };
        return rows;
      });
    };

    const onServerRedo = (
      pId: PlayerId,
      pieceId: string,
      position: PosObj,
      pawnPromoted: string,
      killedPlayerId: PlayerId,
      killedPieceId: string,
      killedPosition: PosObj | null
    ) => {
      const color = colorOf(pId);
      if (killedPieceId !== "NIL" && killedPosition) {
        setPieceSquare(colorOf(killedPlayerId), killedPieceId, null);
      }
      setPieceSquare(color, pieceId, strPosition(position));
      if (pawnPromoted === "yes") {
        setPieces((prev) =>
          prev.map((p) => (p.color === color && p.id === pieceId ? { ...p, id: `queen__${pieceId}` } : p))
        );
      }
    };

    socket.on("startGame", onStart);
    socket.on("legalMoves", onLegalMoves);
    socket.on("serverPieceMove", onServerPieceMove);
    socket.on("changeTurn", onChangeTurn);
    socket.on("serverPieceFocus", onServerPieceFocus);
    socket.on("check", onCheck);
    socket.on("checkMate", onCheckMate);
    socket.on("staleMate", onStaleMate);
    socket.on("serverChatText", onServerChat);
    socket.on("serverResign", onServerResign);
    socket.on("serverReset", onServerReset);
    socket.on("serverPawnPromotion", onServerPromotion);
    socket.on("serverUndo", onServerUndo);
    socket.on("serverRedo", onServerRedo);
    socket.on("serverProfiles", onServerProfiles);
    socket.on("serverUndoState", onServerUndoState);
    const onAbandon = (winner: PlayerId) => {
      timerRef.current.stop();
      legalRef.current = null;
      log.info("useChessGame", `game abandoned, ${winner} wins`);
      setResult({ kind: "abandon", winner });
      playNotify();
    };
    socket.on("serverAbandon", onAbandon);
    const onMatchCancelled = (r: { requeued: boolean }) => setMatchCancelled({ requeued: Boolean(r?.requeued) });
    socket.on("match:cancelled", onMatchCancelled);
    socket.on("serverPresence", onPresence);
    socket.on("serverSnapshot", onSnapshot);

    return () => {
      socket.off("startGame", onStart);
      socket.off("legalMoves", onLegalMoves);
      socket.off("serverPieceMove", onServerPieceMove);
      socket.off("changeTurn", onChangeTurn);
      socket.off("serverPieceFocus", onServerPieceFocus);
      socket.off("check", onCheck);
      socket.off("checkMate", onCheckMate);
      socket.off("staleMate", onStaleMate);
      socket.off("serverChatText", onServerChat);
      socket.off("serverResign", onServerResign);
      socket.off("serverReset", onServerReset);
      socket.off("serverPawnPromotion", onServerPromotion);
      socket.off("serverUndo", onServerUndo);
      socket.off("serverRedo", onServerRedo);
      socket.off("serverProfiles", onServerProfiles);
      socket.off("serverUndoState", onServerUndoState);
      socket.off("match:cancelled", onMatchCancelled);
      socket.off("serverAbandon", onAbandon);
      socket.off("serverPresence", onPresence);
      socket.off("serverSnapshot", onSnapshot);
    };
  }, [addMoveRow, applyMove, playerId, setPieceSquare, setResult, showTargets]);

  // ---------- Dev: apply a board snapshot after the relay loads a game ----------
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onDevState = (s: DevSnapshot) => {
      log.info("useChessGame", `dev: loaded "${s.name}" at ply ${s.ply}/${s.total}`);
      pendingRef.current = null;
      legalRef.current = null; // fresh legalMoves follow right after
      setPieces(s.pieces);
      setCurrentTurn(s.turn);
      setMoveRows(s.moveRows);
      setRecentMove(s.recentMove);
      setCheckedPlayer(null);
      setHighlightMoves([]);
      setHighlightCaptures([]);
      setSelectedKey(null);
      setResult(null);
      setStarted(true);
    };
    socket.on("dev:state", onDevState);
    return () => {
      socket.off("dev:state", onDevState);
    };
  }, []);

  // ---------- Actions exposed to the tree ----------

  const legalTargets = (p: Piece): PosObj[] | null => {
    const legal = legalRef.current;
    if (!legal || legal.player !== actingPlayer) return null;
    return legal.moves[engineId(p.id)] ?? [];
  };

  const selectPiece = useCallback(
    (p: Piece) => {
      if (p.color !== ownColor(actingPlayer)) return;
      setSelectedKey(pieceKey(p));
      const targets = legalTargets(p);
      if (targets) {
        showTargets(actingPlayer, targets); // instant: no request
      } else if (!legalRef.current) {
        socket.emit("pieceFocus", actingPlayer, engineId(p.id)); // older relay
      } else {
        setHighlightMoves([]);
        setHighlightCaptures([]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actingPlayer, showTargets]
  );

  const clearSelection = useCallback(() => {
    setSelectedKey(null);
    setHighlightMoves([]);
    setHighlightCaptures([]);
  }, []);

  const moveTo = useCallback(
    (sq: SquareId) => {
      if (!selectedKey) return;
      const piece = piecesRef.current.find((p) => pieceKey(p) === selectedKey);
      if (!piece) return;
      const from = piece.square;
      if (from === sq) {
        clearSelection();
        return;
      }
      clearSelection();
      const id = engineId(piece.id);
      const targets = legalTargets(piece);

      // Older relay (no legalMoves): send and wait, as before.
      if (!targets) {
        if (!legalRef.current) socket.emit("pieceMove", actingPlayer, id, objPosition(from), objPosition(sq));
        return;
      }
      if (!targets.some((t) => strPosition(t) === sq)) return; // not a legal square

      // Show the move now; the relay confirms or we roll back.
      const captured = piecesRef.current.some((p) => p.square === sq);
      pendingRef.current = {
        color: piece.color,
        engineId: id,
        to: sq,
        notation: moveNotation(piece.id, sq, captured, from),
        undo: { pieces: piecesRef.current, recentMove: recentMoveRef.current, legal: legalRef.current },
      };
      legalRef.current = null; // no second move until the next turn's list
      applyMove(piece.color, id, sq);
      setRecentMove({ from, to: sq });
      captured ? playCapture() : playMove();

      socket
        .timeout(ACK_TIMEOUT_MS)
        .emit("pieceMove", actingPlayer, id, objPosition(from), objPosition(sq), {}, (err: Error | null, res?: { ok: boolean; error?: string }) => {
          if (!err && res?.ok) return;
          const pending = pendingRef.current;
          if (!pending || pending.engineId !== id || pending.to !== sq) return;
          log.warn("useChessGame", `move ${id} → ${sq} not accepted (${err ? "no answer" : res?.error}); rolling back`);
          pendingRef.current = null;
          setPieces(pending.undo.pieces);
          setRecentMove(pending.undo.recentMove);
          legalRef.current = pending.undo.legal;
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actingPlayer, applyMove, clearSelection, selectedKey]
  );

  // ---------- Derived: checked king square ----------
  const checkedKingSquare = useMemo<SquareId | null>(() => {
    if (!checkedPlayer) return null;
    const k = pieces.find((p) => p.color === colorOf(checkedPlayer) && p.id === "king");
    return k?.square ?? null;
  }, [checkedPlayer, pieces]);

  const setHotSeat = useCallback((on: boolean) => {
    if (!import.meta.env.DEV) return;
    sessionStorage.setItem("devHotSeat", String(on));
    setHotSeatState(on);
  }, []);

  return {
    roomCode,
    isCreator,
    isMatch,
    matchCancelled,
    playerId,
    actingPlayer,
    pieces,
    currentTurn,
    checkedPlayer,
    checkedKingSquare,
    recentMove,
    highlightMoves,
    highlightCaptures,
    selectedKey,
    messages,
    moveRows,
    result,
    started,
    profiles,
    undoState,
    undoEvent,
    presence,
    resumed,
    timer,
    selectPiece,
    moveTo,
    clearSelection,
    sendChat: (text) => socket.emit("chatText", playerId, text),
    setProfile: (profile) => {
      profileRef.current = profile;
      if (socket.connected) socket.emit("setProfile", playerId, profile);
    },
    // The engine lets only the player who made the last move undo it, so a
    // request is made while the opponent is to move. In hot-seat mode (dev)
    // there's nobody to ask: the relay's dev-only immediate undo is used.
    requestUndo: () =>
      hotSeat
        ? socket.emit("undo", oppositePlayer(currentTurn))
        : socket.emit("undoRequest", playerId),
    cancelUndo:  () => socket.emit("undoCancel", playerId),
    respondUndo: (accept) => socket.emit("undoRespond", playerId, accept),
    redo:   () => socket.emit("redo", hotSeat ? currentTurn : playerId),
    resign: () => socket.emit("resign", playerId),
    reset:  () => socket.emit("reset", playerId),
    dev: import.meta.env.DEV ? { hotSeat, setHotSeat } : undefined,
  };
}
