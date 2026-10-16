import { describe, expect, it } from 'vitest'
import { countIamClicks } from './iam-clicks.ts'

describe('In-App Message click counting', () => {
  it('always counts body clicks and button 1 by default', () => {
    expect(countIamClicks({ body_clicks: 3, first_button_clicks: 2, second_button_clicks: 4 }, 'first')).toBe(5)
  })

  it('includes button 2 when configured', () => {
    expect(countIamClicks({ body_clicks: 3, first_button_clicks: 2, second_button_clicks: 4 }, 'both')).toBe(9)
  })
})
