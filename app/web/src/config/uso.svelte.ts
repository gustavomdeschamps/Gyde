// Estado do uso da IA, compartilhado entre o chip do rodapé e a aba "Uso e limites".
// Só dados que o provedor informa (contrato Uso); a última resposta vem do próprio chat.
import * as C from '$contratos';
import type { TUso } from '$contratos';
import { pedir } from '../api.ts';

export interface Consumo { provedor: string; modelo: string | null; tokens: { entrada: number | null; saida: number | null; total: number | null } | null }
export const uso = $state<{ dados: TUso | null; ultima: Consumo | null; erro: boolean }>({ dados: null, ultima: null, erro: false });

export async function atualizarUso() {
  try { uso.dados = await pedir('/api/uso', C.Uso); uso.erro = false; } catch { uso.dados = null; uso.erro = true; }
}
export const registrarUltima = (c: Consumo) => { uso.ultima = c; };

export const nomeModelo = (id: string | null | undefined) => String(id || '').split('/').pop()!.replace(/:free$/, '');
export const numero = (n: number | null | undefined) => (n == null ? 'não informado' : Number(n).toLocaleString('pt-BR'));
export const horaCurta = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const NOME_PROVEDOR: Record<string, string> = { online: 'FreeLLMAPI', offline: 'Modelo local (Ollama)', nenhum: 'Sem provedor' };
