import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../lib/socket";
import { PLAYER1, PLAYER2, type PlayerId } from "../lib/types";
import FloatingPieces from "../components/FloatingPieces";

type Color = "White" | "Black" | "Random";

const CHOICES: { label: Color; img: string }[] = [
  { label: "Random", img: "/images/randomPiece.png" },
  { label: "White",  img: "/images/Wpawn.png" },
  { label: "Black",  img: "/images/Bpawn.png" },
];

function generateRoomCode(len = 5) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

function resolvePlayerId(choice: Color): PlayerId {
  if (choice === "White") return PLAYER1;
  if (choice === "Black") return PLAYER2;
  return Math.random() < 0.5 ? PLAYER1 : PLAYER2;
}

export default function Menu() {
  const nav = useNavigate();
  const [choice, setChoice] = useState<Color>("Random");
  const [dropOpen, setDropOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const active = CHOICES.find((c) => c.label === choice)!;

  function onCreate() {
    const playerId = resolvePlayerId(choice);
    const roomCode = generateRoomCode();
    sessionStorage.setItem("playerID", playerId);
    sessionStorage.setItem("isCreator", "true");
    sessionStorage.setItem("createRoomId", roomCode);
    nav("/game");
  }

  function onJoin() {
    setError(null);
    const code = joinCode.trim();
    if (!code) {
      setError("Enter a room code first.");
      return;
    }
    socket.emit("roomExistsCheck", code, (canJoin: boolean, joinerPlayerId: PlayerId) => {
      if (!canJoin) {
        setError("That room isn't available. Check the code with your opponent.");
        return;
      }
      sessionStorage.setItem("playerID", joinerPlayerId);
      sessionStorage.setItem("joinRoomId", code);
      sessionStorage.setItem("isCreator", "false");
      nav("/game");
    });
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-serif" style={{ backgroundColor: "#ffffff" }}>
      {/* Background floaters */}
      <FloatingPieces />

      {/* Foreground content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <div className="mb-10 text-center">
          <h1 className="text-6xl font-bold tracking-wider drop-shadow-sm">C H E S S</h1>
          <p className="mt-2 text-slate-600">
            Create a room, share the code, start playing. No sign-up.
          </p>
        </div>

        <div className="w-full max-w-md rounded-2xl bg-white/95 p-8 shadow-2xl ring-1 ring-black/10 backdrop-blur">
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-700">
            Play as
          </label>

          {/* Color drop-down */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-md border-2 border-black bg-white px-4 py-2 text-left shadow-sm"
            >
              <span className="flex items-center gap-3">
                <img src={active.img} alt="" className="h-8 w-8 object-contain" />
                <span className="font-semibold">{active.label}</span>
              </span>
              <span className="material-symbols-outlined">arrow_drop_down</span>
            </button>
            {dropOpen && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border-2 border-black bg-white shadow-xl">
                {CHOICES.map((c) => (
                  <li
                    key={c.label}
                    onClick={() => {
                      setChoice(c.label);
                      setDropOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-slate-100"
                  >
                    <img src={c.img} alt="" className="h-7 w-7 object-contain" />
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Room code input for joining */}
          <label className="mt-6 mb-2 block text-sm font-bold uppercase tracking-wider text-slate-700">
            Have a code?
          </label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Enter game code"
            className="w-full rounded-md border-2 border-black bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
          />

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button
              onClick={onCreate}
              className="flex-1 rounded-md bg-black py-3 font-bold uppercase tracking-wider text-white transition hover:bg-white hover:text-black hover:ring-2 hover:ring-black"
            >
              Create Game
            </button>
            <button
              onClick={onJoin}
              className="flex-1 rounded-md bg-black py-3 font-bold uppercase tracking-wider text-white transition hover:bg-white hover:text-black hover:ring-2 hover:ring-black"
            >
              Join Game
            </button>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          Node relay + C++ engine. Have fun.
        </p>
      </div>

      {/* Warm background accent — preserves the original yellow */}
      <div
        aria-hidden
        className="absolute inset-0 -z-0"
        style={{ background: "#f7c41e9f" }}
      />
    </div>
  );
}
