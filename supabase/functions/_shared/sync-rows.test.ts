import { describe, expect, it } from 'vitest'
import { dailyMetricRow, describeSyncError } from './sync-rows'

describe('Braze sync persistence boundary', () => {
  it('sends daily conversion counts under the database column name', () => {
    expect(dailyMetricRow('campaign-id', '2026-10-15', {
      sent: 12, opens: 3, clicks: 2, convs: 1, conversionCounts: [1, 4],
    })).toEqual({
      campaign_id: 'campaign-id', date: '2026-10-15',
      sent: 12, opens: 3, clicks: 2, convs: 1, conversion_counts: [1, 4],
    })
  })

  it('shows a database error code and message instead of object Object', () => {
    expect(describeSyncError({ code: 'PGRST204', message: "Could not find the 'conversionCounts' column" }))
      .toBe("PGRST204: Could not find the 'conversionCounts' column")
  })
})
