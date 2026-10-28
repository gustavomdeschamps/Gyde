// Tipos das bibliotecas que vêm sem declaração (só o que o Gyde usa delas).
declare module '@highlightjs/cdn-assets/es/highlight.min.js' {
  interface Resultado { value: string; language?: string }
  const hljs: {
    highlight(codigo: string, opcoes: { language: string; ignoreIllegals?: boolean }): Resultado;
    highlightAuto(codigo: string): Resultado;
    highlightElement(el: HTMLElement): void;
    getLanguage(nome: string): unknown;
  };
  export default hljs;
}
