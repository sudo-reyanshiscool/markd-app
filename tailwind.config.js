/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand statics — dynamic semantic colors come from useTheme() tokens.
        volt: "#C8FF1F",
        "volt-deep": "#9BD400",
        ink: "#16140F",
        paper: "#F6F2E9",
        "paper-raised": "#FFFDF7",
        asphalt: "#12110D",
        "asphalt-raised": "#1C1B15",
        bone: "#F4F0E6",
      },
      fontFamily: {
        display: ["Unbounded_700Bold"],
        "display-black": ["Unbounded_900Black"],
        body: ["SpaceGrotesk_400Regular"],
        "body-medium": ["SpaceGrotesk_500Medium"],
        "body-bold": ["SpaceGrotesk_700Bold"],
        mono: ["SpaceMono_700Bold"],
      },
      borderRadius: {
        card: "20px",
        btn: "14px",
      },
    },
  },
  plugins: [],
};
