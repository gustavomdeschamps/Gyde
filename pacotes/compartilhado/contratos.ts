// Contratos da API do Gyde: o formato oficial de cada resposta, escrito uma vez e usado pelo servidor (que confere o
// que envia), pelos testes e pela interface (que confere o que recebe). Os tipos do TypeScript saem daqui (z.infer).
// Só Zod, sem nada de servidor: este arquivo também roda no navegador.
import { z } from 'zod';

export const Erro = z.object({ error: z.string() }).passthrough();

// ---------- Status e preferências ----------
export const Status = z.object({
  keyConfigured: z.boolean(),
  routerOnline: z.boolean(),
  iaAtiva: z.enum(['online', 'offline']),
  offlineDisponivel: z.boolean(),
  imagesEnabled: z.boolean(),
  desatualizado: z.boolean(),
  pessoal: z.boolean(), // modo pessoal (no PC de alguém) ou público (servidor de uma turma)
});

export const PAGINAS_INICIAIS = ['chat', 'pratica', 'agente'] as const;
export const Preferencias = z.object({
  about_user: z.string(),
  response_style: z.string(),
  pagina_inicial: z.enum(PAGINAS_INICIAIS),
});

// ---------- Chat ----------
export const AnexoMensagem = z.object({ kind: z.enum(['image', 'file']), name: z.string(), dataUrl: z.string().optional(), text: z.string().optional() });
export const ResumoConversa = z.object({ id: z.string(), title: z.string(), model: z.string(), pinned: z.number().int(), updated_at: z.number() });
export const ListaConversas = z.object({ conversations: z.array(ResumoConversa) });
export const Mensagem = z.object({
  id: z.string(), conversation_id: z.string().optional(), role: z.enum(['user', 'assistant']), content: z.string(),
  attachments: z.array(AnexoMensagem), model: z.string().nullable().optional(), created_at: z.number(),
});
export const Conversa = ResumoConversa.extend({ user_id: z.string().nullable().optional(), created_at: z.number(), messages: z.array(Mensagem).optional() });
const OpcaoModelo = z.object({ id: z.string(), label: z.string(), hint: z.string() });
export const Modelos = z.object({ brand: z.array(OpcaoModelo), models: z.array(OpcaoModelo) });

// ---------- Memória e tokens das extensões ----------
export const Memoria = z.object({
  ativa: z.boolean(),
  itens: z.array(z.object({ id: z.string(), text: z.string(), source: z.enum(['auto', 'manual', 'pedido']), created_at: z.number() })),
});
export const Tokens = z.object({ tokens: z.array(z.object({ id: z.string(), name: z.string(), created_at: z.number(), last_used: z.number().nullable() })) });
export const TokenNovo = Tokens.extend({ token: z.string().regex(/^gyde_[0-9a-f]{48}$/) });

// ---------- Prática ----------
export const NivelPlano = z.enum(['basico', 'intermediario', 'avancado']);
export const Guiado = z.object({ id: z.string(), tecnologia: z.string(), nivel: NivelPlano, topico: z.string(), titulo: z.string(), enunciado: z.string() });
export const Passo = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('trilha'), trackId: z.string(), exerciseId: z.string(), titulo: z.string(), tecnologia: z.string().optional() }),
  z.object({ tipo: z.literal('guiado'), id: z.string(), titulo: z.string(), tecnologia: z.string() }),
  z.object({ tipo: z.literal('chat'), titulo: z.string() }),
]);
export const Foco = z.object({ tecnologia: z.string(), tipo: z.enum(['trilha', 'adaptado', 'guiado']), trilhas: z.array(z.string()), guiados: z.number().int() });

