// Leitor dos eventos que o servidor manda durante a resposta (Server-Sent Events: blocos "data: {json}" separados por
// linha em branco). O texto chega em pedaços que podem cortar um evento no meio: o que sobra volta para a próxima leitura.
export interface EventoChat { type: string; [campo: string]: unknown }

export function lerEventos(buffer: string): { eventos: EventoChat[]; resto: string } {
  const eventos: EventoChat[] = [];
  let resto = buffer;
  let sep;
  while ((sep = resto.indexOf('\n\n')) !== -1) {
    const bruto = resto.slice(0, sep);
    resto = resto.slice(sep + 2);
    if (!bruto.startsWith('data: ')) continue;
    try { eventos.push(JSON.parse(bruto.slice(6)) as EventoChat); } catch { /* evento quebrado: ignora */ }
  }
  return { eventos, resto };
}
