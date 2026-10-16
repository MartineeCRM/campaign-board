import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { useBoardStore } from '../store'

interface Props {
  onClose: () => void
}

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '9px 11px',
  border: '1px solid #e5e8eb',
  borderRadius: 8,
  width: '100%',
  boxSizing: 'border-box',
  color: '#191f28',
  background: '#fff',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#4e5968',
  marginBottom: 4,
  display: 'block',
}

function SectionCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e8eb', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #f2f4f6' }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: '#8b95a1', marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </div>
  )
}

function SaveButton({ saving, label = '저장' }: { saving: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={saving}
      style={{
        fontSize: 13, fontWeight: 700, padding: '10px 0', border: 0, borderRadius: 10,
        background: saving ? '#e5e8eb' : '#191f28',
        color: saving ? '#8b95a1' : '#fff',
        cursor: saving ? 'not-allowed' : 'pointer',
        width: '100%',
      }}
    >
      {saving ? '저장 중...' : label}
    </button>
  )
}

function SyncButton({ onClick, loading, disabled, label }: { onClick: () => void; loading: boolean; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      style={{
        fontSize: 13, fontWeight: 700, padding: '10px 0', border: 0, borderRadius: 10,
        background: loading || disabled ? '#e5e8eb' : '#3182f6',
        color: loading || disabled ? '#8b95a1' : '#fff',
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        width: '100%',
      }}
    >
      {loading ? '싱크 중...' : label}
    </button>
  )
}

