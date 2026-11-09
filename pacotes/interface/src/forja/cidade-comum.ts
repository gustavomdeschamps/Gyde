// O que a lista e a cidade 3D da Cidade do código usam igual: bairro de um arquivo e a escala de cor.
export const bairroDe = (caminho: string) => (caminho.includes('/') ? caminho.slice(0, caminho.lastIndexOf('/')) : '');
export const nomeDe = (caminho: string) => caminho.slice(caminho.lastIndexOf('/') + 1);

// 0 = nunca mudou, 1 = o arquivo mais alterado (proporcional: só os muito alterados ficam bem vermelhos)
export const calorDe = (mudancas: number, maximo: number) => (mudancas <= 0 ? 0 : Math.min(1, mudancas / Math.max(1, maximo)));
export const CORES_CALOR = { frio: '#94a3b8', frioEscuro: '#55637a', quente: '#dc2626' };
