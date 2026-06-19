/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { inter: ['Inter', 'sans-serif'] },
      colors: {
        red: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
      },
      keyframes: {
        /* entrance */
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(28px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        /* message slide */
        slideRight: {
          from: { opacity: '0', transform: 'translateX(18px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        slideLeft: {
          from: { opacity: '0', transform: 'translateX(-18px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        /* floating background orbs */
        float: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%':     { transform: 'translate(15px,-25px) scale(1.04)' },
          '66%':     { transform: 'translate(-12px,12px) scale(0.97)' },
        },
        floatB: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '40%':     { transform: 'translate(-18px,-18px) scale(1.06)' },
          '70%':     { transform: 'translate(10px,20px) scale(0.95)' },
        },
        /* marquee */
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        /* shimmer overlay on buttons */
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        /* pulsing dot */
        pulseDot: {
          '0%,100%': { opacity: '1',   transform: 'scale(1)' },
          '50%':     { opacity: '0.3', transform: 'scale(1.8)' },
        },
        /* spinning glow ring */
        spinSlow: {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        /* typing bounce */
        typingBounce: {
          '0%,100%': { transform: 'translateY(0)',    opacity: '0.4' },
          '50%':     { transform: 'translateY(-6px)', opacity: '1'   },
        },
      },
      animation: {
        'fade-up':        'fadeUp 0.55s cubic-bezier(.22,.68,0,1.2) forwards',
        'fade-up-1':      'fadeUp 0.55s cubic-bezier(.22,.68,0,1.2) 0.1s both',
        'fade-up-2':      'fadeUp 0.55s cubic-bezier(.22,.68,0,1.2) 0.2s both',
        'fade-up-3':      'fadeUp 0.55s cubic-bezier(.22,.68,0,1.2) 0.3s both',
        'fade-up-4':      'fadeUp 0.55s cubic-bezier(.22,.68,0,1.2) 0.4s both',
        'fade-in':        'fadeIn 0.4s ease forwards',
        'scale-in':       'scaleIn 0.35s cubic-bezier(.22,.68,0,1.2) forwards',
        'slide-right':    'slideRight 0.3s ease forwards',
        'slide-left':     'slideLeft 0.3s ease forwards',
        'float':          'float  7s ease-in-out infinite',
        'float-b':        'floatB 9s ease-in-out 1.5s infinite',
        'float-c':        'float 11s ease-in-out 3s infinite',
        'marquee':        'marquee 22s linear infinite',
        'shimmer':        'shimmer 2.2s linear infinite',
        'pulse-dot':      'pulseDot 2s ease-in-out infinite',
        'spin-slow':      'spinSlow 8s linear infinite',
        'typing-bounce':  'typingBounce 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
