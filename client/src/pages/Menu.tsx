import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { socket } from "../lib/socket";
import { log } from "../lib/logger";
import { PLAYER1, PLAYER2, type PlayerId } from "../lib/types";
import FloatingPieces from "../components/FloatingPieces";
import { useNationality } from "../components/NationalityBadge";
import PlayerCard from "../components/PlayerCard";
import LobbyBar from "../components/LobbyBar";
import NamePrompt from "../components/NamePrompt";
import { useLobbyStats } from "../hooks/useLobbyStats";
import { readName, saveProfile } from "../lib/identity";
import type { Country, Profile } from "../lib/types";
import PlayOnlineCard from "../components/PlayOnlineCard";
import MatchFound from "../components/MatchFound";
import { useMatchmaking } from "../hooks/useMatchmaking";
import { enterMatch, enterPrivateRoom } from "../lib/session";

/** What the game page hands back when a match was called off. */
type MenuState = { searchingSince?: number; message?: string } | null;

// Dev-only "solo game" launcher; removed from production builds.
const DevMenu = import.meta.env.DEV ? lazy(() => import("../dev/DevMenu")) : null;

type Color = "White" | "Black" | "Random";

const CHOICES: { label: Color; glyph: string }[] = [
  { label: "Random", glyph: "♞" },
  { label: "White",  glyph: "♙" },
  { label: "Black",  glyph: "♟" },
];

