// Ícones das trilhas e projetos da Prática (SVG, para não depender de letras ou emojis).
export const TRACK_ICONS: Record<string, string> = {
  python: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <path stroke="none" fill="#3776AB" d="M11.9 2C6.9 2 7.2 4.2 7.2 4.2v2.3H12v.7H5.3S2 6.8 2 11.9s2.9 4.9 2.9 4.9h1.7v-2.4s-.1-2.9 2.8-2.9h4.8s2.7 0 2.7-2.6V4.6S17.3 2 11.9 2z"/>
    <circle cx="9.3" cy="4.4" r=".95" fill="#fff" stroke="none"/>
    <path stroke="none" fill="#FFD43B" d="M12.1 22c5 0 4.7-2.2 4.7-2.2v-2.3H12v-.7h6.7s3.3.4 3.3-4.7-2.9-4.9-2.9-4.9h-1.7v2.4s.1 2.9-2.8 2.9H9.8s-2.7 0-2.7 2.6v4.3S6.7 22 12.1 22z"/>
    <circle cx="14.7" cy="19.6" r=".95" fill="#fff" stroke="none"/></svg>`,
  javascript: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="3" fill="#F7DF1E" stroke="none"/>
    <path fill="none" stroke="#1a1a1a" stroke-width="2.1" stroke-linecap="round" d="M11 10.5v6.2c0 1.7-.9 2.5-2.3 2.5-1 0-1.7-.4-2.1-1.1"/>
    <path fill="none" stroke="#1a1a1a" stroke-width="2.1" stroke-linecap="round" d="M19.2 11.6c-.4-.8-1.1-1.2-2.1-1.2-1.2 0-2 .7-2 1.6 0 2.4 4.5 1.4 4.5 4.3 0 1.2-1 2.1-2.5 2.1-1.2 0-2.2-.5-2.7-1.5"/></svg>`,
  logica: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <rect x="8" y="2.5" width="8" height="4.5" rx="1.4"/><path d="M12 7v2.3M12 9.3l4.2 3.2-4.2 3.2-4.2-3.2z"/>
    <path d="M7.8 12.5H5v3.8M16.2 12.5H19v3.8"/><rect x="2.5" y="16.3" width="5" height="4.5" rx="1.2"/><rect x="16.5" y="16.3" width="5" height="4.5" rx="1.2"/></svg>`,
  adivinhacao: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
    <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.2"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><path d="M15.5 8.5l5-5M17.3 3.5h3.2v3.2"/></svg>`,
  tarefas: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8.5l1.4 1.4L12 7.3M8 14.5l1.4 1.4 2.6-2.6M14.5 9h2.5M14.5 15h2.5"/></svg>`,
};
