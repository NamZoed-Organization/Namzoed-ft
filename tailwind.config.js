// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#094569',
        secondary: '#F2F2F2',
      },
      fontFamily: {
        sans: ['Montserrat','System'],
        extrabold: ['Montserrat-ExtraBold','System'],
        bold: ['Montserrat-Bold','System'],
        medium: ['Montserrat-Medium','System'],
        semibold: ['Montserrat-SemiBold','System'],
        light: ['Montserrat-Light','System'],
      },
      screens:{
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      }
    },
  },
  presets: [require('nativewind/preset')],
  plugins: [],
};
