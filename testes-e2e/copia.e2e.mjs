// Cópia de segurança pela tela: baixar, restaurar e ver os dados voltarem depois de reabrir o Gyde.
import { subirServidor, abrirNavegador, clienteApi, placar } from './ajuda.mjs';

const { ok, fim } = placar();
let servidor = await subirServidor({ pasta: undefined });
const pasta = servidor.pasta;
const api = clienteApi(servidor.base);
const conta = await api.criarConta({ nome: 'Rita' });
const criar = async (titulo) => { const c = await (await api.pedir('POST', '/api/conversations', { model: 'gyde-1' })).json(); await api.pedir('PATCH', `/api/conversations/${c.id}`, { title: titulo }); };
await criar('Antes da cópia');

const nav = await abrirNavegador();
try {
  await nav.entrar(servidor.base, conta);
  await nav.ir(`${servidor.base}/?r=1#/`);
  await nav.avaliar(`document.querySelector('#openSettings').click()`);
  await nav.avaliar(`[...document.querySelectorAll('[role="tab"]')].find((b) => /Privacidade/.test(b.textContent)).click()`);
  ok('Privacidade e dados mostra baixar e restaurar', await nav.esperar(`/Baixar cópia de segurança/.test(document.querySelector('[data-painel="dados"]')?.textContent || '') && document.querySelector('[data-painel="dados"] a[href="/api/dados/copia"]') !== null`));

  // baixa a cópia como o link faria e guarda no navegador para restaurar depois
  const tamanho = await nav.avaliar(`(async()=>{ const r = await fetch('/api/dados/copia'); window.__copia = await r.blob(); return { tipo: r.headers.get('content-type'), nome: r.headers.get('content-disposition'), bytes: window.__copia.size }; })()`);
  ok('a cópia baixa como .zip', tamanho.tipo === 'application/zip' && /gyde-copia-\d{4}-\d{2}-\d{2}\.zip/.test(tamanho.nome) && tamanho.bytes > 1000, `${tamanho.bytes} bytes`);

  await criar('Depois da cópia'); // esta não está na cópia
  await nav.avaliar(`(()=>{ const dt = new DataTransfer(); dt.items.add(new File([window.__copia], 'copia.zip', { type: 'application/zip' })); const i = document.querySelector('[data-painel="dados"] input[type="file"]'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); return 1; })()`);
  ok('pede confirmação antes de restaurar', await nav.esperar(`true`, 500) && nav.dialogos.some((d) => /Restaurar esta cópia/.test(d)));
  ok('cópia conferida: mostra contas e conversas e pede para reabrir', await nav.esperar(`/1 conta\\(s\\) e 1 conversa\\(s\\)/.test(document.querySelector('.config-aviso')?.textContent || '') && /abra de novo/.test(document.querySelector('.config-aviso').textContent)`));
  const antes = await (await api.pedir('GET', '/api/conversations')).json();
  ok('nada muda antes de reabrir', antes.conversations.length === 2);

  const lixo = await nav.avaliar(`(async()=>{ const r = await fetch('/api/dados/restaurar', { method: 'POST', headers: { 'x-gyde': '1' }, body: new Blob(['isso não é zip']) }); return { status: r.status, erro: (await r.json()).error }; })()`);
  ok('arquivo que não é cópia é recusado com explicação', lixo.status === 400 && /não é um \.zip/.test(lixo.erro), lixo.erro);
  const semCsrf = await fetch(`${servidor.base}/api/dados/restaurar`, { method: 'POST', body: 'x' });
  ok('restaurar sem login nem cabeçalho do Gyde é recusado', semCsrf.status === 403 || semCsrf.status === 401, String(semCsrf.status));
  const semLogin = await fetch(`${servidor.base}/api/dados/copia`);
  ok('baixar a cópia exige login', semLogin.status === 401);
} finally { await nav.fechar(); }

// a restauração pendente foi desfeita pelo arquivo lixo? não: ele foi recusado antes de mexer. Reabre o Gyde.
const contratoAntes = servidor.foraDoContrato();
await servidor.parar({ apagar: false });
servidor = await subirServidor({ pasta });
ok('ao reabrir, avisa que restaurou a cópia', /Cópia de segurança restaurada/.test(servidor.saida.join('')));
const api2 = clienteApi(servidor.base);
await api2.pedir('POST', '/api/auth/login', { email: conta.email, password: conta.senha });
const depois = await (await api2.pedir('GET', '/api/conversations')).json();
ok('depois de reabrir, os dados são os da cópia', depois.conversations.length === 1 && depois.conversations[0].title === 'Antes da cópia', depois.conversations.map((c) => c.title).join(', '));
ok('sem resposta fora do contrato', !contratoAntes && !servidor.foraDoContrato(), contratoAntes ?? servidor.foraDoContrato() ?? '');
await servidor.parar({ apagar: true });
process.exit(fim());