function generateRoomCode(len = 5) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
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
  const location = useLocation();
  const handed = (location.state as MenuState) ?? null;
  const [choice, setChoice] = useState<Color>("Random");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const stats = useLobbyStats();
  const nationality = useNationality();
  const [name, setName] = useState(readName);
  const [editing, setEditing] = useState(false);
  // What the player picked in the editor this visit (undefined: detection's answer).
  const [chosen, setChosen] = useState<Country | null | undefined>(undefined);
  const country = chosen === undefined ? nationality : chosen;

  // ---------- Play online ----------
  const match = useMatchmaking(handed?.searchingSince);
  const [searchAfterSave, setSearchAfterSave] = useState(false);
  useEffect(() => {
    if (handed?.message) match.notify(handed.message);
    // Consume the hand-over so a refresh doesn't replay it.
    if (handed) nav(".", { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onFind() {
    if (!name.trim()) {
      setSearchAfterSave(true);
      setEditing(true);
      return;
    }
    match.find({ name: name.trim(), country });
  }

  const goToMatch = useCallback(() => {
    if (match.state.status !== "found") return;
    const m = match.state.match;
    enterMatch({ playerId: m.playerId, roomId: m.roomId, ticket: m.ticket });
    nav("/game");
  }, [match.state, nav]);

  function onSaveProfile(p: Profile) {
    saveProfile(p, nationality);
    setName(p.name);
    setChosen(p.country);
    setEditing(false);
    if (searchAfterSave) {
      setSearchAfterSave(false);
      match.find(p);
    } else if (match.state.status === "searching") {
      match.setProfile(p);
    }
  }

  function onCreate() {
    const playerId = resolvePlayerId(choice);
    const roomCode = generateRoomCode();
    log.info("Menu", `create room ${roomCode} as ${playerId} (choice=${choice})`);
    if (match.state.status === "searching") match.cancel();
    enterPrivateRoom({ playerId, roomCode, creator: true });
    nav("/game");
  }

  function onJoin() {
    setError(null);
    const code = joinCode.trim().toUpperCase();
    if (!code) return setError("ENTER A ROOM CODE");
    log.debug("Menu", `roomExistsCheck ${code}`);
    socket.emit("roomExistsCheck", code, (canJoin: boolean, joinerPlayerId: PlayerId) => {
      if (!canJoin) {
        log.warn("Menu", `join failed: room ${code} unavailable`);
        return setError("ROOM UNAVAILABLE");
      }
      log.info("Menu", `join room ${code} as ${joinerPlayerId}`);
      if (match.state.status === "searching") match.cancel();
      enterPrivateRoom({ playerId: joinerPlayerId, roomCode: code, creator: false });
      nav("/game");
    });
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white">
      <FloatingPieces />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="border-b-3 border-black bg-white flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <h1 className="font-display text-2xl sm:text-3xl tracking-tighter leading-none shrink-0">C H E S S</h1>
          <PlayerCard name={name} country={country} onEdit={() => setEditing(true)} />
        </header>
        <LobbyBar stats={stats} />

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-4xl flex flex-col gap-6 sm:gap-8">
          <PlayOnlineCard
            state={match.state}
            stats={stats}
            name={name}
            country={country}
            message={match.error}
            onFind={onFind}
            onCancel={match.cancel}
            onEditProfile={() => setEditing(true)}
          />

          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-[3px] flex-1 bg-black" />
            <span className="label">OR PLAY A FRIEND</span>
            <span className="h-[3px] flex-1 bg-black" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {/* CREATE panel */}
            <section className="brut-lg bg-white p-4 sm:p-6 flex flex-col min-w-0">
              <div className="border-b-3 border-black -mx-4 sm:-mx-6 px-4 sm:px-6 pb-3 mb-4">
                <span className="label">02 · CREATE A ROOM</span>
              </div>

              <label className="label mb-2">PLAY AS</label>
              <div
                role="radiogroup"
                aria-label="Play as"
                className="grid grid-cols-3 gap-2 mb-6 min-w-0"
              >
                {CHOICES.map((c) => {
                  const active = choice === c.label;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setChoice(c.label)}
                      className={[
                        // Base: brutalist tile
                        "relative min-w-0 border-3 border-black py-4 flex flex-col items-center gap-1",
                        "transition-transform cursor-pointer select-none",
                        // Selected vs idle — very obvious
                        active
                          ? "bg-black text-white shadow-[2px_2px_0_0_#000] translate-x-[2px] translate-y-[2px]"
                          : "bg-white text-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]",
                      ].join(" ")}
                    >
                      {active && (
                        <span className="absolute top-1 right-1 bg-accent text-black label px-1.5 py-0.5 border-2 border-black leading-none">
                          ✓
                        </span>
                      )}
                      <span
                        className="glyph text-4xl leading-none"
                        style={{
                          color: active ? "#facc15" : "#000",
                          WebkitTextStroke: active ? "0" : "0",
                        }}
                      >
                        {c.glyph}
                      </span>
                      <span className="label">{c.label.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>

              <button onClick={onCreate} type="button" className="btn btn-primary text-lg py-4 mt-auto">
                CREATE GAME →
              </button>
            </section>

            {/* JOIN panel */}
            <section className="brut-lg bg-white p-4 sm:p-6 flex flex-col min-w-0">
              <div className="border-b-3 border-black -mx-4 sm:-mx-6 px-4 sm:px-6 pb-3 mb-4">
                <span className="label">03 · JOIN A ROOM</span>
              </div>

              <label className="label mb-2">ROOM CODE</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && onJoin()}
                placeholder="XXXXX"
                maxLength={12}
                className="brut w-full min-w-0 bg-white text-center font-mono text-3xl py-4 mb-2 tracking-widest outline-none focus:bg-accent"
              />

              {error && <p className="label text-red-600 mb-3">{error}</p>}

              <button onClick={onJoin} type="button" className="btn text-lg py-4 mt-auto">
                JOIN GAME →
              </button>
            </section>
          </div>
          </div>
        </main>

        {match.state.status === "found" && (
          <MatchFound
            me={{ name, country }}
            opponent={match.state.match.opponent}
            myColor={match.state.match.playerId}
            onDone={goToMatch}
          />
        )}

        <NamePrompt
          open={editing}
          kicker="YOUR PLAYER CARD"
          title="WHO'S PLAYING?"
          submitLabel={searchAfterSave ? "FIND OPPONENT →" : "SAVE"}
          onCancel={() => {
            setEditing(false);
            setSearchAfterSave(false);
          }}
          roomCode=""
          showShare={false}
          defaultName={name}
          defaultCountry={country}
          onSubmit={onSaveProfile}
        />

        {DevMenu && (
          <Suspense fallback={null}>
            <DevMenu />
          </Suspense>
        )}

        <footer className="border-t-3 border-black bg-black text-white px-6 py-3 flex items-center justify-between text-xs font-mono uppercase tracking-wider">
          <span>&copy; {new Date().getFullYear()}</span>
          <span>
            made by{" "}
            <a
              href="https://shabbirjamal.com"
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:underline"
            >
              sabo
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}
