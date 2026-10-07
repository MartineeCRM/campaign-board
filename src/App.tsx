import { useEffect } from 'react'
import { useBoardStore } from './store'

export default function App() {
  const tick = useBoardStore((s) => s.tick)

  useEffect(() => {
    const id = setInterval(tick, 2500)
    return () => clearInterval(id)
  }, [tick])

  return <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>Loading board…</div>
}
