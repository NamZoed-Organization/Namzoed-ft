// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat'],
        bold: ['Montserrat-Bold'],
        medium: ['Montserrat-Medium'],
        semibold: ['Montserrat-SemiBold'],
        light: ['Montserrat-Light'],
      },
    },
  },
  presets: [require('nativewind/preset')],
  plugins: [],
};
