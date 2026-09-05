// Background decoration for the menu — floating chess pieces animating up/down.
// Positions are hand-picked to match the old sign/menu design.

type Spec = { kind: string; top: string; left: string; delay: string };

const PIECES: Spec[] = [
  { kind: "king",   top: "66%",  left: "13%", delay: "-0.9s" },
  { kind: "queen",  top: "31%",  left: "33%", delay: "-4.8s" },
  { kind: "knight", top: "76%",  left: "38%", delay: "-4s" },
  { kind: "knight", top: "16%",  left: "38%", delay: "-4s" },
  { kind: "knight", top: "36%",  left: "38%", delay: "-4s" },
  { kind: "rook",   top: "21%",  left: "14%", delay: "-2.8s" },
  { kind: "rook",   top: "58%",  left: "56%", delay: "-2.15s" },
  { kind: "rook",   top: "8%",   left: "72%", delay: "-1.9s" },
  { kind: "pawn",   top: "31%",  left: "58%", delay: "-0.65s" },
  { kind: "pawn",   top: "69%",  left: "81%", delay: "-0.4s" },
  { kind: "king",   top: "15%",  left: "32%", delay: "-4.1s" },
  { kind: "king",   top: "13%",  left: "46%", delay: "-3.65s" },
  { kind: "pawn",   top: "55%",  left: "27%", delay: "-2.25s" },
  { kind: "pawn",   top: "49%",  left: "53%", delay: "-2s" },
  { kind: "pawn",   top: "34%",  left: "49%", delay: "-1.55s" },
  { kind: "pawn",   top: "33%",  left: "86%", delay: "-0.95s" },
  { kind: "bishop", top: "28%",  left: "25%", delay: "-4.45s" },
  { kind: "king",   top: "39%",  left: "10%", delay: "-3.35s" },
  { kind: "queen",  top: "77%",  left: "24%", delay: "-2.3s" },
  { kind: "queen",  top: "3%",   left: "47%", delay: "-1.75s" },
  { kind: "queen",  top: "71%",  left: "66%", delay: "-1.25s" },
  { kind: "queen",  top: "31%",  left: "77%", delay: "-0.65s" },
  { kind: "queen",  top: "46%",  left: "39%", delay: "-0.35s" },
  { kind: "pawn",   top: "3%",   left: "20%", delay: "-4.3s" },
  { kind: "pawn",   top: "3%",   left: "6%",  delay: "-4.05s" },
  { kind: "pawn",   top: "77%",  left: "4%",  delay: "-3.75s" },
  { kind: "pawn",   top: "1%",   left: "71%", delay: "-3.3s" },
  { kind: "bishop", top: "23%",  left: "63%", delay: "-2.1s" },
  { kind: "rook",   top: "81%",  left: "45%", delay: "-1.75s" },
  { kind: "bishop", top: "60%",  left: "42%", delay: "-1.45s" },
  { kind: "rook",   top: "29%",  left: "93%", delay: "-1.05s" },
  { kind: "bishop", top: "52%",  left: "68%", delay: "-0.7s" },
  { kind: "rook",   top: "81%",  left: "83%", delay: "-0.35s" },
  { kind: "bishop", top: "11%",  left: "91%", delay: "-0.1s" },
];

export default function FloatingPieces() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className={`floating ${p.kind}`}
          style={{ top: p.top, left: p.left, animationDelay: p.delay }}
        />
      ))}
    </div>
  );
}
