# Instruções para o Claude Code neste repositório

Gyde: tutor de programação com IA, em português. Leia o [CONTRIBUTING.md](CONTRIBUTING.md) antes de mudar algo.

## Jeito de trabalhar

- Responda e escreva em português simples, sem emojis. Diga só o que foi confirmado (nada de modelos, limites, preços
  ou resultados inventados).
- Segredos nunca aparecem: nada de valores do `.env`, chaves (`nvapi-`, `gsk_`, `AIza`...) ou tokens no código, nos
  commits, nos registros, nas capturas ou nas respostas.
- Mudou algo que a pessoa vê: teste de navegador em `testes-e2e`. Mudou o banco: migração nova no fim de
  `pacotes/servidor/migracoes.ts`. Resposta nova da API: contrato em `pacotes/compartilhado/contratos.ts`.
- Rode `npm test` (tipos, lint e testes) antes de cada commit. Envio para o GitHub só com autorização e nunca para a
  branch principal direto; nunca `push --force`.

## Regra permanente: limpeza a cada atualização

A cada atualização, remover o que ficou obsoleto (código morto, arquivos, imagens, instaladores e cópias antigas), sem
tocar em dados do usuário. Em commit separado (para dar para voltar), conferido com `npm test`, e listando o que saiu.

**Nunca se apaga:**
- `%APPDATA%\Gyde`: os dados do app (o banco `gyde.db`, a pasta `data`, os registros e o `.env` do app);
- o `.env` e a pasta `data/` do projeto;
- cópias de segurança em `Documentos\Gyde-backups` com menos de 7 dias ou entre as 5 mais recentes.

Fora do repositório, quem apaga é o script `Documentos\Gyde-atualizar\limpar-antigos.ps1`, que mostra a lista e pergunta
antes; o script de preparar a atualização apaga só as cópias de segurança antigas, pela mesma regra.
