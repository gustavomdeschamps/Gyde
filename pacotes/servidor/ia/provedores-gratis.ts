// Provedores grátis que o Gyde conecta direto, sem o FreeLLMAPI. Cada um fala o formato da OpenAI e entra pelo
// adaptadorOpenAI (adaptadores.ts). A chave fica no .env, só com o NOME aqui.
// Regras conferidas nas páginas oficiais em 08/11/2026 (links em docs/inteligencia.md). Os textos só dizem o que foi
// confirmado: nada de limite inventado, nada sobre dados que a fonte oficial não diz.
export interface ProvedorGratis {
  id: string; nome: string; url: string; chaveEnv: string; linkChave: string; formatoChave: RegExp; prefixo: string;
  naTela: boolean; // Mistral só entra na avaliação: o plano grátis dele não inclui a API para quem cria conta agora
  papel: 'inicial' | 'opcional';
  descricao: string;
  avisos: string[];
  naoAceita?: string[];
}

export const AVISO_IDADE = 'A chave precisa ser criada por alguém com 18 anos ou mais, como um responsável ou professor. É o que as regras dessas empresas exigem.';

export const PROVEDORES_GRATIS: ProvedorGratis[] = [
  {
    id: 'nvidia', nome: 'NVIDIA', url: 'https://integrate.api.nvidia.com/v1', chaveEnv: 'NVIDIA_API_KEY',
    linkChave: 'https://build.nvidia.com/settings/api-keys', formatoChave: /^nvapi-[A-Za-z0-9_-]{20,}$/, prefixo: 'nvapi-', naTela: true, papel: 'inicial',
    descricao: 'Vários modelos. Nos testes do Gyde, fez 7 de 8 tarefas da Forja.',
    avisos: ['É um teste grátis da NVIDIA: as regras e os limites podem mudar, e a NVIDIA pode encerrar o teste.'],
  },
  {
    id: 'google', nome: 'Google AI Studio', url: 'https://generativelanguage.googleapis.com/v1beta/openai', chaveEnv: 'GEMINI_API_KEY',
    linkChave: 'https://aistudio.google.com/apikey', formatoChave: /^AIza[0-9A-Za-z_-]{30,}$/, prefixo: 'AIza', naTela: true, papel: 'inicial',
    descricao: 'Entra com a conta Google. Nos testes do Gyde, fez 7 de 8 tarefas da Forja.',
    avisos: ['Privacidade: no plano grátis, o Google pode usar o que você envia para melhorar os produtos dele, e pessoas podem ler essas conversas. Não mande dados pessoais nem confidenciais.'],
  },
  {
    id: 'groq', nome: 'Groq', url: 'https://api.groq.com/openai/v1', chaveEnv: 'GROQ_API_KEY',
    linkChave: 'https://console.groq.com/keys', formatoChave: /^gsk_[A-Za-z0-9]{20,}$/, prefixo: 'gsk_', naTela: true, papel: 'opcional',
    descricao: 'Deixa o chat mais rápido e serve de reserva.',
    avisos: [],
  },
  {
    id: 'mistral', nome: 'Mistral', url: 'https://api.mistral.ai/v1', chaveEnv: 'MISTRAL_API_KEY',
    linkChave: 'https://console.mistral.ai/api-keys', formatoChave: /^[A-Za-z0-9]{32}$/, prefixo: '', naTela: false, papel: 'opcional',
    descricao: 'Só para as avaliações: o plano grátis atual do Mistral não inclui a API.',
    avisos: [],
  },
];

// Endereço de cada provedor. GYDE_URL_<ID> troca o endereço, só para os testes apontarem para um provedor falso.
export const urlDe = (p: ProvedorGratis) => process.env[`GYDE_URL_${p.id.toUpperCase()}`] || p.url;
