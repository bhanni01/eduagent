import { useNavigate } from 'react-router-dom'

/* ── Marquee keywords (maintouch-style ticker) ─────────────────────────── */
const KEYWORDS = [
  '📚 Science', '🔬 Experiments', '🌱 Photosynthesis', '💧 Water Cycle',
  '🧬 Cells', '🌍 Environment', '⚗️ Chemistry', '🔭 Space',
  '🧪 Biology', '📐 Measurement', '🌡️ Temperature', '🦋 Life Science',
  '📚 Science', '🔬 Experiments', '🌱 Photosynthesis', '💧 Water Cycle',
  '🧬 Cells', '🌍 Environment', '⚗️ Chemistry', '🔭 Space',
  '🧪 Biology', '📐 Measurement', '🌡️ Temperature', '🦋 Life Science',
]

/* ── Floating background particles ─────────────────────────────────────── */
const PARTICLES = [
  { size: 180, top: '8%',  left: '5%',  dur: '7s',  dx: '20px',  dy: '-25px' },
  { size: 120, top: '60%', left: '80%', dur: '9s',  dx: '-15px', dy: '18px'  },
  { size: 90,  top: '30%', left: '90%', dur: '11s', dx: '-20px', dy: '-12px' },
  { size: 200, top: '75%', left: '2%',  dur: '8s',  dx: '12px',  dy: '-20px' },
  { size: 60,  top: '15%', left: '50%', dur: '6s',  dx: '-8px',  dy: '14px'  },
  { size: 140, top: '50%', left: '35%', dur: '13s', dx: '18px',  dy: '10px'  },
]

export default function Login() {
  const navigate = useNavigate()

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 30%, #b91c1c 60%, #dc2626 100%)' }}
    >
      {/* ── Floating particles ──────────────────────────────────────────── */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={{
            width: p.size, height: p.size,
            top: p.top, left: p.left,
            '--dur': p.dur, '--dx': p.dx, '--dy': p.dy,
          }}
        />
      ))}

      {/* ── Spinning gradient ring (background accent) ──────────────────── */}
      <div
        className="absolute pointer-events-none animate-spin-slow"
        style={{
          width: 600, height: 600,
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'conic-gradient(from 0deg, transparent 60%, rgba(255,255,255,0.07) 100%)',
          borderRadius: '50%',
        }}
      />

      {/* ── Keyword marquee (maintouch-inspired ticker) ─────────────────── */}
      <div className="absolute top-0 left-0 right-0 py-3 overflow-hidden pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.15)' }}>
        <div className="marquee-track gap-8 flex">
          {KEYWORDS.map((k, i) => (
            <span key={i} className="text-white/70 text-xs font-medium whitespace-nowrap px-4">
              {k}
            </span>
          ))}
        </div>
      </div>

      {/* ── Main card ───────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md px-4 mt-10">
        <div className="animate-fade-up bg-white rounded-3xl shadow-2xl px-10 py-12 text-center"
          style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.35)' }}>

          {/* Logo with spinning glow ring */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-2xl animate-spin-slow"
              style={{
                background: 'conic-gradient(#b91c1c, #ef4444, #b91c1c)',
                borderRadius: '18px',
                padding: '3px',
              }}
            />
            <div className="relative w-full h-full rounded-2xl flex items-center justify-center text-4xl shadow-red-glow"
              style={{ background: 'linear-gradient(135deg, #b91c1c, #dc2626)' }}>
              🎓
            </div>
          </div>

          {/* Title */}
          <div className="animate-fade-up-1">
            <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-gradient-red">
              EduAgent Nepal
            </h1>
            <p className="text-gray-400 text-sm font-medium mb-10">
              Smart Learning for Every Student
            </p>
          </div>

          {/* Role buttons */}
          <div className="flex gap-4 animate-fade-up-2">
            <button
              onClick={() => navigate('/student')}
              className="flex-1 group flex flex-col items-center gap-3 py-6 px-4 rounded-2xl
                         btn-shimmer text-white active:scale-95
                         transition-transform duration-200 shadow-red-glow hover:shadow-xl hover:-translate-y-1.5"
            >
              <span className="text-4xl group-hover:scale-110 transition-transform duration-200 drop-shadow">📚</span>
              <div>
                <p className="font-bold text-sm">I am a Student</p>
                <p className="text-white/60 text-xs mt-0.5">Grade 4–7</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/parent')}
              className="flex-1 group flex flex-col items-center gap-3 py-6 px-4 rounded-2xl
                         border-2 border-red-200 bg-red-50 hover:bg-red-100
                         text-red-700 active:scale-95
                         transition-all duration-200 hover:-translate-y-1.5 hover:shadow-red-sm"
            >
              <span className="text-4xl group-hover:scale-110 transition-transform duration-200">👨‍👩‍👧</span>
              <div>
                <p className="font-bold text-sm text-red-800">I am a Parent</p>
                <p className="text-red-400 text-xs mt-0.5">View progress</p>
              </div>
            </button>
          </div>

          <p className="text-gray-300 text-xs mt-8 animate-fade-up-3">
            Powered by AI · Built for Nepali Schools
          </p>
        </div>

        {/* ── Bottom badge ─────────────────────────────────────────────── */}
        <p className="text-white/30 text-xs text-center mt-5 animate-fade-up-4">
          Science · Grade 6 NCERT · 2025–26
        </p>
      </div>

      {/* ── Bottom marquee ──────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 py-2.5 overflow-hidden pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.15)' }}>
        <div className="marquee-track gap-8 flex" style={{ animationDirection: 'reverse' }}>
          {KEYWORDS.map((k, i) => (
            <span key={i} className="text-white/50 text-xs font-medium whitespace-nowrap px-4">
              {k}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
