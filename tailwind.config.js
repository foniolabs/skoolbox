/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2E7D32',
          light: '#66BB6A',
          dark: '#1B5E20',
        },
        accent: {
          DEFAULT: '#FF8F00',
          light: '#FFB74D',
        },
        success: '#2E7D32',
        error: '#C62828',
        warning: '#F9A825',
        'bg-app': '#F0F7F4',
        'bg-card': '#FFFFFF',
        'bg-primary': '#FFFFFF',
        'bg-secondary': '#F0F7F4',
        'bg-dark': '#1A1A2E',
        'card-green': '#8BC34A',
        'card-orange': '#FF9800',
        'card-coral': '#FF6B6B',
        'card-blue': '#42A5F5',
        'progress-green': '#66BB6A',
        'progress-yellow': '#FFCA28',
        'progress-orange': '#FFA726',
        'progress-red': '#EF5350',
        'text-primary': '#1A1A2E',
        'text-secondary': '#64748B',
        'text-muted': '#94A3B8',
        border: '#E2E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
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
        'card': '0 2px 12px rgba(0,0,0,0.06)',
        'md': '0 4px 6px -1px rgba(0,0,0,0.1)',
        'lg': '0 10px 15px -3px rgba(0,0,0,0.1)',
        'xl': '0 20px 25px -5px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
}
