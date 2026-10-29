// Proteções da Forja que não dependem do modelo obedecer: caminhos, segredos, ambiente dos comandos e risco dos comandos.
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';

// Arquivos que nunca são lidos, mostrados, enviados ao modelo, editados ou apagados.
export const ARQUIVO_SECRETO = new RegExp([
  String.raw`(^|[\\/])\.env($|\.)`, String.raw`(^|[\\/])\.envrc$`,
  String.raw`(^|[\\/])\.ssh([\\/]|$)`, String.raw`(^|[\\/])\.aws([\\/]|$)`, String.raw`(^|[\\/])\.azure([\\/]|$)`, String.raw`(^|[\\/])\.gnupg([\\/]|$)`,
  String.raw`(^|[\\/])\.docker[\\/]config\.json$`, String.raw`(^|[\\/])\.kube[\\/]config$`,
  String.raw`(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$`, String.raw`\.(pem|key|p12|pfx|jks|keystore|kdbx|ppk|asc)$`,
  String.raw`(^|[\\/])\.(npmrc|pypirc|netrc|git-credentials|pgpass)$`, String.raw`(^|[\\/])credentials(\.json)?$`,
  String.raw`(^|[\\/])(secrets?|segredos?|senhas?|credenciais|service[-_]?account)[^\\/]*\.(json|ya?ml|toml|txt)$`, String.raw`(^|[\\/])google-services\.json$`,
  String.raw`(^|[\\/])(cookies|login data|web data)$`, String.raw`\.(sqlite|db)-?(wal|shm)?$`,
].join('|'), 'i');

