import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../lib/socket";
import { PLAYER1, PLAYER2, type BoardTheme, type PlayerId, type SquareId } from "../lib/types";
import {
  initialPieces,
  moveNotation,
  objPosition,
  ownColor,
  strPosition,
  type Piece,
} from "../lib/pieces";
import { playCapture, playMove, playNotify } from "../lib/audio";
import { useTimer } from "../hooks/useTimer";
import Board, { pieceKey } from "../components/Board";
import ChatBox from "../components/ChatBox";
import MoveLog, { type MoveRow } from "../components/MoveLog";
import TurnIndicator from "../components/TurnIndicator";
import ThemePicker from "../components/ThemePicker";
import NavBar from "../components/NavBar";
import Modal from "../components/Modal";

type ChatMsg = { from: PlayerId; text: string };

export default function Game() {
  const nav = useNavigate();

  // -- Read the choice made on the menu page.
  const isCreator = sessionStorage.getItem("isCreator") === "true";
  const roomCode = (isCreator ? sessionStorage.getItem("createRoomId") : sessionStorage.getItem("joinRoomId")) || "";
  const playerId = (sessionStorage.getItem("playerID") as PlayerId) || PLAYER1;

  // If someone lands here without a room, send them back to the menu.
  useEffect(() => {
    if (!roomCode) nav("/", { replace: true });
  }, [roomCode, nav]);

  // -- Game state
  const [pieces, setPieces] = useState<Piece[]>(() => initialPieces());
  const [currentTurn, setCurrentTurn] = useState<PlayerId>(PLAYER1);
  const [checkedPlayer, setCheckedPlayer] = useState<PlayerId | null>(null);
  const [recentMove, setRecentMove] = useState<{ from: SquareId; to: SquareId } | null>(null);
  const [highlightMoves, setHighlightMoves] = useState<SquareId[]>([]);
  const [highlightCaptures, setHighlightCaptures] = useState<SquareId[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [moveRows, setMoveRows] = useState<MoveRow[]>([]);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [showTheme, setShowTheme] = useState(false);
  const [theme, setTheme] = useState<BoardTheme>("default");
  const [copied, setCopied] = useState(false);

  const timer = useTimer();
  const timerRef = useRef(timer);
  timerRef.current = timer;

  // ---------- Piece helpers ----------
  const setPieceSquare = useCallback((color: "W" | "B", id: string, square: SquareId | null) => {
    setPieces((prev) => {
      const next = prev.slice();
      const idx = next.findIndex((p) => p.color === color && p.id === id);
      if (idx === -1) {
        // Reviving a captured piece — add it back.
        if (square) {
          const image = `/images/${color}${id.replace(/\d+$/, "")}.png`;
          next.push({ color, id, square, image });
        }
      } else if (square === null) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], square };
      }
      return next;
    });
  }, []);

  const setPieceImage = useCallback((color: "W" | "B", id: string, newPieceType: string) => {
    setPieces((prev) =>
      prev.map((p) =>
        p.color === color && p.id === id ? { ...p, image: `/images/${color}${newPieceType}.png` } : p
      )
    );
  }, []);

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

  // ---------- Socket bootstrap ----------
  useEffect(() => {
    if (!roomCode) return;

    const doJoin = () => {
      if (isCreator) {
        socket.emit("createRoom", roomCode, playerId);
      } else {
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
    const onStart = () => {
      timerRef.current.reset();
    };
    const onServerPieceMove = (
      pId: PlayerId,
      pieceId: string,
      oldPos: { x: number; y: number },
      newPos: { x: number; y: number }
    ) => {
      const color: "W" | "B" = pId === PLAYER1 ? "W" : "B";
      const from = strPosition(oldPos);
      const to = strPosition(newPos);
      const captured = captureAt(to);
      setPieceSquare(color, pieceId, to);
      setRecentMove({ from, to });
      captured ? playCapture() : playMove();

      // Move-log row.
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
      if (turn === playerId) {
        socket.emit("checkOrMateStatus", playerId);
      }
    };

    const onServerPieceFocus = (pId: PlayerId, positions: { x: number; y: number }[] | null) => {
      if (pId !== playerId) return;
      const my = ownColor(playerId);
      if (!positions) {
        setHighlightMoves([]);
        setHighlightCaptures([]);
        return;
      }
      const moves: SquareId[] = [];
      const caps: SquareId[] = [];
      for (const pos of positions) {
        const sq = strPosition(pos);
        setPieces((prev) => {
          const occupied = prev.find((p) => p.square === sq);
          if (occupied && occupied.color !== my) caps.push(sq);
          else moves.push(sq);
          return prev; // no state change
        });
      }
      setHighlightMoves(moves);
      setHighlightCaptures(caps);
    };

    const onCheck = (pId: PlayerId) => setCheckedPlayer(pId);

    const onCheckMate = (pId: PlayerId) => {
      timerRef.current.stop();
      const winnerColor = pId === PLAYER1 ? "Black" : "White";
      const who = pId === playerId ? "opponent" : "you";
      setGameOver(`Checkmate — ${winnerColor} wins (${who})`);
      playNotify();
    };

    const onStaleMate = () => {
      timerRef.current.stop();
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

    const onServerPromotion = (
      pId: PlayerId,
      pieceId: string,
      _position: { x: number; y: number },
      newPieceId: string
    ) => {
      const color: "W" | "B" = pId === PLAYER1 ? "W" : "B";
      setPieceImage(color, pieceId, newPieceId);
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
      const color: "W" | "B" = pId === PLAYER1 ? "W" : "B";
      setPieceSquare(color, pieceId, strPosition(position));
      if (isDemoted === "yes") {
        setPieceImage(color, pieceId, "pawn");
      }
      if (revivedPieceId !== "NIL" && revivedPosition) {
        const rcolor: "W" | "B" = revivedPlayerId === PLAYER1 ? "W" : "B";
        setPieceSquare(rcolor, revivedPieceId, strPosition(revivedPosition));
      }
      // Trim move log
      setMoveRows((prev) => {
        const rows = prev.slice();
        if (pId === PLAYER1) rows.pop();
        else if (rows.length > 0) rows[rows.length - 1] = { ...rows[rows.length - 1], black: "" };
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
      const color: "W" | "B" = pId === PLAYER1 ? "W" : "B";
      if (killedPieceId !== "NIL" && killedPosition) {
        const kcolor: "W" | "B" = killedPlayerId === PLAYER1 ? "W" : "B";
        setPieceSquare(kcolor, killedPieceId, null);
      }
      setPieceSquare(color, pieceId, strPosition(position));
      if (pawnPromoted === "yes") {
        setPieceImage(color, pieceId, "queen");
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
  }, [captureAt, playerId, setPieceImage, setPieceSquare]);

  // ---------- Interaction handlers ----------
  const selectPiece = useCallback(
    (p: Piece) => {
      if (p.color !== ownColor(playerId)) return;
      setSelectedKey(pieceKey(p));
      socket.emit("pieceFocus", playerId, p.id);
    },
    [playerId]
  );

  const clickSquare = useCallback(
    (sq: SquareId) => {
      if (!selectedKey) return;
      const [color, id] = selectedKey.split("-") as ["W" | "B", string];
      const piece = pieces.find((p) => p.color === color && p.id === id);
      if (!piece) return;
      const oldPos = piece.square;
      if (oldPos === sq) {
        setSelectedKey(null);
        setHighlightMoves([]);
        setHighlightCaptures([]);
        return;
      }
      socket.emit(
        "pieceMove",
        playerId,
        piece.id,
        objPosition(oldPos),
        objPosition(sq)
      );
      setSelectedKey(null);
      setHighlightMoves([]);
      setHighlightCaptures([]);
    },
    [pieces, playerId, selectedKey]
  );

  const startDrag = useCallback(
    (p: Piece) => {
      if (p.color !== ownColor(playerId)) return;
      setSelectedKey(pieceKey(p));
      socket.emit("pieceFocus", playerId, p.id);
    },
    [playerId]
  );

  const dropDrag = useCallback(
    (sq: SquareId) => {
      if (!selectedKey) return;
      clickSquare(sq);
    },
    [clickSquare, selectedKey]
  );

  // ---------- Pawn promotion (auto-queen for now, mirrors old behavior) ----------
  useEffect(() => {
    // After each of MY moves, if my pawn reached last rank, request promotion.
    const my = ownColor(playerId);
    const lastRank = my === "W" ? "8" : "1";
    const myPromoCandidates = pieces.filter(
      (p) => p.color === my && p.id.startsWith("pawn") && p.square[0] === lastRank
    );
    for (const p of myPromoCandidates) {
      socket.emit("getAlreadyPromotedPawnOf", playerId, (already: string[]) => {
        if (!already.includes(p.id)) {
          const next = [...already, p.id];
          socket.emit("updateAlreadyPromotedPawnOf", playerId, next);
          socket.emit("pawnPromotion", playerId, p.id, objPosition(p.square), "queen");
        }
      });
    }
  }, [pieces, playerId]);

  // ---------- Checked king square ----------
  const checkedKingSquare = useMemo<SquareId | null>(() => {
    if (!checkedPlayer) return null;
    const c: "W" | "B" = checkedPlayer === PLAYER1 ? "W" : "B";
    const k = pieces.find((p) => p.color === c && p.id === "king");
    return k?.square ?? null;
  }, [checkedPlayer, pieces]);

  // ---------- UI helpers ----------
  const copyRoom = () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const disabled = Boolean(gameOver);

  return (
    <div className="min-h-screen bg-slate-100 font-serif">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black bg-accent-soft px-4 py-3 shadow">
        <div className="flex items-center gap-3">
          <NavBar
            onOpenThemes={() => setShowTheme(true)}
            onReset={() => socket.emit("reset", playerId)}
            onLeave={() => nav("/")}
          />
          <h1 className="font-display text-3xl tracking-widest">CHESS</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md bg-white px-3 py-1 shadow">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Room</span>
            <span className="font-mono text-lg">{roomCode}</span>
            <button
              onClick={copyRoom}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-black"
              title="Copy room code"
            >
              <span className="material-symbols-outlined text-base">content_copy</span>
            </button>
            {copied && <span className="text-xs text-emerald-700">copied!</span>}
          </div>

          <div className="rounded-md bg-white px-3 py-1 font-mono text-lg shadow">
            {timer.hh}:{timer.mm}:{timer.ss}
          </div>

          <TurnIndicator currentTurn={currentTurn} />
        </div>
      </div>

      {/* Main 3-column layout: move log | board | chat */}
      <div className="mx-auto grid max-w-[1400px] gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="h-[70vh] lg:h-[86vh]">
          <MoveLog
            rows={moveRows}
            disabled={disabled}
            onUndo={() => socket.emit("undo", playerId)}
            onRedo={() => socket.emit("redo", playerId)}
            onResign={() => socket.emit("resign", playerId)}
          />
        </div>

        <div className="flex items-center justify-center">
          <Board
            playerId={playerId}
            pieces={pieces}
            highlightMoves={highlightMoves}
            highlightCaptures={highlightCaptures}
            recentMove={recentMove}
            checkedKingSquare={checkedKingSquare}
            selectedKey={selectedKey}
            theme={theme}
            disabled={disabled}
            onPieceSelect={selectPiece}
            onSquareClick={clickSquare}
            onPieceDragStart={startDrag}
            onDrop={dropDrag}
          />
        </div>

        <div className="h-[70vh] lg:h-[86vh]">
          <ChatBox
            me={playerId}
            messages={messages}
            onSend={(text) => socket.emit("chatText", playerId, text)}
          />
        </div>
      </div>

      <ThemePicker open={showTheme} onClose={() => setShowTheme(false)} theme={theme} onChange={setTheme} />
      <Modal open={Boolean(gameOver)} onClose={() => setGameOver(null)} title="Game Over">
        <p className="mb-4 text-lg">{gameOver}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => socket.emit("reset", playerId)}
            className="rounded-md bg-black px-4 py-2 font-bold uppercase tracking-wider text-white"
          >
            Rematch
          </button>
          <button
            onClick={() => nav("/")}
            className="rounded-md border-2 border-black bg-white px-4 py-2 font-bold uppercase tracking-wider"
          >
            Back to Menu
          </button>
        </div>
      </Modal>
    </div>
  );
}
