import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts'
import { chatParent, getStudent, getStudentSummary } from '../api'

/* ── Count-up hook ──────────────────────────────────────────────────────── */
function useCountUp(target, duration = 900, trigger = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!trigger) return
    setCount(0)
    const startTime = performance.now()
    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)       // ease-out cubic
      setCount(Math.round(ease * target))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration, trigger])
  return count
}

/* ── Animated circular progress SVG ─────────────────────────────────────── */
function CircularProgress({ value, ready }) {
  const r = 30
  const circ = 2 * Math.PI * r
  const color = value >= 80 ? '#16a34a' : value >= 60 ? '#f59e0b' : '#dc2626'
  const animatedVal = useCountUp(value, 900, ready)
  const offset = circ * (1 - animatedVal / 100)
  return (
    <svg width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#fee2e2" strokeWidth="7" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.3s' }} />
      <text x="40" y="40" textAnchor="middle" dominantBaseline="middle"
        fontSize="13" fill="#991b1b" fontWeight="700">
        {animatedVal}%
      </text>
    </svg>
  )
}

/* ── Typing dots ─────────────────────────────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex gap-1.5 items-center px-4 py-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-2 h-2 bg-red-300 rounded-full"
          style={{ animation: `typingBounce 1s ease-in-out ${i * 0.18}s infinite` }} />
      ))}
    </div>
  )
}

/* ── Tool badge ──────────────────────────────────────────────────────────── */
function ToolBadge({ name }) {
  return (
    <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200
                     text-red-400 text-[10px] px-2.5 py-1 rounded-full mb-1.5">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
      </span>
      {name.replace(/_/g, ' ')}
    </span>
  )
}

/* ── Performance color map ─────────────────────────────────────────────── */
const PERF_SCORE = { Excellent: 100, Good: 75, 'Needs Improvement': 40 }
const PERF_COLOR = {
  Excellent:         'bg-emerald-100 text-emerald-700 border-emerald-200',
  Good:              'bg-blue-100 text-blue-700 border-blue-200',
  'Needs Improvement': 'bg-red-100 text-red-700 border-red-200',
}

const CHAT_STARTERS = [
  'How is Ram doing?',
  'Does Sita owe any fees?',
  "What is Hari's attendance?",
]

