/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        app: {
          bg: '#EFE5FB',
          card: '#FFFFFF',
          purple: '#A855F7',
          violet: '#C084FC',
          pink: '#E879F9',
          magenta: '#D946EF',
          dark: '#1E1B4B',
          muted: '#64748B',
        },
      },
      backgroundImage: {
        'header-gradient': 'linear-gradient(135deg, #9333EA 0%, #A855F7 40%, #C084FC 75%, #E879F9 100%)',
        'purple-btn': 'linear-gradient(135deg, #A855F7 0%, #C026D3 100%)',
        'pill-active': 'linear-gradient(135deg, #C026D3 0%, #D946EF 100%)',
        'soft-glow': 'radial-gradient(circle at center, rgba(192, 132, 252, 0.25) 0%, rgba(239, 229, 251, 0) 70%)',
      },
      boxShadow: {
        'card': '0 12px 35px -10px rgba(168, 85, 247, 0.15)',
        'btn': '0 8px 25px -5px rgba(192, 38, 211, 0.4)',
        'dock': '0 15px 40px -5px rgba(107, 33, 168, 0.15)',
      },
    },
  },
  plugins: [],
}
