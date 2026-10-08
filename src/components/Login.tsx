import { useState } from 'react'
import { supabase } from '../supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError('이메일 또는 비밀번호가 올바르지 않습니다.')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f2f4f6',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 320,
          background: '#fff',
          borderRadius: 18,
          padding: '32px 28px',
          boxShadow: '0 4px 18px rgba(0,20,60,.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 4 }}>
          Campaign Funnel Board
        </div>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          style={{ fontSize: 14, padding: '10px 12px', border: '1px solid #e5e8eb', borderRadius: 10 }}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          style={{ fontSize: 14, padding: '10px 12px', border: '1px solid #e5e8eb', borderRadius: 10 }}
        />
        {error && <div style={{ fontSize: 12.5, color: '#f04452' }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{
            fontSize: 14,
            fontWeight: 700,
            padding: '11px 0',
            border: 0,
            borderRadius: 10,
            color: '#fff',
            background: '#191f28',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </div>
  )
}
