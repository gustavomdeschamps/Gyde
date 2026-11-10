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

export const PAGINAS_INICIAIS = ['chat', 'agente'] as const;
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

// ---------- Chat: "Mostrar o erro" ----------
// "Mostrar o erro" num print: região em porcentagem da imagem (estimada pelo modelo) e explicação curta
export const Apontamento = z.object({
  achou: z.boolean(), explicacao: z.string().min(1), modelo: z.string(),
  regiao: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), largura: z.number().positive().max(100), altura: z.number().positive().max(100) }).nullable(),
}).refine((a) => a.achou === (a.regiao !== null), { message: 'apontamento: região só quando achou' });
export type TApontamento = z.infer<typeof Apontamento>;
// ---------- Forja ----------
// prévia ao vivo: url só quando o projeto tem um index.html; senão o motivo
// Ao vivo da Forja (pacotes/servidor/ao-vivo.ts): o plano (formas de ligar o projeto) e o estado do que está ligado
export const OpcaoAoVivo = z.object({
  id: z.string(), rotulo: z.string(), detalhe: z.string(), tipo: z.enum(['web', 'estatico', 'console']), pasta: z.string(),
  comando: z.string().nullable(), instalar: z.string().nullable(), ferramenta: z.string().nullable(), env: z.record(z.string(), z.string()).optional(),
});
export const PlanoAoVivo = z.object({ opcoes: z.array(OpcaoAoVivo), recomendada: z.string().nullable(), motivo: z.string().nullable() });
export const EstadoAoVivo = z.object({
  fase: z.enum(['parado', 'instalando', 'iniciando', 'pronto', 'rodando', 'terminou', 'falhou']), opcao: z.string().nullable(), comando: z.string().nullable(),
  url: z.string().nullable(), porta: z.number().int().nullable(), tipo: z.enum(['web', 'estatico', 'console']).nullable(), saida: z.array(z.string()),
  mensagem: z.string().nullable(), erroParaForja: z.string().nullable(), desde: z.number().nullable(),
  total: z.number().int().min(0), primeira: z.number().int().min(0),
}).refine((e) => e.fase !== 'pronto' || Boolean(e.url), { message: 'Ao vivo pronto sem endereço' });
export const AoVivo = z.object({ plano: PlanoAoVivo, estado: EstadoAoVivo });
export const EstadoPasta = z.object({ ok: z.boolean(), motivo: z.string().nullable(), texto: z.string().nullable(), temporario: z.boolean().optional() })
  .refine((e) => e.ok || Boolean(e.texto), { message: 'pasta indisponível sem explicação' });
export const Projeto = z.object({ tecnologias: z.array(z.string()), testes: z.string().nullable(), arquivos: z.number().int(), git: z.boolean() });
export const TIPOS_EVENTO = ['tarefa', 'pensando', 'ferramenta', 'resultado', 'confirmar', 'confirmacao', 'revisao', 'resposta', 'erro', 'desfeito', 'reconectado'] as const;
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
// Cidade do código (pacotes/servidor/cidade.ts): só nomes e números dos arquivos, nunca o conteúdo
export const Predio = z.object({ caminho: z.string(), linhas: z.number().int().min(0), bytes: z.number().int().min(0), binario: z.boolean(), mudancas: z.number().int().min(0), ultima: z.number().nullable() });
export const Cidade = z.object({
  pasta: z.string(), arquivos: z.array(Predio), total: z.number().int(), cortados: z.number().int(), incompleta: z.boolean(),
  git: z.object({ ativo: z.boolean(), commits: z.number().int() }), limite: z.number().int(),
});
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
// ---------- Inteligência multimodelo ----------
export const PreferenciasIA = z.object({ modo: z.enum(['rapido', 'equilibrado', 'capricho']), especialistas: z.boolean(), desligados: z.array(z.string()) });
export const Conexoes = z.object({
  avisoIdade: z.string(),
  provedores: z.array(z.object({
    id: z.string(), nome: z.string(), artigo: z.string(), de: z.string(), papel: z.enum(['inicial', 'opcional']), descricao: z.string(), avisos: z.array(z.string()),
    linkChave: z.string(), prefixo: z.string(), conectado: z.boolean(),
  })),
  freellmapi: z.boolean(),
});
export const ResultadoTesteChave = z.object({ ok: z.boolean(), mensagem: z.string(), conexoes: Conexoes });
export const ModelosIA = z.object({
  medidoEm: z.string().nullable(), aviso: z.string().nullable(),
  modelos: z.array(z.object({
    id: z.string(), contexto: z.number().nullable(), visao: z.boolean().nullable(), ferramentas: z.boolean().nullable(), via: z.array(z.string()),
    acertos: z.number(), respondidas: z.number(), limites: z.number(),
    categorias: z.record(z.string(), z.object({ acertos: z.number(), respondidas: z.number() })),
    observado: z.object({ chamadas: z.number(), falhas: z.number(), limites: z.number(), taxaOk: z.number(), ms: z.number().nullable() }).nullable(),
    descansando: z.boolean(),
  })),
  estrategias: z.array(z.object({ estrategia: z.string(), pedidos: z.number(), chamadas: z.number(), ms: z.number(), mudou: z.number() })),
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

export type TRestauracaoPreparada = z.infer<typeof RestauracaoPreparada>;
export type TPreferencias = z.infer<typeof Preferencias>;
export type TSessaoForja = z.infer<typeof SessaoForja>;
export type TOpcaoAoVivo = z.infer<typeof OpcaoAoVivo>;
export type TEstadoAoVivo = z.infer<typeof EstadoAoVivo>;
export type TPlanoAoVivo = z.infer<typeof PlanoAoVivo>;
export type TCidade = z.infer<typeof Cidade>;
export type TPredio = z.infer<typeof Predio>;
export type TUso = z.infer<typeof Uso>;
export type TMemoria = z.infer<typeof Memoria>;
export type TMensagem = z.infer<typeof Mensagem>;
export type TResumoConversa = z.infer<typeof ResumoConversa>;
export type TPreferenciasIA = z.infer<typeof PreferenciasIA>;
export type TModelosIA = z.infer<typeof ModelosIA>;
export type TConexoes = z.infer<typeof Conexoes>;
export type TTokens = z.infer<typeof Tokens>;
export type TSkill = z.infer<typeof Skill>;
export type TItemLoja = z.infer<typeof ItemLoja>;
export type TPergunta = z.infer<typeof Pergunta>;
export type TResultadoQuestionario = z.infer<typeof ResultadoQuestionario>;
