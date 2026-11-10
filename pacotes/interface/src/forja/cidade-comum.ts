// O que a lista e a cidade 3D da Cidade do código usam igual: bairro de um arquivo e a escala de cor.
export const bairroDe = (caminho: string) => (caminho.includes('/') ? caminho.slice(0, caminho.lastIndexOf('/')) : '');
export const nomeDe = (caminho: string) => caminho.slice(caminho.lastIndexOf('/') + 1);

// 0 = nunca mudou, 1 = o arquivo mais alterado. Escala logarítmica: num projeto com um arquivo que mudou 60 vezes,
// os que mudaram 5 ou 10 vezes ainda aparecem mornos, em vez de tudo ficar frio.
export const calorDe = (mudancas: number, maximo: number) => (mudancas <= 0 ? 0 : Math.min(1, Math.log1p(mudancas) / Math.log1p(Math.max(1, maximo))));
