// O que a lista e a cidade 3D da Cidade do código usam igual: bairro de um arquivo e a escala de cor.
export const bairroDe = (caminho: string) => (caminho.includes('/') ? caminho.slice(0, caminho.lastIndexOf('/')) : '');
export const nomeDe = (caminho: string) => caminho.slice(caminho.lastIndexOf('/') + 1);

// 0 = nunca mudou, 1 = o arquivo mais alterado. Escala logarítmica: num projeto com um arquivo que mudou 60 vezes,
// os que mudaram 5 ou 10 vezes ainda aparecem mornos, em vez de tudo ficar frio.
// Faróis: os 8 arquivos que mais mudaram no git (pelo menos 3 vezes). A cidade 3D marca com um feixe de luz e o cartão
// do prédio sugere dividir o arquivo.
export function faroisDe(arquivos: { caminho: string; mudancas: number }[]): Set<string> {
  return new Set(arquivos.filter((a) => a.mudancas >= 3).sort((a, b) => b.mudancas - a.mudancas).slice(0, 8).map((a) => a.caminho));
}

export const calorDe = (mudancas: number, maximo: number) => (mudancas <= 0 ? 0 : Math.min(1, Math.log1p(mudancas) / Math.log1p(Math.max(1, maximo))));