// Toda resposta tem um próximo passo, ou então o plano foi concluído e há um novo desafio.
export const Plano = z.object({
  versao: z.literal(2),
  tipo: z.enum(['trilha', 'adaptada', 'montada', 'inicial']),
  explicacao: z.string(),
  nivel: z.string(),
  tecnologias: z.array(z.string()).min(1),
  tecnologiasDeduzidas: z.boolean(),
  temQuiz: z.boolean(),
  declarado: z.object({
    experiencia: z.string().nullable(), linguagens: z.array(z.string()), objetivo: z.string().nullable(),
    estilo: z.string().nullable(), em: z.number().nullable(),
  }).nullable(),
  medido: z.object({
    nivel: z.string().nullable(), acertos: z.number().nullable(), total: z.number().nullable(), reforcar: z.array(z.string()),
    anteriores: z.array(z.object({ em: z.number().optional(), nivel: z.string().optional(), acertos: z.number().optional(), total: z.number().optional() })),
  }).nullable(),
  observado: z.object({ feitos: z.number().int(), tentativasComErro: z.number().int(), travados: z.array(z.string()) }),
  focos: z.array(Foco),
  ordem: z.array(z.string()),
  motivos: z.record(z.string(), z.array(z.string())),
  recomendada: z.string().nullable(),
  guiados: z.array(Guiado.extend({ feito: z.boolean() })),
  proximo: Passo.nullable(),
  concluido: z.boolean(),
  novoDesafio: Passo.nullable(),
  semTrilha: z.array(z.string()),
}).refine((p) => p.proximo !== null || (p.concluido && p.novoDesafio !== null), { message: 'plano sem próximo passo e sem novo desafio' });

export const Exercicio = z.object({
  id: z.string(), title: z.string(), xp: z.number(), fn: z.string(), statement: z.string(), starter: z.string(),
  tests: z.array(z.object({ args: z.array(z.unknown()), expected: z.unknown() })),
});
export const Trilha = z.object({
  id: z.string(), title: z.string(), lang: z.enum(['python', 'javascript']), color: z.string(), icon: z.string(),
  description: z.string(), projeto: z.boolean().optional(), exercises: z.array(Exercicio),
});
const Pessoa = z.object({ name: z.string(), email: z.string() });
export const EstadoPratica = z.object({
  tracks: z.array(Trilha),
  progress: z.record(z.string(), z.object({ done: z.boolean(), code: z.string().optional(), fails: z.number().optional() })),
  xp: z.number(),
  sequencia: z.object({ dias: z.number().int(), praticouHoje: z.boolean() }),
  desafio: z.object({ exerciseId: z.string(), trackId: z.string().optional(), bonus: z.number(), rewarded: z.boolean() }),
  revisoes: z.array(z.object({ exerciseId: z.string(), level: z.number().int(), dueAt: z.number(), due: z.boolean() })),
  reforco: z.array(z.string()),
  ranking: z.array(z.object({ name: z.string(), voce: z.boolean(), xpSemana: z.number(), sequencia: z.number().int() })),
  pedidos: z.array(Pessoa),
  aguardando: z.array(Pessoa),
  plano: Plano,
});
export const EstadoPraticaComGanhos = EstadoPratica.extend({ ganhos: z.array(z.object({ motivo: z.string(), xp: z.number() })) });

// ---------- Forja ----------
export const EstadoPasta = z.object({ ok: z.boolean(), motivo: z.string().nullable(), texto: z.string().nullable(), temporario: z.boolean().optional() })
  .refine((e) => e.ok || Boolean(e.texto), { message: 'pasta indisponível sem explicação' });
export const Projeto = z.object({ tecnologias: z.array(z.string()), testes: z.string().nullable(), arquivos: z.number().int(), git: z.boolean() });
export const TIPOS_EVENTO = ['tarefa', 'pensando', 'ferramenta', 'resultado', 'confirmar', 'confirmacao', 'resposta', 'erro', 'desfeito', 'reconectado'] as const;
export const EventoForja = z.object({ tipo: z.enum(TIPOS_EVENTO), em: z.number() }).passthrough();
export const ListaSessoes = z.object({
  sessoes: z.array(z.object({ id: z.string(), pasta: z.string(), titulo: z.string(), updated_at: z.number(), disponivel: z.boolean() })),
  pessoal: z.boolean(),
});
export const SessaoForja = z.object({
  id: z.string(), user_id: z.string(), pasta: z.string(), titulo: z.string(), created_at: z.number(), updated_at: z.number(),
  existe: z.boolean(), pastaEstado: EstadoPasta, projeto: Projeto.nullable(), podeDesfazer: z.boolean(), trabalhando: z.boolean(),
  eventos: z.array(EventoForja),
}).refine((s) => s.existe === s.pastaEstado.ok, { message: '"existe" e "pastaEstado.ok" discordam' });
export const Reconexao = z.object({ ok: z.literal(true), pasta: z.string(), pastaEstado: EstadoPasta });

