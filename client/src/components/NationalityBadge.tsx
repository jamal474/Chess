import { useEffect, useState } from "react";
import { log } from "../lib/logger";
import type { Country } from "../lib/types";
import Flag from "./Flag";

type Nationality = Country;

const CACHE_KEY = "chess.nationality";
// A country the player picked themselves; wins over the IP lookup.
const OVERRIDE_KEY = "chess.country";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readCache(): Nationality | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { value: Nationality; expiresAt: number };
    if (Date.now() > parsed.expiresAt) return null;
    if (!parsed.value?.code || !parsed.value?.name) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(v: Nationality) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ value: v, expiresAt: Date.now() + CACHE_TTL_MS })
    );
  } catch {
    /* private mode, quota etc. — silent */
  }
}

function readChosen(): Nationality | null {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Nationality;
    return v?.code && v?.name ? v : null;
  } catch {
    return null;
  }
}

/** Remembers the country the player picked (null forgets it). */
export function saveChosenCountry(v: Nationality | null) {
  try {
    if (v) localStorage.setItem(OVERRIDE_KEY, JSON.stringify(v));
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* private mode — silent */
  }
}

function readQueryOverride(): Nationality | null {
  try {
    const p = new URLSearchParams(window.location.search).get("country");
    if (!p) return null;
    const code = p.slice(0, 2).toLowerCase();
    if (!/^[a-z]{2}$/.test(code)) return null;
    return { code, name: p.toUpperCase() };
  } catch {
    return null;
  }
}

async function fetchNationality(): Promise<Nationality | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`ipapi ${res.status}`);
    const data = await res.json();
    if (data?.country_code && data?.country_name) {
      return {
        code: String(data.country_code).toLowerCase(),
        name: String(data.country_name),
      };
    }
    return null;
  } catch (e) {
    log.warn("nationality", `fetch failed: ${(e as Error).message}`);
    return null;
  }
}

/** Hook — returns the detected nationality, or null while still loading / unavailable. */
export function useNationality(): Nationality | null {
  const [nat, setNat] = useState<Nationality | null>(
    () => readQueryOverride() || readChosen() || readCache()
  );

  useEffect(() => {
    if (nat) return;
    let cancelled = false;
    (async () => {
      const v = await fetchNationality();
      if (cancelled) return;
      if (v) {
        setNat(v);
        writeCache(v);
        log.info("nationality", `detected ${v.code.toUpperCase()} (${v.name})`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nat]);

  return nat;
}

/**
 * Just the flag + country code content — no outer border. Parent decides the
 * framing (a stand-alone `.brut` chip on the menu; a divide-x cell inside
 * the game header's control strip).
 */
export default function NationalityBadge({ heightPx = 32 }: { heightPx?: number }) {
  const nat = useNationality();
  if (!nat) return null;
  return (
    <div className="flex items-center gap-2" title={nat.name}>
      <Flag country={nat} height={heightPx} />
      <span className="label font-mono">{nat.code.toUpperCase()}</span>
    </div>
  );
}
