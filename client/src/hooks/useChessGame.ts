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
  ownColor,
  pieceKey,
  strPosition,
  type Piece,
  type PieceColor,
} from "../lib/pieces";
import { PLAYER1, PLAYER2, type PlayerId, type PosObj, type SquareId } from "../lib/types";
import { useTimer } from "./useTimer";

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

export type ChessGame = {
  // room
  roomCode: string;
  isCreator: boolean;
  playerId: PlayerId;
  /** Who this tab moves for right now: playerId, or whoever's turn it is in hot-seat mode. */
  actingPlayer: PlayerId;

  // state
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
  gameOver: string | null;
  timer: ReturnType<typeof useTimer>;

  // actions
  selectPiece: (piece: Piece) => void;
  moveTo: (square: SquareId) => void;
  clearSelection: () => void;
  sendChat: (text: string) => void;
  undo: () => void;
  redo: () => void;
  resign: () => void;
  reset: () => void;
  dismissGameOver: () => void;

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
  const [gameOver, setGameOver] = useState<string | null>(null);

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
  const pendingRef = useRef<PendingMove | null>(null);

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
    const doJoin = () => {
      if (isCreator) {
        log.info("useChessGame", `createRoom ${roomCode} as ${playerId}`);
        socket.emit("createRoom", roomCode, playerId);
        if (import.meta.env.DEV && sessionStorage.getItem("devSolo") === "true") {
          // Dev "solo game": the relay starts the room without a second player.
          import("../dev/devClient").then((m) => m.startSolo(roomCode));
        }
      } else {
        log.info("useChessGame", `joinRoom ${roomCode}`);
        socket.emit("joinRoom", roomCode);
      }
    };
    if (socket.connected) doJoin();
    else socket.once("connect", doJoin);
    return () => {
      socket.off("connect", doJoin);
    };
  }, [isCreator, playerId, roomCode]);

  // ---------- Socket handlers ----------
  useEffect(() => {
    const onStart = () => timerRef.current.reset();

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
      const winnerColor = pId === PLAYER1 ? "Black" : "White";
      const who = pId === playerId ? "opponent" : "you";
      log.info("useChessGame", `checkmate — ${winnerColor} wins (${who})`);
      setGameOver(`Checkmate — ${winnerColor} wins (${who})`);
      playNotify();
    };

    const onStaleMate = () => {
      timerRef.current.stop();
      log.info("useChessGame", "stalemate");
      setGameOver("Stalemate — draw");
      playNotify();
    };

    const onServerChat = (pId: PlayerId, msg: string) =>
      setMessages((prev) => [...prev, { from: pId, text: msg }]);

    const onServerResign = (pId: PlayerId) => {
      timerRef.current.stop();
      legalRef.current = null;
      const who = pId === playerId ? "You" : "Opponent";
      setGameOver(`${who} resigned.`);
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
      setGameOver(null);
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
    };
  }, [addMoveRow, applyMove, playerId, setPieceSquare, showTargets]);

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
      setGameOver(null);
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
    gameOver,
    timer,
    selectPiece,
    moveTo,
    clearSelection,
    sendChat: (text) => socket.emit("chatText", playerId, text),
    // The engine lets only the player who made the last move undo it (and
    // redo it). In hot-seat mode that's whoever isn't to move / is to move.
    undo:   () => socket.emit("undo", hotSeat ? (currentTurn === PLAYER1 ? PLAYER2 : PLAYER1) : playerId),
    redo:   () => socket.emit("redo", hotSeat ? currentTurn : playerId),
    resign: () => socket.emit("resign", playerId),
    reset:  () => socket.emit("reset", playerId),
    dismissGameOver: () => setGameOver(null),
    dev: import.meta.env.DEV ? { hotSeat, setHotSeat } : undefined,
  };
}
