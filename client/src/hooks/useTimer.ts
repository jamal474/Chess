import { useEffect, useRef, useState } from "react";

// Simple hh:mm:ss stopwatch; call `start`/`stop`/`reset`.
export function useTimer() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const tick = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      tick.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (tick.current) window.clearInterval(tick.current);
      tick.current = null;
    };
  }, [running]);

  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return {
    running,
    hh,
    mm,
    ss,
    start: () => setRunning(true),
    stop: () => setRunning(false),
    reset: () => {
      setSeconds(0);
      setRunning(true);
    },
  };
}
