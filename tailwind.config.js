/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cafe: {
          light: "#E9832E", // tea orange
          primary: "#6B2E1A", // main brown
          maroon: "#5D0C0C", // background red-brown
          gold: "#D4A017",
          saffron: "#E46A21",
          green: "#1BA260",
          blue: "#1C75BC",
        },
        darkbg: "#1A0F0C",
        darkcard: "#2A1712",
        lighttext: "#E3DAD2",
      },
      backdropBlur: { xs: "2px" },
    },
  },
  plugins: [],
};