function StatusMsg({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <div style={{ fontSize: 12, color: '#f04452', padding: '8px 11px', borderRadius: 8, background: '#fff0f1' }}>{error}</div>
  if (ok) return <div style={{ fontSize: 12, color: '#1a9a4a', padding: '8px 11px', borderRadius: 8, background: '#e9f7ef' }}>{ok}</div>
  return null
}

export default function SettingsPanel({ onClose }: Props) {
  const clientId = useBoardStore((s) => s.clientId)
  const clients = useBoardStore((s) => s.clients)
  const client = useBoardStore((s) => s.currentClient())
  const renameClient = useBoardStore((s) => s.renameClient)
  const deleteClient = useBoardStore((s) => s.deleteClient)
  const isSyncing = useBoardStore((s) => s.isSyncing)
  const syncError = useBoardStore((s) => s.syncError)
  const syncBraze = useBoardStore((s) => s.syncBraze)
  const isSyncingSheets = useBoardStore((s) => s.isSyncingSheets)
  const isSyncingAll = useBoardStore((s) => s.isSyncingAll)
  const syncSheetsError = useBoardStore((s) => s.syncSheetsError)
  const syncSheetsMessage = useBoardStore((s) => s.syncSheetsMessage)
  const syncSheets = useBoardStore((s) => s.syncSheets)
  const updateClientSheetsTab = useBoardStore((s) => s.updateClientSheetsTab)
  const updateClientIamClickCount = useBoardStore((s) => s.updateClientIamClickCount)
  const updateClientConversionEventIndex = useBoardStore((s) => s.updateClientConversionEventIndex)

  // Braze
  const [baseUrl, setBaseUrl] = useState('')
  const [restApiUrl, setRestApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [brazeSaving, setBrazeSaving] = useState(false)
  const [brazeError, setBrazeError] = useState<string | null>(null)
  const [brazeOk, setBrazeOk] = useState(false)
  const [hasCreds, setHasCreds] = useState(false)
  const [brazeLoading, setBrazeLoading] = useState(true)
  const [brazeSyncDone, setBrazeSyncDone] = useState(false)
  const prevIsSyncing = useRef(false)

  // Sheets
  const [sheetsConfigured, setSheetsConfigured] = useState(false)
  const [sheetsLoaded, setSheetsLoaded] = useState(false)

  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void loadBrazeCreds() }, [clientId])
  useEffect(() => { void loadSheetsConfig() }, [])

  useEffect(() => {
    if (prevIsSyncing.current && !isSyncing && !syncError) {
      setBrazeSyncDone(true)
      const t = setTimeout(() => setBrazeSyncDone(false), 2000)
      return () => clearTimeout(t)
    }
    prevIsSyncing.current = isSyncing
  }, [isSyncing, syncError])

  async function loadBrazeCreds() {
    setBrazeLoading(true)
    const { data } = await supabase.from('braze_credentials').select('base_url, rest_api_url').eq('client_id', clientId).maybeSingle()
    if (data) { setBaseUrl(data.base_url); setRestApiUrl(data.rest_api_url); setHasCreds(true) }
    else { setBaseUrl(''); setRestApiUrl(''); setHasCreds(false) }
    setBrazeLoading(false)
    setTimeout(() => firstRef.current?.focus(), 50)
  }

  async function loadSheetsConfig() {
    const { data } = await supabase.from('sheets_config').select('spreadsheet_id').eq('id', 1).maybeSingle()
    setSheetsConfigured(Boolean(data?.spreadsheet_id))
    setSheetsLoaded(true)
  }

  async function handleBrazeSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey && !hasCreds) return
    setBrazeSaving(true); setBrazeError(null); setBrazeOk(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('로그인이 필요합니다')
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${supabaseUrl}/functions/v1/save-braze-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ clientId, baseUrl, restApiUrl, apiKey }),
      })
      const body = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`)
      setBrazeOk(true); setHasCreds(true); setApiKey('')
    } catch (err) {
      setBrazeError(err instanceof Error ? err.message : String(err))
    } finally {
      setBrazeSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f2f4f6', display: 'flex', flexDirection: 'column' }}>

      {/* 헤더 */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e8eb', padding: '0 40px', height: 60, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <button
          onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#4e5968', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 8 }}
        >
          ← 돌아가기
        </button>
        <div style={{ width: 1, height: 20, background: '#e5e8eb' }} />
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em' }}>설정</div>
      </div>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, maxWidth: 600, width: '100%', margin: '0 auto', padding: '32px 24px 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 고객사 */}
        <SectionCard title="고객사">
          <div>
            <label style={labelStyle}>고객사 이름</label>
            <input value={client?.name ?? ''} onChange={(e) => renameClient(e.target.value)} placeholder="고객사 이름" style={inputStyle} />
          </div>
        </SectionCard>

        {/* Braze */}
        <SectionCard title="Braze 연동" sub="API Key는 Supabase Vault에 암호화 저장됩니다">
          {brazeLoading ? (
            <div style={{ fontSize: 13, color: '#8b95a1', textAlign: 'center', padding: '8px 0' }}>불러오는 중...</div>
          ) : (
            <form onSubmit={(e) => void handleBrazeSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Dashboard Base URL</label>
                <input ref={firstRef} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://dashboard-01.braze.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>REST API URL</label>
                <input value={restApiUrl} onChange={(e) => setRestApiUrl(e.target.value)} placeholder="https://rest.iad-01.braze.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>
                  API Key
                  {hasCreds && <span style={{ fontWeight: 400, color: '#8b95a1', marginLeft: 6 }}>— 변경 시에만 입력</span>}
                </label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={hasCreds ? '••••••••••••••••' : 'REST API Key'} autoComplete="new-password" style={inputStyle} />
              </div>
              <StatusMsg error={brazeError} ok={brazeOk ? '저장됐습니다' : null} />
              <SaveButton saving={brazeSaving} />
              {hasCreds && (
                <>
                  <SyncButton onClick={() => void syncBraze()} loading={isSyncing} disabled={isSyncingAll} label="Braze 싱크" />
                  <StatusMsg error={syncError} ok={brazeSyncDone ? '동기화 완료' : null} />
                </>
              )}
            </form>
          )}
          <div>
            <label style={labelStyle}>인앱 메시지 클릭 집계</label>
            <select value={client?.iamClickCount ?? 'first'} onChange={(e) => updateClientIamClickCount(e.target.value as 'first' | 'both')} style={inputStyle}>
              <option value="first">본문 클릭 + 버튼 1 클릭 집계</option>
              <option value="both">본문 클릭 + 버튼 1·2 클릭 집계</option>
            </select>
            <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 5 }}>Slideup 본문 클릭은 항상 포함하고, 두 번째 버튼 포함 여부를 선택합니다.</div>
          </div>
          <div>
            <label style={labelStyle}>전환 지표 기준</label>
            <select value={client?.conversionEventIndex ?? 0} onChange={(e) => updateClientConversionEventIndex(Number(e.target.value))} style={inputStyle}>
              {['A · 기본 전환', 'B · 두 번째 전환', 'C · 세 번째 전환', 'D · 네 번째 전환', 'E · 다섯 번째 전환'].map((label, index) => (
                <option key={index} value={index}>{label}</option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: '#8b95a1', marginTop: 5 }}>고객사의 모든 캠페인 카드에 선택한 전환 이벤트를 표시합니다. 캠페인에 해당 이벤트가 없으면 기본 전환 A를 표시합니다.</div>
          </div>
        </SectionCard>

        {/* Google Sheets */}
        <SectionCard title="Google Sheets 연동" sub="공통 스프레드시트를 사용하며, 고객사별 탭 이름만 설정합니다">
          {!sheetsLoaded ? (
            <div style={{ fontSize: 13, color: '#8b95a1', textAlign: 'center', padding: '8px 0' }}>불러오는 중...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>고객사별 탭 이름 <span style={{ fontWeight: 400, color: '#8b95a1' }}>— 여러 개면 쉼표로 구분 · 입력 즉시 저장</span></label>
                <input value={client?.sheetsTab ?? ''} onChange={(e) => updateClientSheetsTab(e.target.value)} placeholder="캠페인 점검, 캔버스 점검" style={inputStyle} />
              </div>
              {sheetsConfigured ? (
                <>
                  <SyncButton onClick={() => void syncSheets()} loading={isSyncingSheets} disabled={!client?.sheetsTab || isSyncingAll} label={client?.sheetsTab ? 'Sheets 싱크' : '탭 이름을 먼저 저장하세요'} />
                  <StatusMsg error={syncSheetsError} ok={syncSheetsMessage} />
                </>
              ) : (
                <StatusMsg error="공통 Google Sheets 연결 설정을 확인하세요" />
              )}
            </div>
          )}
        </SectionCard>

      </div>

      {/* 고객사 삭제 */}
      {clients.length > 1 && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`"${client?.name}" 고객사를 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) {
              deleteClient(); onClose()
            }
          }}
          style={{ position: 'fixed', bottom: 24, left: 24, fontSize: 12, color: '#f04452', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          고객사 삭제
        </button>
      )}
    </div>
  )
}
