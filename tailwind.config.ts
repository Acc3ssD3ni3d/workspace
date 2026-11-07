import type { Config } from "tailwindcss";
export default { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { navy: "#0a1433", navy2: "#14204f", brand: "#1f5eff", page: "#f4f6fd", ink: "#0f1633", muted: "#667091", line: "#e8ebf5", ok: "#22a447" },
    fontFamily: { sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"] }, boxShadow: { card: "0 2px 12px rgba(31,50,120,.07)" } } }, plugins: [] } satisfies Config;
