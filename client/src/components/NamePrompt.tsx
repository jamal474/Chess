import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Country, Profile } from "../lib/types";
import { allCountries } from "../lib/countries";
import Flag from "./Flag";

const MAX_NAME = 16;
const LBL = "text-[11px] font-bold tracking-[0.12em] uppercase";

/**
 * Asked once per room, right after creating or joining it: the name (and
 * country) the opponent will see. Pre-filled from the last game.
 */
export default function NamePrompt({
  open,
  roomCode,
  showShare,
  note,
  defaultName,
  defaultCountry,
  onSubmit,
}: {
  open: boolean;
  roomCode: string;
  /** The creator waits for someone to join: offer the code to send them. */
  showShare: boolean;
  /** Shown above the form, e.g. when taking over a game in progress. */
  note?: string | null;
  defaultName: string;
  defaultCountry: Country | null;
  onSubmit: (profile: Profile) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [country, setCountry] = useState<Country | null>(defaultCountry);
  const [countryTouched, setCountryTouched] = useState(false);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  // The IP lookup may answer after the prompt opened.
  useEffect(() => {
    if (!countryTouched && defaultCountry) setCountry(defaultCountry);
  }, [defaultCountry, countryTouched]);

  useEffect(() => {
    if (open) input.current?.select();
  }, [open]);

  if (!open) return null;

  const trimmed = name.replace(/\s+/g, " ").trim();
  const valid = trimmed.length > 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({ name: trimmed, country });
  }

  function copy() {
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-title"
        onSubmit={submit}
        className="brut-lg w-full max-w-md bg-white p-6 flex flex-col gap-5"
      >
        <div className="-mx-6 px-6 pb-3 border-b-3 border-black flex flex-col gap-1.5">
          <span className={`${LBL} opacity-70`}>ROOM {roomCode} · BEFORE YOU PLAY</span>
          <h2 id="name-title" className="font-display text-3xl leading-none tracking-tight">
            YOUR NAME
          </h2>
        </div>

        {note && (
          <p className="m-0 -mt-1 px-3 py-2 border-3 border-black bg-accent text-sm font-bold leading-snug">{note}</p>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="player-name" className={LBL}>
            NAME
          </label>
          <input
            ref={input}
            id="player-name"
            type="text"
            value={name}
            maxLength={MAX_NAME}
            autoComplete="nickname"
            spellCheck={false}
            onChange={(e) => setName(e.target.value)}
            className="brut w-full px-4 py-3 font-mono text-2xl font-bold tracking-widest uppercase outline-none focus:bg-accent"
          />
          <div className="flex justify-between text-sm">
            <span>shown to your opponent</span>
            <span className="font-mono">
              {name.length}/{MAX_NAME}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="player-country" className={LBL}>
            COUNTRY
          </label>
          <div className="flex items-center gap-3 border-3 border-black px-3 py-2">
            <Flag country={country} height={24} />
            <select
              id="player-country"
              value={country?.code ?? ""}
              onChange={(e) => {
                setCountryTouched(true);
                const code = e.target.value;
                setCountry(allCountries().find((c) => c.code === code) ?? null);
              }}
              className="flex-1 min-w-0 bg-white font-bold uppercase outline-none focus:bg-accent py-1 cursor-pointer"
            >
              <option value="">NO FLAG</option>
              {allCountries().map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            {defaultCountry && country?.code === defaultCountry.code && (
              <span className={`${LBL} text-[10px] opacity-55 hidden sm:inline`}>DETECTED</span>
            )}
          </div>
        </div>

        {showShare && (
          <div className="flex items-stretch border-3 border-black bg-[#fafafa]">
            <div className="flex-1 px-3 py-2 flex flex-col">
              <span className={`${LBL} text-[10px] opacity-70`}>SEND THIS TO YOUR OPPONENT</span>
              <span className="font-mono text-xl font-bold tracking-widest">{roomCode}</span>
            </div>
            <button
              type="button"
              onClick={copy}
              className={`${LBL} px-4 border-l-3 border-black bg-white hover:bg-black hover:text-white`}
            >
              {copied ? "✓ COPIED" : "COPY"}
            </button>
          </div>
        )}

        <button type="submit" disabled={!valid} className="btn btn-primary text-lg py-4">
          PLAY →
        </button>
      </form>
    </div>
  );
}
