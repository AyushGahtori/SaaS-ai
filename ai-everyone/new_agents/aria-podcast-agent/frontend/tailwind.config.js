/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        aria: {
          bg: '#0a0a0f',
          surface: '#111118',
          card: '#16161f',
          border: '#252535',
          accent: '#7c3aed',
          'accent-hover': '#6d28d9',
          'accent-light': '#a78bfa',
          host: '#ec4899',
          'host-hover': '#db2777',
          text: '#e2e2f0',
          muted: '#6b6b8a',
          success: '#10b981',
          error: '#ef4444',
        },
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 1.5s infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
      },
    },
  },
  plugins: [],
};
