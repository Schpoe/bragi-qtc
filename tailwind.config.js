/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        inter: ['var(--font-inter)'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
    },
  },
  safelist: [
    // Team color picker - all variants
    "bg-blue-500", "bg-indigo-500", "bg-purple-500", "bg-violet-500", "bg-fuchsia-500",
    "bg-pink-500", "bg-rose-500", "bg-red-500", "bg-orange-500", "bg-amber-500",
    "bg-yellow-500", "bg-lime-500", "bg-emerald-500", "bg-teal-500", "bg-cyan-500",
    "bg-sky-500", "bg-slate-500", "bg-gray-500", "bg-zinc-500", "bg-stone-500",
    // Discipline badge colors
    "bg-blue-100", "text-blue-700", "border-blue-200",
    "bg-green-100", "text-green-700", "border-green-200",
    "bg-purple-100", "text-purple-700", "border-purple-200",
    "bg-amber-100", "text-amber-700", "border-amber-200",
    "bg-rose-100", "text-rose-700", "border-rose-200",
    "bg-cyan-100", "text-cyan-700", "border-cyan-200",
    "bg-teal-100", "text-teal-700", "border-teal-200",
    "bg-fuchsia-100", "text-fuchsia-700", "border-fuchsia-200",
    "bg-orange-100", "text-orange-700", "border-orange-200",
    "bg-indigo-100", "text-indigo-700", "border-indigo-200",
  ],
  plugins: [require("tailwindcss-animate")],
};