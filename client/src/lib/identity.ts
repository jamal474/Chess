// Who this browser is, kept in localStorage:
//   * a random client id, sent in the socket handshake so the relay can
//     count browsers rather than tabs and never match you against yourself;
//   * the name you play under (the country lives with the flag detection in
//     NationalityBadge).

import type { Country, Profile } from "./types";
import { saveChosenCountry } from "../components/NationalityBadge";

const CLIENT_ID_KEY = "chess.clientId";
const NAME_KEY = "chess.name";

function randomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }
}

let cachedId: string | null = null;

/** Stable per browser; a fresh one per tab only if storage is unavailable. */
export function getClientId(): string {
  if (cachedId) return cachedId;
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return (cachedId = stored);
    const id = randomId();
    localStorage.setItem(CLIENT_ID_KEY, id);
    return (cachedId = id);
  } catch {
    return (cachedId = randomId());
  }
}

export function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Remembers a profile the player entered. The country is only pinned when it
 * differs from the one detected from their IP, so detection keeps working
 * for everyone who never changed it.
 */
export function saveProfile(profile: Profile, detected: Country | null) {
  try {
    localStorage.setItem(NAME_KEY, profile.name);
  } catch {
    /* private mode — silent */
  }
  if (profile.country?.code !== detected?.code) saveChosenCountry(profile.country);
}
