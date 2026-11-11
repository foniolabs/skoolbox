/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand: the SkoolBox logo's green and orange.
        primary: {
          DEFAULT: '#25632D',
          light: '#4C9A5E',
          dark: '#184A21',
        },
        accent: {
          DEFAULT: '#B9520A', // AA on white; use for text and filled buttons
          light: '#F9943B', // logo orange; decoration or with dark text
        },
        success: '#25632D',
        error: '#B42318',
        warning: '#B54708',
        'bg-app': '#F7F6F1',
        'bg-card': '#FFFFFF',
        'bg-primary': '#FFFFFF',
        'bg-secondary': '#EEF3EC',
        'bg-dark': '#17231C',
        // Stat cards carry white text, so all clear 4.5:1.
        'card-green': '#2E7D46',
        'card-orange': '#B9520A',
        'card-coral': '#C4342B',
        'card-blue': '#2563A8',
        'progress-green': '#3E9A55',
        'progress-yellow': '#E3A008',
        'progress-orange': '#E8710A',
        'progress-red': '#D9372C',
        'text-primary': '#17231C',
        'text-secondary': '#46564C',
        'text-muted': '#5F6E64',
        border: '#E2E5DD',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans Variable', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '28px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0,0,0,0.05)',
        'card': '0 0 0 1px rgba(23,35,28,0.06), 0 1px 3px rgba(23,35,28,0.06)',
        'md': '0 4px 6px -1px rgba(0,0,0,0.1)',
        'lg': '0 10px 15px -3px rgba(0,0,0,0.1)',
        'xl': '0 20px 25px -5px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
}
