// Mapa de habilidades: tudo o que a Prática tem para cada tecnologia (exercícios das trilhas, exercícios guiados e
// etapas dos projetos), por nível, com o estado real de cada item para a pessoa: dominado (feito), praticando
// (tentou e ainda não acertou) ou novo. Não usa IA nem estima nada: só o progresso salvo.
import { TRACKS } from './pratica-dados.ts';
import { GUIADOS, TECNOLOGIAS } from './pratica-plano.ts';
import type { NivelPlano, Progresso } from './pratica-plano.ts';
import { PROJETOS, chaveEtapa } from './projetos-dados.ts';

export type EstadoNo = 'dominado' | 'praticando' | 'novo';
export interface No { id: string; titulo: string; tipo: 'exercicio' | 'guiado' | 'etapa'; nivel: NivelPlano; estado: EstadoNo; link: string; grupo: string }
export interface MapaTecnologia { tecnologia: string; nos: No[]; dominados: number; total: number }

// trilhas com testes: tecnologia e nível de cada uma
const TRILHAS: Record<string, { tecnologia: string; nivel: NivelPlano }> = {
  'python-basico': { tecnologia: 'Python', nivel: 'basico' },
  'proj-adivinhacao': { tecnologia: 'Python', nivel: 'intermediario' },
  'js-zero': { tecnologia: 'JavaScript', nivel: 'basico' },
  'proj-tarefas': { tecnologia: 'JavaScript', nivel: 'intermediario' },
  logica: { tecnologia: 'Lógica', nivel: 'intermediario' },
};
const NIVEIS: NivelPlano[] = ['basico', 'intermediario', 'avancado'];

export function mapaDe(progress: Progresso = {}): MapaTecnologia[] {
  const estado = (id: string): EstadoNo => (progress[id]?.done ? 'dominado' : progress[id] ? 'praticando' : 'novo');
  return TECNOLOGIAS.map((tecnologia) => {
    const nos: No[] = [];
    for (const t of TRACKS) {
      const info = TRILHAS[t.id];
      if (info?.tecnologia !== tecnologia) continue;
      for (const ex of t.exercises) nos.push({ id: ex.id, titulo: ex.title.replace(/^\d+\.\s*/, ''), tipo: 'exercicio', nivel: info.nivel, estado: estado(ex.id), link: `#/pratica/${t.id}/${ex.id}`, grupo: t.title });
    }
    for (const g of GUIADOS.filter((x) => x.tecnologia === tecnologia)) {
      nos.push({ id: g.id, titulo: g.titulo, tipo: 'guiado', nivel: g.nivel, estado: estado(g.id), link: '#/pratica', grupo: g.topico });
    }
    for (const p of PROJETOS.filter((x) => x.tecnologia === tecnologia)) {
      for (const e of p.etapas) {
        const id = chaveEtapa(p.id, e.id);
        nos.push({ id, titulo: e.titulo, tipo: 'etapa', nivel: p.nivel, estado: estado(id), link: `#/pratica/projeto/${p.id}`, grupo: p.nome });
      }
    }
    nos.sort((a, b) => NIVEIS.indexOf(a.nivel) - NIVEIS.indexOf(b.nivel));
    return { tecnologia, nos, dominados: nos.filter((n) => n.estado === 'dominado').length, total: nos.length };
  });
}