// ---------- Questionário de boas-vindas ----------
export const Pergunta = z.object({
  id: z.string(), kind: z.enum(['profile', 'knowledge']), title: z.string(), options: z.array(z.string()).min(2), multi: z.boolean().optional(),
  topic: z.string().optional(), code: z.record(z.string(), z.string()).optional(),
}).refine((q) => q.kind !== 'knowledge' || Boolean(q.code?.python), 'pergunta de código sem a versão em Python');
export const Questionario = z.object({ questions: z.array(Pergunta).min(1) });
export const ResultadoQuestionario = z.object({
  profile: z.object({ levelLabel: z.string(), score: z.number().int(), total: z.number().int(), languages: z.array(z.string()) }).passthrough(),
  results: z.array(z.object({ id: z.string(), topic: z.string().optional(), correct: z.boolean(), answer: z.string().optional() }).passthrough()),
});

// ---------- Skills ----------
const SkillBase = z.object({
  nome: z.string(), descricao: z.string(), simbolo: z.string(), comando: z.string(), gatilhos: z.array(z.string()), categoria: z.string(), corpo: z.string(),
});
export const Skill = SkillBase.extend({
  id: z.string(), origem: z.enum(['catalogo', 'minha']), instalada: z.boolean(),
  publicada: z.string().nullable().optional(), // id na loja, se a pessoa publicou esta skill
  loja: z.string().nullable().optional(), // id na loja de onde esta cópia veio
});
export const ListaSkills = z.object({ skills: z.array(Skill) });
export const SkillSalva = ListaSkills.extend({ id: z.string() });
export const SkillPublicada = SkillSalva.extend({ atualizada: z.boolean() });
export const SkillDaLoja = SkillSalva.extend({ semComando: z.boolean() });
export const ItemLoja = SkillBase.extend({
  id: z.string(), autor: z.string(), installs: z.number().int(), atualizada: z.number(), minha: z.boolean(), instalada: z.boolean(),
});
export const Loja = z.object({ loja: z.array(ItemLoja) });

// ---------- Turmas ----------
export const ListaTurmas = z.object({
  ensino: z.array(z.object({ id: z.string(), name: z.string(), code: z.string(), alunos: z.number().int(), tarefas: z.number().int() })),
  participo: z.array(z.object({ id: z.string(), name: z.string(), professor: z.string(), tarefas: z.number().int(), feitas: z.number().int() })),
});
// tarefa aponta para um exercício da Prática; se ele sair do catálogo, a trilha fica vazia e o título vira o id
export const TarefaTurma = z.object({
  id: z.string(), exerciseId: z.string(), trackId: z.string().optional(), title: z.string(), track: z.string().optional(),
  lang: z.string().optional(), prazo: z.string().nullable(),
});
export const TurmaProfessor = z.object({
  id: z.string(), name: z.string(), code: z.string(), professor: z.literal(true), tarefas: z.array(TarefaTurma),
  alunos: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), xp: z.number(), ultimoDia: z.string().nullable(), feitas: z.array(z.boolean()) })),
}).refine((t) => t.alunos.every((a) => a.feitas.length === t.tarefas.length), 'cada aluno tem uma marca por tarefa');
export const TurmaAluno = z.object({
  id: z.string(), name: z.string(), professor: z.literal(false), professorNome: z.string().optional(),
  tarefas: z.array(TarefaTurma.extend({ feita: z.boolean() })),
});
export const Turma = z.union([TurmaProfessor, TurmaAluno]);
export const IdCriado = z.object({ id: z.string() });

