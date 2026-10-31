/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        antror: {
          50: '#FAF9F5',
          100: '#F3F1EB',
          200: '#E7E5DC',
          300: '#D5D2C7',
          400: '#A9A69B',
          500: '#7B786E',
          600: '#56534B',
          700: '#3A3833',
          800: '#252421',
          850: '#1C1B19',
          900: '#141413',
          950: '#0C0C0B'
        },
        brand: {
          50: '#FDF6F0',
          100: '#FAECE1',
          200: '#F5D7C2',
          300: '#EDB795',
          400: '#E48F61',
          500: '#D96B36',
          600: '#CB5624',
          700: '#A8411B',
          800: '#86351B',
          900: '#6D2E1A'
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        mono: [
          '"JetBrains Mono"',
          'Consolas',
          '"Fira Code"',
          'Menlo',
          'Monaco',
          'monospace'
        ]
      }
    },
  },
  plugins: [],
}