// Trechos que parecem chaves, tokens ou senhas: trocados por [segredo removido] antes de ir para o modelo ou para a tela.
const PADROES = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(sk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|gho_[A-Za-z0-9]{30,}|glpat-[A-Za-z0-9_-]{20,})\b/g,
  /\b(AIza[0-9A-Za-z_-]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|freellmapi-[A-Za-z0-9_-]{10,}|hf_[A-Za-z0-9]{30,}|npm_[A-Za-z0-9]{30,})\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // JWT
  /((?:api[_-]?key|secret|token|passw(?:or)?d|senha|client[_-]?secret|auth)\s*["']?\s*[:=]\s*["']?)([^\s"'`,;]{8,})/gi,
];
export function redigir(texto: unknown): string {
  let t = String(texto ?? '');
  for (const p of PADROES) t = t.replace(p, (_m: string, prefixo?: unknown, valor?: unknown) => (valor !== undefined && typeof prefixo === 'string' && /[:=]/.test(prefixo) ? `${prefixo}[segredo removido]` : '[segredo removido]'));
  return t;
}

// Variáveis de ambiente que não passam para os comandos da Forja (ex.: as chaves do .env do próprio Gyde).
const VAR_SECRETA = /(KEY|TOKEN|SECRET|PASS|PWD|SENHA|CREDENTIAL|SMTP|COOKIE|SESSION|AUTH|PRIVATE)/i;
export function ambienteLimpo(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!VAR_SECRETA.test(k) && !/^(FREELLMAPI|CLOUDFLARE|GEMINI|GYDE_|OLLAMA)/i.test(k)) env[k] = v;
  return { ...env, ...extra };
}

// Resolve um caminho relativo dentro da pasta do projeto e garante que ele não escapa dela,
// nem com "..", nem com caminho absoluto, nem por atalhos (links simbólicos/junções) que apontem para fora.
export function caminhoSeguro(pastaReal: string, rel: unknown): string {
  const alvo = path.resolve(pastaReal, String(rel ?? '.'));
  const dentro = (p: string) => p === pastaReal || p.toLowerCase().startsWith(pastaReal.toLowerCase() + path.sep);
  if (!dentro(alvo)) throw new Error(`O caminho "${rel}" está fora da pasta do projeto.`);
  // o pedaço que já existe é resolvido de verdade (segue links) e precisa continuar dentro
  let existente = alvo;
  while (!existsSync(existente) && existente !== pastaReal) existente = path.dirname(existente);
  const real = realpathSync.native(existente);
  if (!dentro(real)) throw new Error(`O caminho "${rel}" aponta (por atalho) para fora da pasta do projeto.`);
  if (ARQUIVO_SECRETO.test(path.relative(pastaReal, alvo))) throw new Error(`"${rel}" é um arquivo de senhas ou chaves: a Forja não mexe nele.`);
  return alvo;
}

// Comandos: bloqueado (nunca roda), confirmar (só com o OK do usuário) ou livre.
type Regra = [RegExp, string];
const BLOQUEADO: Regra[] = [
  [/\bformat(\.com)?\s+[a-z]:/i, 'formata um disco'], [/\b(shutdown|restart-computer|stop-computer|logoff)\b/i, 'desliga ou reinicia o computador'],
  [/\b(diskpart|bcdedit|vssadmin|wbadmin|bootrec)\b/i, 'mexe no disco ou na inicialização do Windows'],
  [/\breg(\.exe)?\s+(delete|add|import)\b/i, 'altera o registro do Windows'], [/\b(set-executionpolicy|set-mppreference|netsh\s+advfirewall)\b/i, 'desativa proteções do sistema'],
  [/\bnet\s+(user|localgroup)\b/i, 'mexe em contas do Windows'], [/\bcipher\s+\/w/i, 'apaga o espaço livre do disco'], [/:\(\)\s*\{/, 'trava o computador (fork bomb)'],
  [/\b(rm|del|erase|rd|rmdir|remove-item)\b[^|;&]*\s(\/|~|[a-z]:\\?)(\s|$|["'])/i, 'apaga a raiz de um disco'],
  [/\\(windows|program files|program files \(x86\)|programdata|users)\\?/i, 'mexe em pastas do sistema ou de outros usuários'],
  [/\b(mimikatz|lsass|sekurlsa|procdump)\b/i, 'tenta roubar senhas do sistema'],
  [/\b(schtasks|sc(\.exe)?\s+(create|config|delete)|new-service)\b/i, 'cria tarefas ou serviços no Windows'],
  [/(%[a-z_]*(key|token|secret|pass)[a-z_]*%|\$env:[a-z_]*(key|token|secret|pass))/i, 'tenta ler segredos das variáveis de ambiente'],
  [/(^|[\s"'\\/])\.env\b|\.(pem|key|ppk)\b|\bid_(rsa|ed25519)\b|\.ssh[\\/]/i, 'tenta ler arquivos de senhas ou chaves'],
];
const CONFIRMAR: Regra[] = [
  [/\b(rm|del|erase|rd|rmdir|remove-item|rimraf|unlink)\b/i, 'apaga arquivos'],
  [/\bgit\s+(push|reset\s+--hard|clean|checkout\s+--|restore|rebase|branch\s+-D|stash\s+drop|filter-branch)\b/i, 'altera ou publica o histórico do Git'],
  [/\b(npm|pnpm|yarn)\s+(publish|unpublish|deprecate)\b|\bvsce\s+publish\b|\btwine\s+upload\b/i, 'publica um pacote na internet'],
  [/\b(npm|pnpm|yarn|pip|pip3|py\s+-m\s+pip|python\s+-m\s+pip|winget|choco|scoop)\s+(i|install|add|update|upgrade|uninstall|remove)\b/i, 'instala ou remove programas e pacotes (baixa e roda código da internet)'],
  [/\b(curl|wget|invoke-webrequest|iwr|invoke-restmethod|irm|certutil|bitsadmin|ftp|scp|ssh)\b/i, 'acessa a internet ou outro computador'],
  [/\b(powershell|pwsh)\b.*\b(-enc|-encodedcommand)\b/i, 'roda um comando codificado'],
  [/\b(move|mv|ren|rename|move-item|rename-item)\b/i, 'move ou renomeia arquivos'],
  [/(^|[^=\-\d])>{1,2}\s*[^|&;>=\s]+/, 'grava a saída do comando num arquivo'],
  [/\b(docker|kubectl|terraform|vercel|netlify|firebase\s+deploy|gh\s+(repo|release|pr\s+merge))\b/i, 'mexe em serviços externos ou faz deploy'],
];
export type NivelComando = 'bloqueado' | 'confirmar' | 'livre';
export function classificarComando(cmd: unknown): { nivel: NivelComando; motivo: string } {
  const c = String(cmd || '');
  for (const [re, motivo] of BLOQUEADO) if (re.test(c)) return { nivel: 'bloqueado', motivo };
  for (const [re, motivo] of CONFIRMAR) if (re.test(c)) return { nivel: 'confirmar', motivo };
  return { nivel: 'livre', motivo: '' };
}
