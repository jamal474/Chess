import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import { log } from "../lib/logger";
import type { PlayerId, Profile } from "../lib/types";

export type Match = { roomId: string; playerId: PlayerId; ticket: string; opponent: Profile };

export type MatchState =
  | { status: "idle" }
  | { status: "searching"; since: number }
  | { status: "found"; match: Match };

/**
 * Searching for an opponent from the menu.
 *
 *   find(profile) → queue:join; the relay answers "searching", or pairs us
 *                   at once and sends match:found (possibly before the ack).
 *   cancel()      → queue:leave.
 *
 * Leaving the page while searching leaves the queue. A reconnect while
 * searching rejoins it (the relay drops a disconnected socket's place).
 * `resumeSince` starts in the searching state, for when the game page sent
 * us back because a match was called off and the relay has requeued us.
 */
export function useMatchmaking(resumeSince?: number) {
  const [state, setState] = useState<MatchState>(() =>
    resumeSince ? { status: "searching", since: resumeSince } : { status: "idle" }
  );
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const profileRef = useRef<Profile | null>(null);

  useEffect(() => {
    const onFound = (m: Match) => {
      log.info("match", `found room=${m.roomId} as ${m.playerId} vs ${m.opponent?.name}`);
      setState({ status: "found", match: m });
    };
    const onCancelled = (r: { requeued: boolean }) => {
      if (r?.requeued) {
        setState({ status: "searching", since: Date.now() });
        setError("OPPONENT DIDN'T SHOW · STILL SEARCHING");
      } else {
        setState({ status: "idle" });
        setError("MATCH TIMED OUT · TRY AGAIN");
      }
    };
    const onReconnect = () => {
      if (stateRef.current.status === "searching" && profileRef.current) {
        socket.emit("queue:join", profileRef.current, () => {});
      }
    };
    socket.on("match:found", onFound);
    socket.on("match:cancelled", onCancelled);
    socket.on("connect", onReconnect);
    return () => {
      socket.off("match:found", onFound);
      socket.off("match:cancelled", onCancelled);
      socket.off("connect", onReconnect);
      if (stateRef.current.status === "searching") socket.emit("queue:leave");
    };
  }, []);

  const find = useCallback((profile: Profile) => {
    profileRef.current = profile;
    setError(null);
    setState({ status: "searching", since: Date.now() });
    socket.emit("queue:join", profile, (r: { ok: boolean; status?: string; error?: string }) => {
      if (r?.ok) return;
      log.warn("match", `queue:join refused: ${r?.error}`);
      setState((s) => (s.status === "searching" ? { status: "idle" } : s));
      setError((r?.error ?? "couldn't start searching").toUpperCase());
    });
  }, []);

  const cancel = useCallback(() => {
    socket.emit("queue:leave");
    setState({ status: "idle" });
    setError(null);
  }, []);

  /** For the menu's own messages (e.g. one handed over by the game page). */
  const notify = useCallback((msg: string | null) => setError(msg), []);

  return { state, error, find, cancel, notify, setProfile: (p: Profile) => (profileRef.current = p) };
}
