/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0c0e12',
          card: '#13161c',
          cardHover: '#161a22',
          border: 'rgba(255, 255, 255, 0.08)',
          header: '#11141a',
        },
        mri: {
          blue: '#4aa3df',
          blueHover: '#1d6ea8',
          gold: '#e0a93b',
          green: '#22c55e',
          red: '#e24b4a',
          purple: '#8b5cf6',
          cyan: '#06b6d4',
        }
      },
      fontFamily: {
        sans: ['" IBM Plex Sans\', 'sans-serif'],
 mono: ['\JetBrains Mono\', 'monospace'],
 }
 },
 },
 plugins: [],
}
