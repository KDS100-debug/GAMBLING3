import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        // Gaming theme colors
        dark: "var(--dark)",
        surface: "var(--surface)",
        "surface-light": "var(--surface-light)",
        "surface-lighter": "var(--surface-lighter)",
        "casino-dark": "var(--casino-dark)",
        "casino-navy": "var(--casino-navy)",
        "casino-midnight": "var(--casino-midnight)",
        
        // Neon colors
        "neon-green": "var(--neon-green)",
        "neon-green-dim": "var(--neon-green-dim)",
        "neon-red": "var(--neon-red)",
        "neon-red-dim": "var(--neon-red-dim)",
        "neon-gold": "var(--neon-gold)",
        "neon-gold-dim": "var(--neon-gold-dim)",
        "neon-blue": "var(--neon-blue)",
        "neon-purple": "var(--neon-purple)",
        "neon-orange": "var(--neon-orange)",
        
        // Game state colors
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
        inter: ["Inter", "sans-serif"],
      },
      spacing: {
        xs: "var(--space-xs)",
        sm: "var(--space-sm)", 
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        fly: {
          "0%": { transform: "translateX(-100px) translateY(50px) rotate(-10deg)" },
          "100%": { transform: "translateX(calc(100vw + 100px)) translateY(-200px) rotate(15deg)" },
        },
        pulse: {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.05)" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "neon-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 5px currentColor, 0 0 10px currentColor, 0 0 15px currentColor",
            filter: "brightness(1)"
          },
          "50%": { 
            boxShadow: "0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor",
            filter: "brightness(1.2)"
          },
        },
        "intense-glow": {
          "0%, 100%": { boxShadow: "0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor" },
          "50%": { boxShadow: "0 0 20px currentColor, 0 0 40px currentColor, 0 0 60px currentColor" },
        },
        "multiplier-escalation": {
          "0%": { 
            transform: "scale(1)", 
            color: "var(--neon-green)",
            textShadow: "0 0 10px var(--neon-green)"
          },
          "25%": { 
            transform: "scale(1.1)", 
            color: "var(--neon-gold)",
            textShadow: "0 0 15px var(--neon-gold)"
          },
          "50%": { 
            transform: "scale(1.2)", 
            color: "var(--neon-orange)",
            textShadow: "0 0 20px var(--neon-orange)"
          },
          "75%": { 
            transform: "scale(1.3)", 
            color: "var(--neon-red)",
            textShadow: "0 0 25px var(--neon-red)"
          },
          "100%": { 
            transform: "scale(1.4)", 
            color: "var(--neon-red)",
            textShadow: "0 0 30px var(--neon-red)"
          },
        },
        "plane-takeoff": {
          "0%": { 
            transform: "translateX(-50px) translateY(20px) rotate(-5deg) scale(0.8)",
            opacity: "0.7"
          },
          "100%": { 
            transform: "translateX(0px) translateY(0px) rotate(0deg) scale(1)",
            opacity: "1"
          },
        },
        "plane-crash": {
          "0%": { 
            transform: "translateX(0px) translateY(0px) rotate(0deg)",
            filter: "hue-rotate(0deg)"
          },
          "100%": { 
            transform: "translateX(50px) translateY(100px) rotate(45deg)",
            filter: "hue-rotate(180deg)",
            opacity: "0"
          },
        },
        "cash-out-celebration": {
          "0%": { 
            transform: "scale(1)", 
            background: "var(--success)",
            boxShadow: "0 0 0 rgba(120, 255, 120, 0.7)"
          },
          "50%": { 
            transform: "scale(1.05)", 
            background: "var(--neon-green)",
            boxShadow: "0 0 20px rgba(120, 255, 120, 0.7)"
          },
          "100%": { 
            transform: "scale(1)", 
            background: "var(--success)",
            boxShadow: "0 0 0 rgba(120, 255, 120, 0.7)"
          },
        },
        "warning-flash": {
          "0%, 100%": { backgroundColor: "transparent" },
          "50%": { backgroundColor: "rgba(255, 165, 0, 0.2)" },
        },
        "slide-up-fade": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        fly: "fly 8s linear infinite",
        "multiplier-pulse": "pulse 0.5s ease-in-out infinite alternate",
        "slide-in": "slideIn 0.3s ease-out",
        "neon-glow": "neon-glow 2s ease-in-out infinite",
        "intense-glow": "intense-glow 1s ease-in-out infinite",
        "multiplier-escalation": "multiplier-escalation 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite alternate",
        "plane-takeoff": "plane-takeoff 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        "plane-crash": "plane-crash 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "cash-out-celebration": "cash-out-celebration 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "warning-flash": "warning-flash 1s ease-in-out infinite",
        "slide-up": "slide-up-fade 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
