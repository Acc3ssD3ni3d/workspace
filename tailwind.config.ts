import type { Config } from "tailwindcss";

/* ==========================================================================
   DESIGN TOKENS
   Purple is the main colour, orange is the single accent.
   Green / red / amber are kept only for success / error / warning states.
   Every existing  blue-*, sky-*, indigo-*, purple-*, pink-*  class in the
   project now resolves to the same purple scale, and  slate-*  is a soft
   neutral, so the whole app follows this palette without editing each page.
   ========================================================================== */
const purple = {
  50: "#f6f3ff",
  100: "#ede8ff",
  200: "#ddd3ff",
  300: "#c4b3ff",
  400: "#a78bfa",
  500: "#8b5cf6",
  600: "#7c3aed",
  700: "#6930d1",
  800: "#5629a8",
  900: "#432282",
  950: "#2a1454",
};

const neutral = {
  50: "#f8f8fb",
  100: "#f1f0f6",
  200: "#e6e4ee",
  300: "#d2cfe0",
  400: "#9d9ab2",
  500: "#6f6c85",
  600: "#55526a",
  700: "#3f3d52",
  800: "#2a2838",
  900: "#1a1826",
  950: "#0f0e17",
};

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        blue: purple,
        sky: purple,
        indigo: purple,
        purple,
        pink: purple,
        violet: purple,
        slate: neutral,

        navy: "#1a1826",
        navy2: "#2a2838",
        brand: "#7c3aed",
        accent: "#f97316",
        page: "#f7f7fb",
        ink: "#1a1826",
        muted: "#6f6c85",
        line: "#e6e4ee",
        ok: "#16a34a",
      },
      fontFamily: { sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"] },
      boxShadow: {
        card: "0 1px 2px rgba(26,24,38,.04), 0 1px 3px rgba(26,24,38,.05)",
      },
    },
  },
  plugins: [],
} satisfies Config;
