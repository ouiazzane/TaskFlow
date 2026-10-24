/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)'
      },
      colors: {
        brand: {
          50: '#eef2ff',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3'
        }
      }
    }
  },
  plugins: []
};
