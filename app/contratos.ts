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
});

export const PAGINAS_INICIAIS = ['chat', 'pratica', 'agente'] as const;
export const Preferencias = z.object({
  about_user: z.string(),
  response_style: z.string(),
  pagina_inicial: z.enum(PAGINAS_INICIAIS),
});

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
  motivos: z.record(z.array(z.string())),
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
  progress: z.record(z.object({ done: z.boolean(), code: z.string().optional(), fails: z.number().optional() })),
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
    hoje: z.record(Totais),
    semana: z.record(Totais),
    ultimos: z.array(z.object({
      origem: z.string(), provedor: z.string().nullable(), modelo: z.string().nullable(), resultado: z.enum(['ok', 'erro', 'cancelado', 'limite']),
      chamadas: z.number().int(), tokens_entrada: z.number().int().nullable(), tokens_saida: z.number().int().nullable(),
      erro: z.string().nullable(), inicio: z.number(), duracao_ms: z.number(),
    })),
    internasHoje: z.number().int().nullable(),
  }),
});

export type TStatus = z.infer<typeof Status>;
export type TPreferencias = z.infer<typeof Preferencias>;
export type TPlano = z.infer<typeof Plano>;
export type TPasso = z.infer<typeof Passo>;
export type TEstadoPratica = z.infer<typeof EstadoPratica>;
export type TEstadoPasta = z.infer<typeof EstadoPasta>;
export type TProjeto = z.infer<typeof Projeto>;
export type TSessaoForja = z.infer<typeof SessaoForja>;
export type TUso = z.infer<typeof Uso>;
export type TMemoria = z.infer<typeof Memoria>;
export type TTokens = z.infer<typeof Tokens>;
