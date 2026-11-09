// Provedores grátis que o Gyde conecta direto, sem o FreeLLMAPI. Cada um fala o formato da OpenAI e entra pelo
// adaptadorOpenAI (adaptadores.ts), como os de modelos-extras.json. A chave fica no .env, só com o NOME aqui.
// Regras e limites conferidos nas páginas oficiais em 08/11/2026 (links em docs/inteligencia.md). Não há limite inventado:
// quando o provedor não publica, o texto diz isso.
export interface ProvedorGratis {
  id: string; nome: string; url: string; chaveEnv: string; linkChave: string; formatoChave: RegExp;
  naTela: boolean; // Mistral só entra na avaliação: o plano grátis dele não inclui a API para quem cria conta agora
  naoAceita?: string[];
  avisos: string[];
}

export const AVISO_IDADE = 'A chave precisa ser criada por alguém com 18 anos ou mais (um responsável ou professor): é o que os termos dos provedores exigem.';

export const PROVEDORES_GRATIS: ProvedorGratis[] = [
  {
    id: 'google', nome: 'Google AI Studio', url: 'https://generativelanguage.googleapis.com/v1beta/openai', chaveEnv: 'GEMINI_API_KEY',
    linkChave: 'https://aistudio.google.com/apikey', formatoChave: /^AIza[0-9A-Za-z_-]{30,}$/, naTela: true,
    avisos: [
      'No plano grátis, o Google pode usar o que você envia para melhorar os produtos dele, e pessoas podem ler essas conversas. Não mande dados pessoais nem confidenciais.',
      'Os limites do plano grátis aparecem só na sua conta do AI Studio.',
    ],
  },
  {
    id: 'groq', nome: 'Groq', url: 'https://api.groq.com/openai/v1', chaveEnv: 'GROQ_API_KEY',
    linkChave: 'https://console.groq.com/keys', formatoChave: /^gsk_[A-Za-z0-9]{20,}$/, naTela: true,
    avisos: ['O Groq diz que não usa o que você envia para treinar modelos. Responde rápido, mas aceita pedidos pequenos: bom para o chat, fraco para projetos grandes na Forja.'],
  },
  {
    id: 'nvidia', nome: 'NVIDIA', url: 'https://integrate.api.nvidia.com/v1', chaveEnv: 'NVIDIA_API_KEY',
    linkChave: 'https://build.nvidia.com/settings/api-keys', formatoChave: /^nvapi-[A-Za-z0-9_-]{20,}$/, naTela: true,
    avisos: ['Acesso de teste, para protótipos: a NVIDIA não publica os limites e pode encerrar o teste quando quiser.'],
  },
  {
    id: 'mistral', nome: 'Mistral', url: 'https://api.mistral.ai/v1', chaveEnv: 'MISTRAL_API_KEY',
    linkChave: 'https://console.mistral.ai/api-keys', formatoChave: /^[A-Za-z0-9]{32}$/, naTela: false,
    avisos: ['O plano grátis atual do Mistral não inclui a API: criar a chave exige ativar a cobrança.'],
  },
];
