export const theme = {
  bg: '#0a0a0c',
  bgElev: '#13131a',
  border: '#1f1f29',
  borderSoft: '#16161e',
  ink: '#f3f3f5',
  muted: '#7a7a86',
  fadeMuted: '#4a4a55',
  accent: '#ff3b3b',
  accentSoft: '#ff6363',
  green: '#3df57f',
  yellow: '#ffd23b',
  blue: '#6ea0ff',
  hyde: '#ff8a3b',
  hydeBg: '#241511',
  jekyll: '#7be4ff',
  jekyllBg: '#0d1f29',
  speakerColors: ['#ff8a3b', '#6ea0ff', '#3df57f', '#ffd23b', '#ff4ec3', '#9d6eff'],
};

export function modeColor(mode: 'jekyll' | 'hyde') {
  return mode === 'jekyll'
    ? { fg: theme.jekyll, bg: theme.jekyllBg }
    : { fg: theme.hyde, bg: theme.hydeBg };
}

export function colorForPerson(index: number): string {
  return theme.speakerColors[index % theme.speakerColors.length];
}
