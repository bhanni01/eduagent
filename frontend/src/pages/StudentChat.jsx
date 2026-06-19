import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatStudent } from '../api'

const STARTERS = [
  'What is photosynthesis?',
  'How do plants make food?',
  'What is the water cycle?',
]

/* ── Typing dots (maintouch-style) ─────────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex gap-1.5 items-center px-5 py-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-red-300 rounded-full"
          style={{
            animation: `typingBounce 1s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

/* ── Tool badge with animated pulse dot ───────────────────────────────── */
function ToolBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-500 text-xs px-3 py-1 rounded-full mb-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      Searched syllabus
    </span>
  )
}

/* ── Single chat message ────────────────────────────────────────────────── */
function Msg({ m }) {
  const isUser = m.role === 'user'
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse msg-user' : 'flex-row msg-bot'}`}>
      {!isUser && (
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 mb-1 shadow-red-sm"
          style={{ background: 'linear-gradient(135deg, #b91c1c, #dc2626)' }}>
          🤖
        </div>
      )}
      <div className={`max-w-[72%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && m.tool_called && <ToolBadge />}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
          ${isUser
            ? 'text-white rounded-br-sm shadow-red-sm'
            : 'bg-white text-gray-800 rounded-bl-sm border border-red-100'
          }`}
          style={isUser ? { background: 'linear-gradient(135deg, #b91c1c, #dc2626)' } : {}}
        >
          {m.content}
        </div>
      </div>
    </div>
  )
}

/* ── Empty-state suggestion chip ────────────────────────────────────────── */
function Chip({ label, onClick, delay }) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-red-200 hover:border-red-500 hover:bg-red-50
                 text-gray-600 hover:text-red-700 text-sm px-5 py-2.5 rounded-xl shadow-sm
                 transition-all duration-200 hover:-translate-y-0.5 animate-fade-up"
      style={{ animationDelay: delay }}
    >
      {label}
    </button>
  )
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function StudentChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setError(null)
    inputRef.current?.focus()
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const { data } = await chatStudent(msg, history)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer, tool_called: data.tool_called },
      ])
    } catch {
      setError('Could not reach the server. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-red-50/40 font-inter overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-64 flex flex-col py-5 shrink-0"
        style={{ background: 'linear-gradient(180deg, #991b1b 0%, #b91c1c 100%)' }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shadow-sm"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            🎓
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">EduAgent Nepal</p>
            <p className="text-red-200/60 text-[10px]">Science Tutor</p>
          </div>
        </div>

        {/* New Chat */}
        <div className="px-3 mb-4">
          <button
            onClick={() => { setMessages([]); setError(null) }}
            className="w-full flex items-center justify-center gap-2
                       bg-white/10 hover:bg-white/20 active:bg-white/30
                       text-white text-sm font-medium rounded-xl px-4 py-2.5
                       transition-all duration-200 border border-white/15"
          >
            <span className="text-base leading-none">+</span> New Chat
          </button>
        </div>

        {/* Suggestions */}
        <div className="flex-1 px-3 overflow-y-auto">
          <p className="text-red-200/40 text-[10px] font-semibold uppercase tracking-widest px-2 mb-2">
            Quick Questions
          </p>
          {STARTERS.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="w-full text-left text-red-100/60 hover:text-white hover:bg-white/10
                         text-xs px-3 py-2.5 rounded-xl mb-1
                         transition-all duration-200 truncate group">
              <span className="group-hover:translate-x-1 inline-block transition-transform duration-200">
                {s}
              </span>
            </button>
          ))}
        </div>

        {/* Back */}
        <div className="px-3 pt-3 border-t border-white/10 mt-2">
          <button onClick={() => navigate('/')}
            className="w-full text-left text-red-200/40 hover:text-red-100 text-xs px-3 py-2
                       transition-colors duration-200 group">
            <span className="group-hover:-translate-x-1 inline-block transition-transform duration-200">←</span>
            {' '}Back to Login
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <header className="bg-white border-b border-red-100 px-6 py-4 flex items-center gap-3 shrink-0 shadow-sm">
          <h1 className="text-base font-bold text-red-800">Student Mode</h1>
          <span className="bg-red-50 text-red-600 text-xs font-semibold px-3 py-1 rounded-full border border-red-200">
            Grade 4–7 Science
          </span>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center pb-16">
              {/* Animated bot avatar */}
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl animate-scale-in shadow-red-glow"
                  style={{ background: 'linear-gradient(135deg, #b91c1c, #ef4444)' }}>
                  🤖
                </div>
                {/* Pulsing ring */}
                <div className="absolute inset-0 rounded-3xl animate-ping opacity-20"
                  style={{ background: 'linear-gradient(135deg, #b91c1c, #ef4444)' }} />
              </div>
              <h2 className="text-2xl font-bold text-red-800 mb-2 animate-fade-up">Hi! I'm EduBot</h2>
              <p className="text-gray-400 text-sm mb-8 max-w-xs leading-relaxed animate-fade-up-1">
                Ask me anything from your Grade 6 Science textbook. I'm here to help you learn!
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                {STARTERS.map((s, i) => (
                  <Chip key={s} label={s} onClick={() => send(s)} delay={`${i * 0.08}s`} />
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-5">
              {messages.map((m, i) => <Msg key={i} m={m} />)}
              {loading && (
                <div className="flex items-end gap-2 msg-bot">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 shadow-red-sm"
                    style={{ background: 'linear-gradient(135deg, #b91c1c, #dc2626)' }}>
                    🤖
                  </div>
                  <div className="bg-white border border-red-100 rounded-2xl rounded-bl-sm shadow-sm">
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mb-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl animate-fade-in">
            <span>⚠️</span>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 transition-colors">✕</button>
          </div>
        )}

        {/* Input bar */}
        <div className="bg-white border-t border-red-100 px-6 py-4 shrink-0">
          <div className="max-w-3xl mx-auto flex gap-3 items-center">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask me anything from your syllabus..."
              disabled={loading}
              className="flex-1 bg-red-50/60 border border-red-200 rounded-xl px-4 py-3 text-sm
                         focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/15
                         disabled:opacity-50 transition-all duration-200 placeholder:text-gray-400"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="btn-shimmer disabled:opacity-40 disabled:cursor-not-allowed
                         text-white rounded-xl px-5 py-3 text-base font-bold
                         transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0
                         shadow-red-sm hover:shadow-red-glow"
              aria-label="Send"
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
