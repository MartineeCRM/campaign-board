import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { useBoardStore } from '../store'

interface Props {
  onClose: () => void
}

export default function BrazeSettingsModal({ onClose }: Props) {
  const clientId = useBoardStore((s) => s.clientId)
  const isSyncing = useBoardStore((s) => s.isSyncing)
  const syncError = useBoardStore((s) => s.syncError)
  const syncBraze = useBoardStore((s) => s.syncBraze)

  const [baseUrl, setBaseUrl] = useState('')
  const [restApiUrl, setRestApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveOk, setSaveOk] = useState(false)
  const [hasCreds, setHasCreds] = useState(false)
  const [loading, setLoading] = useState(true)

  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstRef.current?.focus()
    void loadCreds()
  }, [clientId])

  async function loadCreds() {
    setLoading(true)
    const { data } = await supabase
      .from('braze_credentials')
      .select('base_url, rest_api_url')
      .eq('client_id', clientId)
      .maybeSingle()
    if (data) {
      setBaseUrl(data.base_url)
      setRestApiUrl(data.rest_api_url)
      setHasCreds(true)
    }
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey && !hasCreds) {
      setSaveError('API Key를 입력하세요')
      return
    }
    setSaving(true)
    setSaveError(null)
    setSaveOk(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('로그인이 필요합니다')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const res = await fetch(`${supabaseUrl}/functions/v1/save-braze-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clientId, baseUrl, restApiUrl, apiKey }),
      })
      const body = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`)
      setSaveOk(true)
      setHasCreds(true)
      setApiKey('')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleSync() {
    await syncBraze()
  }

  const inputStyle: React.CSSProperties = {
    fontSize: 13,
    padding: '9px 11px',
    border: '1px solid #e5e8eb',
    borderRadius: 8,
    width: '100%',
    boxSizing: 'border-box',
    color: '#191f28',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: '#4e5968',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,20,60,.25)', zIndex: 100 }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 460,
          maxWidth: 'calc(100vw - 32px)',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 16px 56px rgba(0,20,60,.22)',
          zIndex: 101,
          padding: '28px 28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em' }}>Braze 연동 설정</div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, border: 0, borderRadius: '50%', background: '#f2f4f6', color: '#4e5968', fontSize: 14, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: '#8b95a1', textAlign: 'center', padding: '12px 0' }}>불러오는 중...</div>
        ) : (
          <form onSubmit={(e) => void handleSave(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Dashboard Base URL</label>
              <input
                ref={firstRef}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://dashboard-01.braze.com"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>REST API URL</label>
              <input
                value={restApiUrl}
                onChange={(e) => setRestApiUrl(e.target.value)}
                placeholder="https://rest.iad-01.braze.com"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>
                API Key{hasCreds && <span style={{ fontWeight: 400, color: '#8b95a1', marginLeft: 6 }}>— 변경 시에만 입력</span>}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasCreds ? '••••••••••••••••' : 'REST API Key'}
                required={!hasCreds}
                autoComplete="new-password"
                style={inputStyle}
              />
            </div>

            {saveError && (
              <div style={{ fontSize: 12, color: '#f04452', padding: '8px 11px', borderRadius: 8, background: '#fff0f1' }}>
                {saveError}
              </div>
            )}
            {saveOk && (
              <div style={{ fontSize: 12, color: '#1a9a4a', padding: '8px 11px', borderRadius: 8, background: '#e9f7ef' }}>
                저장됐습니다
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '11px 0',
                  border: 0,
                  borderRadius: 10,
                  background: '#191f28',
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>

              {hasCreds && (
                <button
                  type="button"
                  onClick={() => void handleSync()}
                  disabled={isSyncing}
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 700,
                    padding: '11px 0',
                    border: 0,
                    borderRadius: 10,
                    background: isSyncing ? '#e5e8eb' : '#3182f6',
                    color: isSyncing ? '#8b95a1' : '#fff',
                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSyncing ? '싱크 중...' : 'Braze 싱크'}
                </button>
              )}
            </div>

            {syncError && (
              <div style={{ fontSize: 12, color: '#f04452', padding: '8px 11px', borderRadius: 8, background: '#fff0f1' }}>
                싱크 오류: {syncError}
              </div>
            )}
          </form>
        )}

        <div style={{ fontSize: 12, color: '#8b95a1', lineHeight: 1.6 }}>
          API Key는 Supabase Vault에 암호화 저장됩니다. 브라우저에 평문으로 보관되지 않습니다.
        </div>
      </div>
    </>
  )
}
