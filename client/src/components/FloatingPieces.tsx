// Brutalist menu background: giant static Unicode chess glyphs peppered
// across the page in a low-contrast grey. No animation — the visual is
// weight, not motion.

const SPECS = [
  { glyph: "♞", top: "8%",  left: "6%",  size: 140, rot: -8 },
  { glyph: "♜", top: "18%", left: "78%", size: 180, rot: 12 },
  { glyph: "♛", top: "42%", left: "42%", size: 220, rot: -4 },
  { glyph: "♟", top: "62%", left: "12%", size: 120, rot: 6 },
  { glyph: "♝", top: "72%", left: "68%", size: 160, rot: -10 },
  { glyph: "♚", top: "10%", left: "44%", size: 150, rot: 4 },
  { glyph: "♞", top: "80%", left: "38%", size: 100, rot: -14 },
  { glyph: "♜", top: "48%", left: "82%", size: 110, rot: 10 },
];

export default function FloatingPieces() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {SPECS.map((s, i) => (
        <span
          key={i}
          className="glyph absolute font-bold"
          style={{
            top: s.top,
            left: s.left,
            fontSize: s.size,
            color: "rgba(0,0,0,0.06)",
            transform: `rotate(${s.rot}deg)`,
            lineHeight: 1,
          }}
        >
          {s.glyph}
        </span>
      ))}
    </div>
  );
}
