// Ícones (do conjunto do Gyde, em texto SVG) e verbos das ações da Forja.
import { icone as svgIcone } from '../icones.ts';

export const ic: Record<string, string> = {
  pasta: svgIcone('folder'),
  listar: svgIcone('list'),
  ler: svgIcone('file-text'),
  buscar: svgIcone('search'),
  escrever: svgIcone('plus'),
  editar: svgIcone('pencil'),
  executar: svgIcone('terminal'),
  lixo: svgIcone('trash'),
  forja: svgIcone('anvil'),
  seta: svgIcone('chevron-right'),
  clipe: svgIcone('paperclip'),
  arquivos: svgIcone('folder-open'),
  escudo: svgIcone('shield-alert'),
  desfazer: svgIcone('undo-2'),
  baixo: svgIcone('chevron-down'),
  aovivo: svgIcone('monitor-play'),
  recarregar: svgIcone('rotate-cw'),
  fechar: svgIcone('x'),
  enviar: svgIcone('arrow-up', undefined, 'i-send') + svgIcone('square', undefined, 'i-stop'),
};
export const verbo: Record<string, string> = { listar: 'Explorando', ler: 'Lendo', buscar: 'Procurando', escrever: 'Escrevendo', editar: 'Editando', apagar: 'Apagando', executar: 'Executando' };
