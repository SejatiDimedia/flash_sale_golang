/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5', // Primary Brand Color
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        app: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          purple: '#4F46E5', // Repurposed to Electric Indigo
          violet: '#6366F1',
          pink: '#E11D48',
          magenta: '#4338CA',
          dark: '#0F172A',
          muted: '#64748B',
        },
      },
      backgroundImage: {
        'header-gradient': 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        'purple-btn': 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
        'pill-active': 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        'soft-glow': 'none',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
        'btn': '0 4px 14px 0 rgba(79, 70, 229, 0.25)',
        'dock': '0 10px 30px -5px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
}
