/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#154212",
          light: "#2d5a27",
          dark: "#002201",
        },
        surface: {
          DEFAULT: "#f8faf8",
          dim: "#d8dad9",
          container: "#eceeec",
          "container-low": "#f2f4f2",
          "container-high": "#e6e9e7",
        },
        outline: {
          DEFAULT: "#72796e",
          variant: "#c2c9bb",
        },
        secondary: {
          DEFAULT: "#4a6549",
          container: "#ccebc7",
        },
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
