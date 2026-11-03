import type { Config } from "tailwindcss";
import {designTokens} from "./shared/design-system.mjs";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      borderRadius: {
        sm: "2px", DEFAULT: "4px", md: `${designTokens.radius.small}px`,
        lg: `${designTokens.radius.small}px`, xl: `${designTokens.radius.button}px`,
        "2xl": `${designTokens.radius.card}px`, "3xl": `${designTokens.radius.hero}px`
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        }
      },
      boxShadow: {
        card: "0 8px 24px rgba(55, 0, 60, 0.10)",
        elevated: "0 16px 40px rgba(55, 0, 60, 0.18)",
        live: "0 12px 32px rgba(233, 0, 82, 0.25)"
      },
      fontFamily: {
        sans: ["Inter", "Satoshi", "Avenir Next", "Helvetica Neue", "Arial", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