// ---------- Relatório de erro ----------
export const Diagnostico = z.object({
  gyde: z.string(), node: z.string(), sistema: z.string(), modo: z.enum(['pessoal', 'publico']), desktop: z.boolean(), esquemaBanco: z.number().int(),
  ia: z.object({ modo: z.string(), ativo: z.string(), online: z.boolean(), offline: z.boolean(), chave: z.boolean() }),
  erros: z.array(z.object({ em: z.string(), onde: z.string(), mensagem: z.string(), pilha: z.string() })),
});

// ---------- Cópia de segurança ----------
export const RestauracaoPreparada = z.object({ versao: z.number().int(), contas: z.number().int(), conversas: z.number().int(), reiniciar: z.literal(true) });

// ---------- Uso e limites ----------
const Totais = z.object({
  pedidos: z.number().int(), concluidos: z.number().int(), falhas: z.number().int(), cancelados: z.number().int(), limite: z.number().int(),
  chamadas: z.number().int(), chamadasFalhas: z.number().int(), tokensEntrada: z.number().int(), tokensSaida: z.number().int(), semTokens: z.number().int(),
});
export const Uso = z.object({
  modo: z.enum(['online', 'offline', 'auto']),
  ativo: z.enum(['online', 'offline']),
  online: z.object({ disponivel: z.boolean(), url: z.string() }),
  offline: z.object({ disponivel: z.boolean(), modelo: z.string(), instalados: z.array(z.string()) }),
  gratis: z.literal(true),
  limiteRoteador: z.object({ total: z.number(), restante: z.number(), renovaEm: z.string().nullable() }).nullable(),
  mes: z.object({
    mes: z.string(), renovaEm: z.string(), pedidos: z.number(), tokens: z.number(),
    porChave: z.array(z.object({ provedor: z.string(), pedidos: z.number(), tokens: z.number(), limitePedidos: z.number().nullable(), limiteTokens: z.number().nullable() })),
  }).nullable(),
  gyde: z.object({
    hoje: z.record(z.string(), Totais),
    semana: z.record(z.string(), Totais),
    ultimos: z.array(z.object({
      origem: z.string(), provedor: z.string().nullable(), modelo: z.string().nullable(), resultado: z.enum(['ok', 'erro', 'cancelado', 'limite']),
      chamadas: z.number().int(), tokens_entrada: z.number().int().nullable(), tokens_saida: z.number().int().nullable(),
      erro: z.string().nullable(), inicio: z.number(), duracao_ms: z.number(),
    })),
    internasHoje: z.number().int().nullable(),
  }),
});

export type TStatus = z.infer<typeof Status>;
export type TRestauracaoPreparada = z.infer<typeof RestauracaoPreparada>;
export type TPreferencias = z.infer<typeof Preferencias>;
export type TPlano = z.infer<typeof Plano>;
export type TPasso = z.infer<typeof Passo>;
export type TEstadoPratica = z.infer<typeof EstadoPratica>;
export type TEstadoPasta = z.infer<typeof EstadoPasta>;
export type TProjeto = z.infer<typeof Projeto>;
export type TSessaoForja = z.infer<typeof SessaoForja>;
export type TUso = z.infer<typeof Uso>;
export type TMemoria = z.infer<typeof Memoria>;
export type TMensagem = z.infer<typeof Mensagem>;
export type TConversa = z.infer<typeof Conversa>;
export type TResumoConversa = z.infer<typeof ResumoConversa>;
export type TModelos = z.infer<typeof Modelos>;
export type TTokens = z.infer<typeof Tokens>;
export type TListaTurmas = z.infer<typeof ListaTurmas>;
export type TTurmaProfessor = z.infer<typeof TurmaProfessor>;
export type TTurmaAluno = z.infer<typeof TurmaAluno>;
export type TSkill = z.infer<typeof Skill>;
export type TItemLoja = z.infer<typeof ItemLoja>;
export type TPergunta = z.infer<typeof Pergunta>;
export type TResultadoQuestionario = z.infer<typeof ResultadoQuestionario>;
