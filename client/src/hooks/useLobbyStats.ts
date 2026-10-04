import { useEffect, useState } from "react";
import { socket } from "../lib/socket";

export type LobbyStats = { online: number; searching: number; playing: number };

/**
 * Live player counts from the relay while the calling page is mounted.
 * Subscribing answers with the current counts at once; updates follow only
 * when they change. Resubscribes after a reconnect.
 */
export function useLobbyStats(): LobbyStats | null {
  const [stats, setStats] = useState<LobbyStats | null>(null);

  useEffect(() => {
    const subscribe = () =>
      socket.emit("lobby:subscribe", (r: { ok: boolean; stats?: LobbyStats }) => {
        if (r?.ok && r.stats) setStats(r.stats);
      });
    const onStats = (s: LobbyStats) => setStats(s);
    const onDisconnect = () => setStats(null);

    socket.on("lobby:stats", onStats);
    socket.on("connect", subscribe);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) subscribe();

    return () => {
      socket.off("lobby:stats", onStats);
      socket.off("connect", subscribe);
      socket.off("disconnect", onDisconnect);
      socket.emit("lobby:unsubscribe");
    };
  }, []);

  return stats;
}