/* ── Animated stat card ──────────────────────────────────────────────────── */
function StatCard({ children, delay, ready }) {
  return (
    <div
      className={`bg-white rounded-2xl p-5 shadow-sm border border-red-100
                  transition-all duration-300 hover:-translate-y-1 hover:shadow-red-sm
                  ${ready ? 'animate-fade-up opacity-100' : 'opacity-0'}`}
      style={ready ? { animationDelay: delay } : {}}
    >
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

export default function ParentDashboard() {
  const navigate = useNavigate()

  /* chat */
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)
  const bottomRef = useRef(null)

  /* dashboard */
  const [searchName, setSearchName] = useState('')
  const [student, setStudent] = useState(null)
  const [aiSummary, setAiSummary] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [statsReady, setStatsReady] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  /* ── Chat ─────────────────────────────────────────────────────────────── */
  async function sendChat(text) {
    const msg = (text ?? chatInput).trim()
    if (!msg || chatLoading) return
    setChatInput('')
    setChatError(null)
    setMessages((prev) => [...prev, { role: 'user', content: msg }])
    setChatLoading(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const { data } = await chatParent(msg, history)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer, tool_called: data.tool_called },
      ])
    } catch {
      setChatError('Server unreachable — is the backend running?')
    } finally {
      setChatLoading(false)
    }
  }

  /* ── Student search ───────────────────────────────────────────────────── */
  async function searchStudent() {
    if (!searchName.trim()) return
    setSearchLoading(true)
    setSearchError(null)
    setStudent(null)
    setAiSummary(null)
    setStatsReady(false)

    try {
      const { data } = await getStudent(searchName)
      setStudent(data)
      setTimeout(() => setStatsReady(true), 80)  // small delay so DOM renders first

      setSummaryLoading(true)
      try {
        const { data: s } = await getStudentSummary(data.name)
        setAiSummary(s.summary)
      } catch { setAiSummary(null) }
      finally { setSummaryLoading(false) }

    } catch (e) {
      setSearchError(
        e.response?.status === 404
          ? `No student named "${searchName}". Try: Ram, Sita, or Hari.`
          : 'Server error — is the backend running?'
      )
    } finally {
      setSearchLoading(false)
    }
  }

  /* ── Chart data ───────────────────────────────────────────────────────── */
  const chartData = student ? [
    { name: 'Attendance',   value: Math.round(student.attendance_percent) },
    { name: 'Homework',     value: Math.round((student.homework_done / student.homework_total) * 100) },
    { name: 'Performance',  value: PERF_SCORE[student.class_performance] ?? 50 },
    { name: 'Fees OK',      value: student.fees_due === 0 ? 100 : 30 },
  ] : []

  const barColor = (v) => v >= 75 ? '#b91c1c' : v >= 50 ? '#f59e0b' : '#ef4444'

  /* count-up values */
  const feeCount    = useCountUp(student?.fees_due ?? 0, 900, statsReady)
  const hwPct       = useCountUp(
    student ? Math.round((student.homework_done / student.homework_total) * 100) : 0,
    900, statsReady
  )

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen bg-red-50/30 font-inter overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="px-6 py-4 flex items-center justify-between shrink-0 shadow-md"
        style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shadow-sm animate-spin-slow"
            style={{ background: 'rgba(255,255,255,0.15)' }}>
            🎓
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">EduAgent Nepal</h1>
            <span className="text-red-200 text-xs font-semibold">Parent Portal</span>
          </div>
        </div>
        <button onClick={() => navigate('/')}
          className="text-white/60 hover:text-white text-sm font-medium transition-colors duration-200 group">
          Logout <span className="group-hover:translate-x-1 inline-block transition-transform duration-200">→</span>
        </button>
      </header>

      {/* ── Two-column body ─────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: Chat ──────────────────────────────────────────────── */}
        <div className="w-[40%] flex flex-col border-r border-red-100 bg-white shrink-0 min-w-0">
          <div className="px-5 py-4 border-b border-red-50">
            <p className="text-sm font-bold text-red-800">AI Assistant</p>
            <p className="text-xs text-gray-400 mt-0.5">Ask about your child's progress</p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6 animate-fade-up">
                <div className="text-4xl mb-3">👋</div>
                <p className="text-gray-500 text-sm mb-5 leading-relaxed">
                  Ask me about any student.<br />I'll look up their records.
                </p>
                <div className="flex flex-col gap-2">
                  {CHAT_STARTERS.map((s) => (
                    <button key={s} onClick={() => sendChat(s)}
                      className="text-xs text-left bg-red-50/70 hover:bg-red-100 border border-red-100
                                 hover:border-red-300 rounded-xl px-3 py-2.5 text-red-800
                                 transition-all duration-200 hover:translate-x-1">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end msg-user' : 'justify-start msg-bot'}`}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                  ${m.role === 'user'
                    ? 'text-white rounded-br-sm shadow-red-sm'
                    : 'bg-red-50/70 border border-red-100 text-gray-800 rounded-bl-sm'
                  }`}
                  style={m.role === 'user'
                    ? { background: 'linear-gradient(135deg, #b91c1c, #dc2626)' }
                    : {}
                  }
                >
                  {m.role === 'assistant' && m.tool_called && <ToolBadge name={m.tool_called} />}
                  <p>{m.content}</p>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start msg-bot">
                <div className="bg-red-50 border border-red-100 rounded-2xl rounded-bl-sm">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {chatError && (
            <div className="mx-4 mb-2 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl animate-fade-in">
              <span>⚠️</span><span className="flex-1">{chatError}</span>
              <button onClick={() => setChatError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          <div className="border-t border-red-50 px-4 py-3 shrink-0">
            <div className="flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="Ask about your child..."
                disabled={chatLoading}
                className="flex-1 text-xs bg-red-50/60 border border-red-200 rounded-xl px-3 py-2.5
                           focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/15
                           disabled:opacity-50 transition-all duration-200 placeholder:text-gray-400" />
              <button onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}
                className="btn-shimmer disabled:opacity-40 text-white rounded-xl px-3 py-2 text-xs
                           transition-all duration-200 hover:shadow-red-sm">
                ➤
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Dashboard ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* Search */}
          <div className="flex gap-3 mb-6">
            <input value={searchName} onChange={(e) => setSearchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchStudent()}
              placeholder="Enter child's name  (Ram, Sita, Hari)"
              className="flex-1 bg-white border border-red-200 rounded-xl px-4 py-3 text-sm shadow-sm
                         focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/15
                         transition-all duration-200 placeholder:text-gray-400" />
            <button onClick={searchStudent}
              disabled={searchLoading || !searchName.trim()}
              className="btn-shimmer disabled:opacity-40 text-white font-semibold rounded-xl px-6 py-3
                         text-sm transition-all duration-200 shadow-red-sm hover:shadow-red-glow
                         hover:-translate-y-0.5 active:translate-y-0">
              {searchLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Searching
                </span>
              ) : 'Search'}
            </button>
          </div>

          {searchError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5 animate-fade-in">
              ⚠️ {searchError}
            </div>
          )}

          {!student && !searchError && (
            <div className="flex flex-col items-center justify-center py-20 text-red-200">
              <div className="text-6xl mb-4 animate-fade-up">📋</div>
              <p className="text-base font-medium text-red-300 animate-fade-up-1">Search for a student</p>
              <p className="text-sm mt-1 text-red-200/60 animate-fade-up-2">to see their report card</p>
            </div>
          )}

          {student && (
            <div className="space-y-4">

              {/* Name banner */}
              <div className="rounded-2xl p-6 text-white flex items-center justify-between shadow-md animate-scale-in"
                style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 60%, #dc2626 100%)' }}>
                <div>
                  <p className="text-red-200/60 text-xs font-medium mb-1 uppercase tracking-wider">Student</p>
                  <h2 className="text-3xl font-extrabold tracking-tight">{student.name}</h2>
                </div>
                <div className="text-right">
                  <span className="bg-white/15 text-white font-bold px-5 py-2 rounded-xl text-sm border border-white/20">
                    Grade {student.grade}
                  </span>
                </div>
              </div>

              {/* 2×2 stat grid */}
              <div className="grid grid-cols-2 gap-4">

                {/* Fees */}
                <StatCard delay="0s" ready={statsReady}>
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Fees Due</p>
                    <span className="text-xl">{student.fees_due > 0 ? '⚠️' : '✅'}</span>
                  </div>
                  <p className={`text-2xl font-extrabold tabular-nums
                    ${student.fees_due > 0 ? 'text-red-600' : 'text-emerald-500'}`}>
                    {student.fees_due > 0 ? `NPR ${feeCount.toLocaleString()}` : 'All Paid'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {student.fees_due > 0 ? 'Outstanding balance' : 'No dues pending'}
                  </p>
                </StatCard>

                {/* Attendance */}
                <StatCard delay="0.08s" ready={statsReady}>
                  <div className="flex items-center gap-4">
                    <CircularProgress value={Math.round(student.attendance_percent)} ready={statsReady} />
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Attendance</p>
                      <p className="text-xl font-extrabold text-red-800 tabular-nums">{student.attendance_percent}%</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {student.attendance_percent >= 80 ? 'Excellent' :
                         student.attendance_percent >= 60 ? 'Average' : 'Needs attention'}
                      </p>
                    </div>
                  </div>
                </StatCard>

                {/* Homework */}
                <StatCard delay="0.16s" ready={statsReady}>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Homework</p>
                  <p className="text-2xl font-extrabold text-red-800 mb-2 tabular-nums">
                    {student.homework_done}
                    <span className="text-red-200 font-normal">/{student.homework_total}</span>
                  </p>
                  <div className="bg-red-50 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-gradient-to-r from-red-700 to-red-500 h-2.5 rounded-full progress-fill"
                      style={{ '--target-w': `${hwPct}%`, width: statsReady ? `${hwPct}%` : '0%',
                               transition: 'width 0.9s cubic-bezier(.22,.68,0,1.2)' }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">assignments completed</p>
                </StatCard>

                {/* Performance */}
                <StatCard delay="0.24s" ready={statsReady}>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Performance</p>
                  <span className={`inline-block text-sm font-bold px-4 py-1.5 rounded-xl border
                    ${PERF_COLOR[student.class_performance] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {student.class_performance}
                  </span>
                  <p className="text-xs text-gray-400 mt-3">Class rating this term</p>
                </StatCard>
              </div>

              {/* Bar chart */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-red-100 animate-fade-up"
                style={{ animationDelay: '0.32s' }}>
                <p className="text-sm font-bold text-red-800 mb-4">Performance Overview</p>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={chartData} barSize={36} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fee2e2" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip
                      formatter={(v) => [`${v}%`, '']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #fee2e2', fontSize: 12 }}
                      cursor={{ fill: '#fff5f5' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((e, i) => <Cell key={i} fill={barColor(e.value)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* AI Summary */}
              <div className="rounded-2xl p-5 animate-fade-up border"
                style={{
                  animationDelay: '0.4s',
                  background: 'linear-gradient(135deg, #fff5f5 0%, #fff 100%)',
                  borderColor: '#fecaca',
                }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">✨</span>
                  <p className="text-xs text-red-500 font-bold uppercase tracking-wider">AI Summary</p>
                </div>
                {summaryLoading ? (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Generating summary...
                  </div>
                ) : aiSummary ? (
                  <p className="text-sm text-red-900 leading-relaxed">{aiSummary}</p>
                ) : (
                  <p className="text-sm text-red-300 italic">
                    Ask the assistant on the left for a personalized summary.
                  </p>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
