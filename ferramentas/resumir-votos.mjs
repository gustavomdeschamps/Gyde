// Resume os votos guardados no banco local (polegar em cada resposta e "Comparar respostas") para ajustar o guia de
// estilo (docs/guia-de-estilo.md). Abre o banco só para LEITURA: não muda nada. Nada sai deste computador.
//   node ferramentas/resumir-votos.mjs [caminho do banco]
// Sem caminho, procura o do app instalado (%APPDATA%\Gyde\dados\chat.db) e depois o da pasta data/ do projeto.
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';

const candidatos = [process.argv[2], process.env.APPDATA && path.join(process.env.APPDATA, 'Gyde', 'dados', 'chat.db'), path.join(import.meta.dirname, '..', 'data', 'chat.db')].filter(Boolean);
const banco = candidatos.find((c) => existsSync(c));
if (!banco) { console.log('Não achei o banco do Gyde. Passe o caminho: node ferramentas/resumir-votos.mjs <arquivo chat.db>'); process.exit(1); }
const db = new DatabaseSync(banco, { readOnly: true });
const tem = (t) => db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
if (!tem('votos_resposta')) { console.log('Este banco ainda não tem votos (versão anterior à 2.5.0).'); process.exit(0); }

// comparações: quantas vezes cada versão do guia venceu
const comps = db.prepare('SELECT variante_a, variante_b, voto FROM comparacoes WHERE voto IS NOT NULL').all();
const placar = { atual: 0, anterior: 0, empate: 0 };
for (const c of comps) { if (c.voto === 'empate') placar.empate++; else placar[c.voto === 'a' ? c.variante_a : c.variante_b]++; }
console.log(`Comparar respostas: ${comps.length} votos. Guia atual ${placar.atual}, guia anterior ${placar.anterior}, empates ${placar.empate}.`);

// polegar: como são as respostas aprovadas e as reprovadas (tamanho, código, listas, código conferido)
const votos = db.prepare('SELECT v.valor, m.content FROM votos_resposta v JOIN messages m ON m.id = v.message_id').all();
const semCodigo = (t) => t.replace(/```[\s\S]*?```/g, '');
const tracos = (t) => ({
  palavras: semCodigo(t).split(/\s+/).filter(Boolean).length,
  codigo: /```/.test(t), lista: /^\s*([-*]|\d+\.)\s/m.test(semCodigo(t)), conferido: /\*Código conferido/.test(t), titulos: /^#{1,4}\s/m.test(semCodigo(t)),
});
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const pct = (xs, k) => (xs.length ? Math.round((xs.filter((x) => x[k]).length / xs.length) * 100) : 0);
for (const [nome, valor] of [['aprovadas', 1], ['reprovadas', -1]]) {
  const t = votos.filter((v) => v.valor === valor).map((v) => tracos(v.content));
  console.log(`Respostas ${nome}: ${t.length}. Mediana de palavras ${mediana(t.map((x) => x.palavras))}; com código ${pct(t, 'codigo')}%; com lista ${pct(t, 'lista')}%; com títulos ${pct(t, 'titulos')}%; código conferido ${pct(t, 'conferido')}%.`);
}
const boas = votos.filter((v) => v.valor === 1).map((v) => tracos(v.content)), ruins = votos.filter((v) => v.valor === -1).map((v) => tracos(v.content));
if (boas.length >= 5 && ruins.length >= 5) {
  const dicas = [];
  if (mediana(ruins.map((x) => x.palavras)) > 1.5 * mediana(boas.map((x) => x.palavras))) dicas.push('as reprovadas são bem mais longas: reforce no guia "tamanho proporcional"');
  if (pct(ruins, 'lista') - pct(boas, 'lista') > 25) dicas.push('as reprovadas usam mais listas: reforce "lista só quando ajuda"');
  if (pct(ruins, 'titulos') - pct(boas, 'titulos') > 25) dicas.push('as reprovadas usam mais títulos: peça menos títulos em respostas curtas');
  console.log(dicas.length ? `Sugestões para o guia: ${dicas.join('; ')}.` : 'Nenhuma diferença grande entre aprovadas e reprovadas.');
} else console.log('Ainda há poucos votos (é preciso pelo menos 5 aprovadas e 5 reprovadas) para sugerir mudanças no guia.');
