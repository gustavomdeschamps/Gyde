// Utilidades de tela compartilhadas: aviso rápido (toast) e copiar texto.
const ICONE_OK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

let tempoToast: ReturnType<typeof setTimeout> | undefined;
export function toast(texto: string) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = texto; el.hidden = false;
  clearTimeout(tempoToast);
  tempoToast = setTimeout(() => { el.hidden = true; }, 2200);
}

// copia e mostra "Copiado" no próprio botão (ou um aviso, se não houver botão)
export async function copiarTexto(texto: string, botao?: HTMLElement | null) {
  try {
    await navigator.clipboard.writeText(texto);
    if (botao) {
      const antes = botao.innerHTML;
      botao.innerHTML = botao.dataset.label ? `${ICONE_OK}Copiado` : ICONE_OK;
      setTimeout(() => { botao.innerHTML = antes; }, 1500);
    } else toast('Copiado');
  } catch { toast('Não consegui copiar'); }
}

const ENTIDADES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escaparHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ENTIDADES[c] ?? c);
