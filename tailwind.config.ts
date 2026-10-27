import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        emerald: {
          DEFAULT: "#087F6D",
          50: "#EEFAF6",
          100: "#DDF5EC",
          200: "#B5E8D6",
          300: "#7FD3B9",
          400: "#3FB397",
          500: "#119680",
          600: "#087F6D",
          700: "#07695B",
          800: "#06574B",
          900: "#064E3B",
          950: "#03322A",
        },
        forest: "#064E3B",
        mint: "#DDF5EC",
        ivory: "#FAF9F6",
        charcoal: "#17212B",
        muted: "#5F6B7A",
        gold: { DEFAULT: "#C9A86A", light: "#F3EAD7", dark: "#8A6A2F" },
        income: "#16A34A",
        expense: "#DC5252",
        line: "#E8E4DC",
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans Variable'", "Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "1rem", "2xl": "1.25rem", "3xl": "1.75rem" },
      boxShadow: {
        soft: "0 1px 2px rgba(23,33,43,0.04), 0 4px 16px rgba(23,33,43,0.06)",
        lift: "0 2px 4px rgba(23,33,43,0.05), 0 12px 32px rgba(23,33,43,0.10)",
        card: "0 18px 40px -12px rgba(6,78,59,0.45)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: { shimmer: "shimmer 1.6s infinite" },
    },
  },
  plugins: [],
};
export default config;
