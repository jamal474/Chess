/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Libre Baskerville"', "serif"],
        display: ['"Righteous"', "sans-serif"],
      },
      colors: {
        // Design language pulled from the original CSS
        accent: {
          DEFAULT: "#f7c41e",       // menu background
          soft: "#f7c41e9f",
        },
        board: {
          light: "#ffffff",
          dark: "#000000",
          check: "#dc2626",
          highlightRecent: "rgb(173, 216, 230)",
          highlightMove: "#facc15",
          highlightCapture: "#ef4444",
        },
      },
      boxShadow: {
        piece: "5px 5px 30px rgba(0, 0, 0, 0.9)",
      },
    },
  },
  plugins: [],
};
