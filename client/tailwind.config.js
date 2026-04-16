/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        auction: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          500: '#4f6ef7',
          600: '#3d5ce5',
          700: '#2e4bd0',
          800: '#1e3aaa',
          900: '#0f2585',
        },
      },
    },
  },
  plugins: [],
};
