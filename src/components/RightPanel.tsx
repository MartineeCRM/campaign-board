import { useBoardStore } from '../store'
import BoardStructurePanel from './BoardStructurePanel'
import DetailPanel from './DetailPanel'

export const PANEL_WIDTH = 320

export default function RightPanel() {
  const edit = useBoardStore((s) => s.edit)
  const sel = useBoardStore((s) => s.sel)
  const selectCampaign = useBoardStore((s) => s.selectCampaign)

  // View mode: only show when a campaign is selected
  // Edit mode: always show (board structure, or campaign detail when selected)
  const visible = edit || !!sel

  if (!visible) return null

  return (
    <>
      {/* 배경 딤: 보기 모드에서 캠페인 선택했을 때만 */}
      {!edit && sel && (
        <div
          onClick={() => selectCampaign(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,20,60,.2)', zIndex: 50 }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: PANEL_WIDTH,
          background: '#fff',
          borderLeft: '1px solid #e5e8eb',
          zIndex: 51,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 캠페인 선택됐을 때: 편집/보기 모두 DetailPanel */}
        {sel ? (
          <DetailPanel />
        ) : (
          /* 편집 모드 + 선택 없음: 보드 구조 패널 */
          <BoardStructurePanel />
        )}
      </div>
    </>
  )
}
