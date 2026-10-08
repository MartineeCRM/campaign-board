import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useBoardStore } from './store'
import Login from './components/Login'
import Header from './components/Header'
import Legend from './components/Legend'
import FunnelBoard from './components/FunnelBoard'
import DetailPanel from './components/DetailPanel'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const dataLoaded = useBoardStore((s) => s.dataLoaded)
  const loadFromSupabase = useBoardStore((s) => s.loadFromSupabase)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) void loadFromSupabase()
  }, [session, loadFromSupabase])

  if (session === undefined) {
    return <div style={{ minHeight: '100vh', background: '#f2f4f6' }} />
  }

  if (session === null) {
    return <Login />
  }

  if (!dataLoaded) {
    return <div style={{ minHeight: '100vh', background: '#f2f4f6' }} />
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <Legend />
      <FunnelBoard />
      <DetailPanel />
    </div>
  )
}
