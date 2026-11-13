// Sobe um servidor do Gyde de verdade para um teste, numa pasta temporária, na porta que o sistema escolher (PORT=0).
// Antes, o teste achava uma porta livre, soltava e só depois subia o servidor; com os arquivos de teste rodando em
// paralelo, outro servidor (ex.: um provedor falso) podia pegar a mesma porta no meio, e o teste falava com o servidor
// errado. Agora a porta é a que o servidor conseguiu de fato, lida da linha "Gyde rodando em http://127.0.0.1:PORTA".
import { spawn } from 'node:child_process';
import path from 'node:path';

const SERVIDOR = path.join(import.meta.dirname, '..', 'server.ts');

export async function subirServidorDeTeste(env) {
  const proc = spawn(process.execPath, [SERVIDOR], { env: { ...process.env, PORT: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let saida = '';
  const porta = await new Promise((ok, falha) => {
    const prazo = setTimeout(() => falha(new Error(`O servidor não abriu em 30 s:\n${saida.slice(-2000)}`)), 30_000);
    const ler = (d) => {
      saida += String(d);
      const m = /Gyde rodando em http:\/\/127\.0\.0\.1:(\d+)/.exec(saida);
      if (m) { clearTimeout(prazo); ok(Number(m[1])); }
    };
    proc.stdout.on('data', ler);
    proc.stderr.on('data', (d) => { saida += String(d); });
    proc.once('exit', (codigo) => { clearTimeout(prazo); falha(new Error(`O servidor fechou (código ${codigo}):\n${saida.slice(-2000)}`)); });
  });
  return { proc, base: `http://127.0.0.1:${porta}` };
}
