module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#094569",
        secondary: "#EDC06D",
      },
      fontFamily: {
        regular: ["Montserrat-Regular", "System"],
        medium: ["Montserrat-Medium", "System"],
        semibold: ["Montserrat-SemiBold", "System"],
        mbold: ["Montserrat-Bold", "System"],
        mblack: ["Montserrat-ExtraBold", "System"],
        mlight: ["Montserrat-Light", "System"],
      },
    },
  },
  presets: [require("nativewind/preset")],
  plugins: [],
};
