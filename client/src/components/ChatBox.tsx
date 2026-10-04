import { useEffect, useRef, useState } from "react";
import type { PlayerId } from "../lib/types";
import type { ChatMsg } from "../hooks/useChessGame";
import { PanelHeader } from "./PanelHeader";

type Props = {
  me: PlayerId;
  messages: ChatMsg[];
  onSend: (text: string) => void;
  open: boolean;
  onToggle: () => void;
  /** Opponent messages not seen yet (shown while collapsed). */
  unread: number;
};

export default function ChatBox({ me, messages, onSend, open, onToggle, unread }: Props) {
  const [text, setText] = useState("");
  const scroller = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (open) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, open]);

  function submit() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <section className="brut flex flex-col h-full min-h-0">
      <PanelHeader title="CHAT" open={open} onToggle={onToggle}>
        {!open && unread > 0 && (
          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 bg-accent text-black">{unread} NEW</span>
        )}
      </PanelHeader>
      {open && (
        <>
          <ul ref={scroller} className="flex-1 min-h-0 space-y-2 overflow-y-auto p-3">
            {messages.length === 0 && (
              <li className="text-center text-xs opacity-60 label pt-2">SILENCE</li>
            )}
            {messages.map((m, i) => {
              const mine = m.from === me;
              return (
                <li key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <span
                    className={[
                      "inline-block max-w-[85%] px-3 py-1 border-2 border-black font-mono text-sm break-words",
                      mine ? "bg-black text-white" : "bg-white text-black",
                    ].join(" ")}
                  >
                    {m.text}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="flex shrink-0 border-t-3 border-black">
            <input
              type="text"
              value={text}
              aria-label="Chat message"
              placeholder="TYPE, HIT ENTER"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="flex-1 min-w-0 px-3 py-2 outline-none font-mono uppercase text-sm placeholder:opacity-40 focus:bg-accent/30"
            />
            <button onClick={submit} className="btn btn-primary border-l-3 border-y-0 border-r-0 shadow-none">
              SEND
            </button>
          </div>
        </>
      )}
    </section>
  );
}
