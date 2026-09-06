/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Archivo Black"', "sans-serif"],
        sans: ['"Space Grotesk"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
        chess: [
          '"Noto Sans Symbols 2"',
          '"Segoe UI Symbol"',
          '"Apple Symbols"',
          "sans-serif",
        ],
      },
      colors: {
        ink: "#000000",
        paper: "#ffffff",
        accent: {
          DEFAULT: "#facc15", // yellow-400
          strong: "#eab308",  // yellow-500
          check: "#ef4444",   // red-500
          move: "#a3e635",    // lime-400
        },
        board: {
          light: "#f5f5f5",
          dark:  "#111111",
          recent:  "#fde68a",  // amber-200
          moveOk:  "#bef264",  // lime-300
          capture: "#fca5a5",  // red-300
          check:   "#ef4444",  // red-500
        },
      },
      boxShadow: {
        // Signature brutalist offset shadows
        brut: "4px 4px 0 0 #000",
        "brut-lg": "8px 8px 0 0 #000",
        "brut-sm": "2px 2px 0 0 #000",
      },
      borderWidth: {
        3: "3px",
      },
    },
  },
  plugins: [],
};
