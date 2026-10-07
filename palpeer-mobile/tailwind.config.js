/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        emerald: {
          50: '#E8F7F0',
          100: '#C8EDDC',
          200: '#95DCBD',
          300: '#5BC89A',
          400: '#2DB47E',
          500: '#0E9F6E',
          600: '#0A8259',
          700: '#086647',
          800: '#064D36',
          900: '#043626',
        },
        ink: {
          25: '#FAFAFA',
          50: '#F4F6F5',
          100: '#E7EBE9',
          200: '#D2D9D5',
          300: '#AEB8B3',
          400: '#86928C',
          500: '#63706A',
          600: '#47534D',
          700: '#2F3934',
          800: '#1B2420',
          900: '#0F1714',
          950: '#07140F',
        },
      },
      borderRadius: {
        card: '16px',
        sheet: '28px',
      },
    },
  },
  plugins: [],
};
