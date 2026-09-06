// useChessGame — a single hook that owns the game state and all socket wiring.
// The React tree below only reads state and calls back into the returned
// `actions` object. All side-effects happen here.
//
// Lifecycle:
//   mount:  emit createRoom / joinRoom depending on session-storage flags
//   during: socket listeners drive board / move-log / chat / timers
//   unmount: detaches every listener; the socket stays alive so it can be
//            re-attached from another mount without renegotiating.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { log } from "../lib/logger";
import { playCapture, playMove, playNotify } from "../lib/audio";
import {
  initialPieces,
  moveNotation,
  objPosition,
  ownColor,
  strPosition,
  type Piece,
  type PieceColor,
} from "../lib/pieces";
import { PLAYER1, PLAYER2, type PlayerId, type SquareId } from "../lib/types";
import { useTimer } from "./useTimer";

export type ChatMsg = { from: PlayerId; text: string };
export type MoveRow = { i: number; white: string; black: string };

export type ChessGame = {
  // room
  roomCode: string;
  isCreator: boolean;
  playerId: PlayerId;

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
};

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

  const timer = useTimer();
  const timerRef = useRef(timer);
  timerRef.current = timer;

  // Kept as a ref because socket listeners live for the mount lifetime and
  // we don't want to re-register them just because the pieces state changed.
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;

  // ---------- Low-level piece mutation ----------
  const setPieceSquare = useCallback(
    (color: PieceColor, id: string, square: SquareId | null) => {
      setPieces((prev) => {
        const next = prev.slice();
        const idx = next.findIndex((p) => p.color === color && p.id === id);
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

  const captureAt = useCallback((sq: SquareId): boolean => {
    let captured = false;
    setPieces((prev) => {
      const next = prev.filter((p) => {
        if (p.square === sq) {
          captured = true;
          return false;
        }
        return true;
      });
      return next;
    });
    return captured;
  }, []);

  // ---------- Socket lifecycle ----------
  useEffect(() => {
    if (!roomCode) return;
    const doJoin = () => {
      if (isCreator) {
        log.info("useChessGame", `createRoom ${roomCode} as ${playerId}`);
        socket.emit("createRoom", roomCode, playerId);
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

    const onServerPieceMove = (
      pId: PlayerId,
      pieceId: string,
      oldPos: { x: number; y: number },
      newPos: { x: number; y: number }
    ) => {
      const color: PieceColor = pId === PLAYER1 ? "W" : "B";
      const from = strPosition(oldPos);
      const to = strPosition(newPos);
      const captured = captureAt(to);
      setPieceSquare(color, pieceId, to);
      setRecentMove({ from, to });
      captured ? playCapture() : playMove();

      setMoveRows((prev) => {
        const rows = prev.slice();
        const notation = moveNotation(pieceId, to, captured);
        if (pId === PLAYER1) {
          rows.push({ i: rows.length + 1, white: notation, black: "" });
        } else if (rows.length > 0) {
          rows[rows.length - 1] = { ...rows[rows.length - 1], black: notation };
        }
        return rows;
      });
    };

    const onChangeTurn = (turn: PlayerId) => {
      setCurrentTurn(turn);
      setCheckedPlayer(null);
      setHighlightMoves([]);
      setHighlightCaptures([]);
      setSelectedKey(null);
      if (turn === playerId) socket.emit("checkOrMateStatus", playerId);
    };

    const onServerPieceFocus = (
      pId: PlayerId,
      positions: { x: number; y: number }[] | null
    ) => {
      if (pId !== playerId) return;
      if (!positions) {
        setHighlightMoves([]);
        setHighlightCaptures([]);
        return;
      }
      const my = ownColor(playerId);
      const moves: SquareId[] = [];
      const caps: SquareId[] = [];
      for (const pos of positions) {
        const sq = strPosition(pos);
        const occupied = piecesRef.current.find((p) => p.square === sq);
        if (occupied && occupied.color !== my) caps.push(sq);
        else moves.push(sq);
      }
      setHighlightMoves(moves);
      setHighlightCaptures(caps);
    };

    const onCheck = (pId: PlayerId) => { log.debug("useChessGame", `check on ${pId}`); setCheckedPlayer(pId); };

    const onCheckMate = (pId: PlayerId) => {
      timerRef.current.stop();
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
      const who = pId === playerId ? "You" : "Opponent";
      setGameOver(`${who} resigned.`);
    };

    const onServerReset = () => {
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

    // The C++ engine auto-promotes pawns to queens. This handler used to update
    // the piece image; with glyphs we swap the `id` prefix so the piece renders
    // as its new kind.
    const onServerPromotion = (
      pId: PlayerId,
      pieceId: string,
      _position: { x: number; y: number },
      newPieceId: string
    ) => {
      const color: PieceColor = pId === PLAYER1 ? "W" : "B";
      setPieces((prev) =>
        prev.map((p) =>
          p.color === color && p.id === pieceId
            ? { ...p, id: `${newPieceId}__${pieceId}` } // stable-but-unique replacement id
            : p
        )
      );
      if (pId === playerId) {
        const opp = playerId === PLAYER1 ? PLAYER2 : PLAYER1;
        socket.emit("checkOrMateStatus", opp);
      }
    };

    const onServerUndo = (
      pId: PlayerId,
      pieceId: string,
      position: { x: number; y: number },
      isDemoted: string,
      revivedPlayerId: PlayerId,
      revivedPieceId: string,
      revivedPosition: { x: number; y: number } | null
    ) => {
      const color: PieceColor = pId === PLAYER1 ? "W" : "B";
      setPieceSquare(color, pieceId, strPosition(position));
      if (isDemoted === "yes") {
        // Was promoted; restore its original id prefix.
        setPieces((prev) =>
          prev.map((p) =>
            p.color === color && p.id.endsWith(`__${pieceId}`)
              ? { ...p, id: pieceId }
              : p
          )
        );
      }
      if (revivedPieceId !== "NIL" && revivedPosition) {
        const rcolor: PieceColor = revivedPlayerId === PLAYER1 ? "W" : "B";
        setPieceSquare(rcolor, revivedPieceId, strPosition(revivedPosition));
      }
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
      position: { x: number; y: number },
      pawnPromoted: string,
      killedPlayerId: PlayerId,
      killedPieceId: string,
      killedPosition: { x: number; y: number } | null
    ) => {
      const color: PieceColor = pId === PLAYER1 ? "W" : "B";
      if (killedPieceId !== "NIL" && killedPosition) {
        const kcolor: PieceColor = killedPlayerId === PLAYER1 ? "W" : "B";
        setPieceSquare(kcolor, killedPieceId, null);
      }
      setPieceSquare(color, pieceId, strPosition(position));
      if (pawnPromoted === "yes") {
        setPieces((prev) =>
          prev.map((p) =>
            p.color === color && p.id === pieceId
              ? { ...p, id: `queen__${pieceId}` }
              : p
          )
        );
      }
    };

    socket.on("startGame", onStart);
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
  }, [captureAt, playerId, setPieceSquare]);

  // ---------- Auto-queen promotion (asks the server) ----------
  useEffect(() => {
    const my = ownColor(playerId);
    const lastRank = my === "W" ? "8" : "1";
    // Only look at real pawns (not already-promoted, which have a "__pawnN" suffix)
    const candidates = pieces.filter(
      (p) => p.color === my && /^pawn\d+$/.test(p.id) && p.square[0] === lastRank
    );
    for (const p of candidates) {
      socket.emit("getAlreadyPromotedPawnOf", playerId, (already: string[]) => {
        if (!already.includes(p.id)) {
          const next = [...already, p.id];
          socket.emit("updateAlreadyPromotedPawnOf", playerId, next);
          socket.emit("pawnPromotion", playerId, p.id, objPosition(p.square), "queen");
        }
      });
    }
  }, [pieces, playerId]);

  // ---------- Actions exposed to the tree ----------
  const selectPiece = useCallback(
    (p: Piece) => {
      if (p.color !== ownColor(playerId)) return;
      setSelectedKey(`${p.color}-${p.id}`);
      socket.emit("pieceFocus", playerId, p.id);
    },
    [playerId]
  );

  const clearSelection = useCallback(() => {
    setSelectedKey(null);
    setHighlightMoves([]);
    setHighlightCaptures([]);
  }, []);

  const moveTo = useCallback(
    (sq: SquareId) => {
      if (!selectedKey) return;
      const [color, id] = selectedKey.split("-") as [PieceColor, string];
      const piece = piecesRef.current.find((p) => p.color === color && p.id === id);
      if (!piece) return;
      const oldPos = piece.square;
      if (oldPos === sq) {
        clearSelection();
        return;
      }
      socket.emit(
        "pieceMove",
        playerId,
        piece.id,
        objPosition(oldPos),
        objPosition(sq)
      );
      clearSelection();
    },
    [clearSelection, playerId, selectedKey]
  );

  // ---------- Derived: checked king square ----------
  const checkedKingSquare = useMemo<SquareId | null>(() => {
    if (!checkedPlayer) return null;
    const c: PieceColor = checkedPlayer === PLAYER1 ? "W" : "B";
    const k = pieces.find((p) => p.color === c && p.id === "king");
    return k?.square ?? null;
  }, [checkedPlayer, pieces]);

  return {
    roomCode,
    isCreator,
    playerId,
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
    undo:   () => socket.emit("undo", playerId),
    redo:   () => socket.emit("redo", playerId),
    resign: () => socket.emit("resign", playerId),
    reset:  () => socket.emit("reset", playerId),
    dismissGameOver: () => setGameOver(null),
  };
}
