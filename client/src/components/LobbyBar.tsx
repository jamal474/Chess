import type { LobbyStats } from "../hooks/useLobbyStats";

/** "● 12 ONLINE · 3 SEARCHING · 4 PLAYING" under the menu header. */
export default function LobbyBar({ stats }: { stats: LobbyStats | null }) {
  const item = (n: number, label: string) => (
    <span className="whitespace-nowrap">
      <span className="font-bold text-accent tabular-nums">{n}</span> {label}
    </span>
  );
  return (
    <div
      className="border-b-3 border-black bg-black text-white px-4 sm:px-6 py-2 flex items-center gap-3 sm:gap-4 flex-wrap font-mono text-xs uppercase tracking-wider"
      aria-live="polite"
    >
      <span className="flex items-center gap-2 whitespace-nowrap">
        <span
          className={`inline-block w-2 h-2 ${stats ? "bg-lime-400 animate-pulse" : "bg-white/40"}`}
          aria-hidden="true"
        />
        {stats ? "LIVE" : "CONNECTING…"}
      </span>
      {stats && (
        <>
          {item(stats.online, "online")}
          <span className="opacity-40" aria-hidden="true">·</span>
          {item(stats.searching, "searching")}
          <span className="opacity-40" aria-hidden="true">·</span>
          {item(stats.playing, "playing")}
        </>
      )}
    </div>
  );
}
