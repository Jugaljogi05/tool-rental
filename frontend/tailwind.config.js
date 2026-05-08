/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        paper: "#f7f7f5",
        steel: "#7b7b7b",
        smoke: "#e9e9e6",
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Manrope", "sans-serif"],
      },
      boxShadow: {
        mono: "0 12px 30px -18px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};
