const ITEMS: { style: React.CSSProperties; label: string }[] = [
  { style: { borderTop: '2px solid #b0b8c1' }, label: '실선 · 핵심 경로' },
  { style: { borderTop: '2px dashed #b0b8c1' }, label: '점선 · 선택 경로' },
  { style: { borderTop: '3px dotted #b0b8c1' }, label: '점점선 · 이탈/복귀' },
]

export default function Legend() {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px 28px',
        alignItems: 'center',
        padding: '24px 48px 0',
        fontSize: 12,
        color: '#8b95a1',
      }}
    >
      {ITEMS.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, ...item.style }} />
          {item.label}
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginLeft: 'auto',
          fontWeight: 600,
          color: '#1a8a44',
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#1a9a4a',
            animation: 'livePulse 1.6s infinite',
          }}
        />
        캠페인 데이터 실시간 연동
      </div>
    </div>
  )
}
