import { useState } from "react";
import type { PlayerId } from "../lib/types";

type Msg = { from: PlayerId; text: string };

type Props = {
  me: PlayerId;
  messages: Msg[];
  onSend: (text: string) => void;
};

export default function ChatBox({ me, messages, onSend }: Props) {
  const [text, setText] = useState("");

  return (
    <div className="flex h-full flex-col rounded-lg border-2 border-black bg-white shadow-md">
      <div className="border-b border-black/20 px-3 py-2 text-sm font-bold uppercase tracking-wider">
        Chat
      </div>
      <ul className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <li className="text-center text-xs text-slate-400">No messages yet.</li>
        )}
        {messages.map((m, i) => {
          const mine = m.from === me;
          return (
            <li key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <span
                className={`inline-block max-w-[80%] rounded-lg px-3 py-1 text-sm ${
                  mine ? "bg-black text-white" : "bg-slate-200 text-slate-900"
                }`}
              >
                {m.text}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex border-t border-black/20 p-2">
        <input
          type="text"
          value={text}
          placeholder="Message…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              onSend(text.trim());
              setText("");
            }
          }}
          className="flex-1 rounded-md border border-black/30 px-3 py-1 outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
    </div>
  );
}
