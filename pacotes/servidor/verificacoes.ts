// Diagnóstico (Configurações > Geral e "Primeiros passos"): confere de verdade o que o Gyde precisa para funcionar e diz,
// para cada item, o que fazer. Nada é enviado para fora do computador, a não ser o pedido mínimo de teste à IA
// conectada ("Responda só: ok"), que gasta uma fração mínima da cota grátis. Os programas são procurados sem travar o servidor.
import { execFile } from 'node:child_process';
import { accessSync, constants, statfsSync } from 'node:fs';
import type { Express } from 'express';
import type { AsyncRoute, Db } from './tipos.ts';
import * as C from '../compartilhado/contratos.ts';
import { responder } from './contratos-servidor.ts';

type Item = C.TItemVerificacao;
export interface TesteIA { ok: boolean; modelo?: string; ms?: number; erro?: string }

// assíncrono: o servidor continua respondendo enquanto o Python e o git são procurados
const programa = (cmd: string, args: string[]) => new Promise<string | null>((ok) => {
  try { execFile(cmd, args, { encoding: 'utf8', timeout: 5000, windowsHide: true }, (erro, saida, saidaErro) => ok(erro ? null : (String(saida || saidaErro).trim().split('\n')[0] ?? null))); }
  catch { ok(null); }
});
const MB = 1024 * 1024;

/** Espaço livre: aviso abaixo de 1 GB, erro abaixo de 200 MB (o banco, as cópias e as imagens precisam de espaço). */
export function itemEspaco(livreBytes: number | null): Item {
  if (livreBytes == null) return { id: 'espaco', nome: 'Espaço em disco', estado: 'aviso', detalhe: 'Não deu para medir o espaço livre.', acao: null };
  const gb = livreBytes / 1024 / MB;
  const texto = gb >= 1 ? `${gb.toFixed(1).replace('.', ',')} GB livres` : `${Math.round(livreBytes / MB)} MB livres`;
  if (livreBytes < 200 * MB) return { id: 'espaco', nome: 'Espaço em disco', estado: 'erro', detalhe: `${texto} no disco dos dados do Gyde.`, acao: 'Libere espaço no disco: com menos de 200 MB o Gyde pode não conseguir salvar conversas.' };
  if (livreBytes < 1024 * MB) return { id: 'espaco', nome: 'Espaço em disco', estado: 'aviso', detalhe: `${texto} no disco dos dados do Gyde.`, acao: 'Vale liberar espaço: cópias de segurança e imagens ocupam lugar.' };
  return { id: 'espaco', nome: 'Espaço em disco', estado: 'ok', detalhe: `${texto} no disco dos dados do Gyde.`, acao: null };
}

export function itemIA(t: TesteIA, temConexao: boolean): Item {
  if (t.ok) return { id: 'ia', nome: 'IA conectada', estado: 'ok', detalhe: `Respondeu em ${((t.ms ?? 0) / 1000).toFixed(1).replace('.', ',')} s${t.modelo ? ` (${t.modelo})` : ''}.`, acao: null };
  if (!temConexao) return { id: 'ia', nome: 'IA conectada', estado: 'erro', detalhe: 'Nenhuma IA conectada.', acao: 'Abra Configurações > Conectar IA, cole uma chave grátis e clique em Testar chave.' };
  return { id: 'ia', nome: 'IA conectada', estado: 'erro', detalhe: `Há chave conectada, mas o teste não teve resposta${t.erro ? `: ${t.erro}` : ''}.`, acao: 'Confira a internet e, em Configurações > Conectar IA, clique em Testar de novo. Se a cota grátis do dia acabou, espere ou conecte outro provedor.' };
}

export function setupVerificacoes(app: Express, { db, dataDir, testarIA, temConexao, asyncRoute }: {
  db: Db; dataDir: string; testarIA: () => Promise<TesteIA>; temConexao: () => boolean; asyncRoute: AsyncRoute;
}) {
  app.get('/api/diagnostico/verificar', asyncRoute(async (_req, res) => {
    const itens: Item[] = [];
    itens.push({ id: 'servidor', nome: 'Servidor do Gyde', estado: 'ok', detalhe: `Rodando com Node ${process.versions.node}.`, acao: null });
    let integro = false;
    try { integro = (db.prepare('PRAGMA quick_check').get() as { quick_check?: string } | undefined)?.quick_check === 'ok'; } catch { /* abaixo */ }
    itens.push(integro
      ? { id: 'banco', nome: 'Banco de dados', estado: 'ok', detalhe: 'Conferido sem erros.', acao: null }
      : { id: 'banco', nome: 'Banco de dados', estado: 'erro', detalhe: 'A conferência do banco achou problema.', acao: 'Em Configurações > Privacidade e dados, restaure a cópia de segurança mais recente (o Gyde guarda uma a cada atualização).' });
    let gravavel = true;
    try { accessSync(dataDir, constants.W_OK); } catch { gravavel = false; }
    itens.push(gravavel
      ? { id: 'dados', nome: 'Pasta de dados', estado: 'ok', detalhe: 'O Gyde consegue salvar.', acao: null }
      : { id: 'dados', nome: 'Pasta de dados', estado: 'erro', detalhe: 'Sem permissão para salvar na pasta de dados.', acao: 'Feche o Gyde e abra de novo; se continuar, reinstale sem apagar os dados.' });
    let livre: number | null = null;
    try { const s = statfsSync(dataDir); livre = s.bavail * s.bsize; } catch { /* sistema sem statfs */ }
    itens.push(itemEspaco(livre));
    let teste: TesteIA;
    try { teste = await testarIA(); } catch (e) { teste = { ok: false, erro: e instanceof Error ? e.message.slice(0, 160) : 'erro desconhecido' }; }
    itens.push(itemIA(teste, temConexao()));
    const [pyPrincipal, pyAtalho, git] = await Promise.all([
      programa(process.platform === 'win32' ? 'python' : 'python3', ['--version']),
      process.platform === 'win32' ? programa('py', ['--version']) : Promise.resolve(null),
      programa('git', ['--version']),
    ]);
    const py = pyPrincipal ?? pyAtalho;
    itens.push(py
      ? { id: 'python', nome: 'Python', estado: 'ok', detalhe: `${py}: o Ao vivo consegue rodar projetos em Python.`, acao: null }
      : { id: 'python', nome: 'Python', estado: 'aviso', detalhe: 'Python não encontrado: o Ao vivo não roda projetos em Python (o botão Executar das respostas roda no navegador e não precisa dele).', acao: 'Opcional: instale o Python pela Microsoft Store ou por python.org (marque "Add to PATH").' });
    itens.push(git
      ? { id: 'git', nome: 'Git', estado: 'ok', detalhe: `${git}: a Cidade mostra o histórico de mudanças.`, acao: null }
      : { id: 'git', nome: 'Git', estado: 'aviso', detalhe: 'Git não encontrado: a Cidade funciona, mas sem as cores de quanto cada arquivo mudou.', acao: 'Opcional: instale o Git por git-scm.com.' });
    responder(res, C.Verificacoes, { itens, em: new Date().toISOString() });
  }));
}
