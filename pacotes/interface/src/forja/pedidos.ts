// Pedidos prontos para a Forja sobre um arquivo (cartão do prédio na Cidade). Só escrevem no campo da Forja: quem
// envia é a pessoa. A extensão do VS Code usa os mesmos textos (pacotes/extensao-vscode/cliente.js).
export interface PedidoArquivo { id: string; rotulo: string; texto: (arquivo: string) => string }

export const PEDIDO_PRINCIPAL: PedidoArquivo = { id: 'melhorias', rotulo: 'Pedir à Forja', texto: (f) => `Analise o arquivo ${f} e sugira melhorias.` };

export const PEDIDOS_RAPIDOS: PedidoArquivo[] = [
  { id: 'explicar', rotulo: 'Explicar', texto: (f) => `Explique o arquivo ${f}: o que ele faz e como se liga ao resto do projeto.` },
  { id: 'simplificar', rotulo: 'Simplificar', texto: (f) => `Simplifique o arquivo ${f} sem mudar o que ele faz, e rode os testes.` },
  { id: 'bugs', rotulo: 'Achar bugs', texto: (f) => `Procure bugs no arquivo ${f} e corrija os que encontrar, explicando cada um.` },
  { id: 'testes', rotulo: 'Adicionar testes', texto: (f) => `Crie testes para o arquivo ${f} e rode.` },
];

// só para os faróis (os arquivos que mais mudam): costuma ser sinal de arquivo fazendo coisa demais
export const PEDIDO_DIVIDIR: PedidoArquivo = {
  id: 'dividir', rotulo: 'Dividir em partes menores',
  texto: (f) => `O arquivo ${f} é um dos que mais mudam no projeto. Proponha como dividir em partes menores, faça a divisão sem mudar o que ele faz e rode os testes.`,
};

export const pedidosDoArquivo = (farol: boolean) => (farol ? [...PEDIDOS_RAPIDOS, PEDIDO_DIVIDIR] : PEDIDOS_RAPIDOS);
