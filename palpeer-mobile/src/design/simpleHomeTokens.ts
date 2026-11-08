/** Palpeer Simple Home visual tokens — shared by design screens and restyled feature UIs. */
export const SIMPLE_HOME = {
  ink: '#0E1F19',
  muted: '#5B6B64',
  secondary: '#33453D',
  body: '#46574F',
  danger: '#B3231A',
  green: '#0B6E4F',
  greenDisabled: '#8C9A94',
  field: '#E9EEEB',
  page: '#F3F6F4',
  white: '#FFFFFF',
  soft: '#DFF3E8',
  border: '#DDE5E0',
  inputBorder: '#C9D3CE',
  font: "'Noto Sans', system-ui, sans-serif",
} as const;

export type SimpleHomeTokens = typeof SIMPLE_HOME;
