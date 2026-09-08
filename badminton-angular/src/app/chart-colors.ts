// Single source of truth for Chart.js color values. Chart.js configs are
// plain TypeScript and can't consume theme.less variables directly, so
// these hex values are kept in sync with theme.less by hand — if you
// change a color there that's also listed here, update both.
export const CHART_COLORS = {
  bgCard: '#eae9e9', // @bg-card
  border: 'rgba(32, 30, 29, 0.25)', // @border-base
  textNeutral: '#605d5d', // @text-muted
  legendText: '#201e1d', // @ink / @text-main
  accent: '#201e1d', // @ink — positive balances, attendance, paid amounts (mono system: ink carries emphasis, not a second color)
  accentFill: 'rgba(32, 30, 29, 0.12)', // @ink at 12% — area-chart fill
  danger: '#ae1800', // @danger (@accent-active) — negative/owed balances, the one place red runs in charts
  info: '#9b9797', // @chart-info — less-emphasized series (attendance rate, session payments)
  warning: '#ae1800', // @chart-warning — owed share, dues paid (same deep red as danger; mono system has no amber)
  mutedSlice: '#d7d3d3' // @chart-muted-slice — doughnut "missed" slice
} as const;
