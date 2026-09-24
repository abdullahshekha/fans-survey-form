import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef6f6",
          100: "#d3e9e9",
          400: "#3a8f8f",
          500: "#256e6e",
          600: "#1b5555",
          700: "#154545",
          900: "#0c2b2b",
        },
        gold: {
          50: "#fdf6e9",
          100: "#fbead0",
          600: "#a5620f",
          700: "#8a5109",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
