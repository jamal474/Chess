import { useEffect, useRef, useState } from "react";
import type { PlayerId } from "../lib/types";
import type { ChatMsg } from "../hooks/useChessGame";

type Props = {
  me: PlayerId;
  messages: ChatMsg[];
  onSend: (text: string) => void;
};

export default function ChatBox({ me, messages, onSend }: Props) {
  const [text, setText] = useState("");
  const scroller = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  function submit() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="brut flex flex-col h-full">
      <div className="border-b-3 border-black bg-black px-3 py-2">
        <span className="label text-white">CHAT</span>
      </div>
      <ul ref={scroller} className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <li className="text-center text-xs opacity-60 label pt-2">SILENCE</li>
        )}
        {messages.map((m, i) => {
          const mine = m.from === me;
          return (
            <li key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <span
                className={[
                  "inline-block max-w-[85%] px-3 py-1 border-2 border-black font-mono text-sm",
                  mine ? "bg-black text-white" : "bg-white text-black",
                ].join(" ")}
              >
                {m.text}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex border-t-3 border-black">
        <input
          type="text"
          value={text}
          placeholder="TYPE, HIT ENTER"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="flex-1 px-3 py-2 outline-none font-mono uppercase text-sm placeholder:opacity-40"
        />
        <button onClick={submit} className="btn btn-primary border-l-3 border-y-0 border-r-0 shadow-none">
          SEND
        </button>
      </div>
    </div>
  );
}
