import { describe, expect, it } from 'vitest'
import { mapCampaignPayload, mapCanvasPayload, inspectCanvasPayload, mapCanvasSteps } from './braze-metrics'

describe('Braze metric payload mapping', () => {
  it('maps documented campaign message channels without dropping their distinct fields', () => {
    expect(mapCampaignPayload({
      conversions: 5,
      messages: {
        android_push: [{ sent: 100, direct_opens: 20, total_opens: 32, body_clicks: 4 }],
        email: [{ sent: 40, opens: 10, unique_opens: 8, clicks: 3, unique_clicks: 2 }],
        whats_app: [{ sent: 20, read: 9 }],
        trigger_in_app_message: [{ impressions: 15, clicks: 6, first_button_clicks: 3, second_button_clicks: 2 }],
        content_cards: [{ total_impressions: 30, total_clicks: 7 }],
        sms: [{ sent: 10, clicks: 1 }],
      },
    }, 'first')).toEqual({ sent: 215, opens: 37, clicks: 17, convs: 5, conversionCounts: [5] })
  })

  it('uses direct push opens instead of total opens and preserves every configured conversion count', () => {
    expect(mapCampaignPayload({
      conversions: 5,
      conversions1: 3,
      conversions2: 2,
      messages: { android_push: [{ sent: 100, direct_opens: 20, total_opens: 32, opens: 28 }] },
    }, 'first')).toEqual({ sent: 100, opens: 20, clicks: 0, convs: 5, conversionCounts: [5, 3, 2] })
  })

  it('maps Canvas step-level push metrics from documented and alternate open fields', () => {
    const point = {
      total_stats: { entries: 100, conversions: 8 },
      step_stats: {
        pushStep: { conversions: 3, messages: { android_push: [{ sent: 60, opens: 21, body_clicks: 4 }] } },
        emailStep: { conversions: 2, messages: { email: [{ sent: 40, unique_opens: 8, clicks: 2 }] } },
      },
    }
    expect(mapCanvasPayload(point, 'first')).toEqual({ sent: 100, opens: 29, clicks: 6, convs: 5, conversionCounts: [5] })
    expect(inspectCanvasPayload([point])).toMatchObject({ points: 1, pointsWithSteps: 1, stepCount: 2, messageRows: 2 })
  })

  it('uses Canvas opens as direct opens and retains additional conversion counts', () => {
    expect(mapCanvasPayload({
      total_stats: { entries: 100, conversions: 8, conversions1: 4, conversions2: 1 },
      step_stats: { pushStep: { conversions: 5, conversions1: 2, conversions2: 1, messages: { android_push: [{ sent: 60, opens: 21, influenced_opens: 40 }] } } },
    }, 'first')).toEqual({ sent: 60, opens: 21, clicks: 0, convs: 5, conversionCounts: [5, 2, 1] })
  })

  it('summarizes only message steps in detail order with separate push and IAM results', () => {
    const details = { steps: [
      { id: 'push', name: '첫 푸시', type: 'message', messages: {
        android: { channel: 'android_push', image_url: 'https://images.example/push.png' },
        ios: { channel: 'ios_push', image_url: 'https://images.example/push-2.png', large_image_url: '' },
      } },
      { id: 'wait', name: '대기', type: 'delay' },
      { id: 'iam', name: '인앱', type: 'message', messages: {
        first: { channel: 'in_app_message', image_url: 'https://images.example/iam.png' },
      } },
    ] }
    const points = [{ step_stats: {
      push: { conversions: 2, conversions1: 1, messages: {
        android_push: [{ sent: 30, opens: 6, influenced_opens: 10, body_clicks: 6 }],
        ios_push: [{ sent: 20, opens: 4, influenced_opens: 8, body_clicks: 4 }],
      } },
      iam: { conversions: 3, conversions1: 2, messages: {
        in_app_message: [{ impressions: 12, first_button_clicks: 2, second_button_clicks: 1 }],
      } },
    } }]
    expect(mapCanvasSteps(details, points, 'first')).toEqual([
      { id: 'push', name: '첫 푸시', channel: 'Push', sent: 50, opens: 10, clicks: 10, engagements: 10, conversionCounts: [2, 1] },
      { id: 'iam', name: '인앱', channel: 'In-app', sent: 12, opens: 0, clicks: 2, engagements: 2, conversionCounts: [3, 2] },
    ])
    expect(mapCanvasPayload({ total_stats: { entries: 100, conversions: 9 }, step_stats: points[0].step_stats }, 'first'))
      .toMatchObject({ sent: 62, convs: 5, conversionCounts: [5, 3] })
  })

  it('applies the configured first or both button clicks for Canvas IAM steps', () => {
    const point = {
      total_stats: { entries: 10, conversions: 0 },
      step_stats: { iam: { messages: { in_app_message: [{ impressions: 12, body_clicks: 1, first_button_clicks: 2, second_button_clicks: 3 }] } } },
    }
    expect(mapCanvasPayload(point, 'first')).toEqual({ sent: 12, opens: 0, clicks: 3, convs: 0, conversionCounts: [0] })
    expect(mapCanvasPayload(point, 'both')).toEqual({ sent: 12, opens: 0, clicks: 6, convs: 0, conversionCounts: [0] })
  })

  it('does not present Canvas entries as message sends when step metrics are absent', () => {
    expect(mapCanvasPayload({ total_stats: { entries: 100, conversions: 4 } }, 'first'))
      .toEqual({ sent: 0, opens: 0, clicks: 0, convs: 0, conversionCounts: [0] })
  })

  it('counts conversions attributed to a message step even on a day without sends', () => {
    expect(mapCanvasPayload({ total_stats: { conversions: 7 }, step_stats: {
      message: { conversions: 2, messages: { android_push: [] } },
      delay: { conversions: 5 },
    } }, 'first').conversionCounts).toEqual([2])
    expect(mapCanvasPayload({ step_stats: {
      message: { conversions: 2, messages: {} },
      delay: { conversions: 5 },
    } }, 'first').conversionCounts).toEqual([2])
  })
})
