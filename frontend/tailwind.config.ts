import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular"]
      },
      colors: {
        slateDeep: "#0f172a"
      },
      boxShadow: {
        glass: "0 10px 35px rgba(2, 8, 23, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
