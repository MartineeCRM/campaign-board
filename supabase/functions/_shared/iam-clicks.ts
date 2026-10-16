export function countIamClicks(
  stats: { body_clicks?: number; first_button_clicks?: number; second_button_clicks?: number },
  count: 'first' | 'both',
): number {
  return (stats.body_clicks ?? 0)
    + (stats.first_button_clicks ?? 0)
    + (count === 'both' ? stats.second_button_clicks ?? 0 : 0)
}
