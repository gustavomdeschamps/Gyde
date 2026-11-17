---
id: tarefas-agendadas
nome: Tarefas agendadas
descricao: Agenda scripts para rodar sozinhos (cron, Agendador do Windows) com registro e aviso de falha.
icone: calendar-clock
categoria: Automação e scripts
comando: /agendar
gatilhos: agendar, cron, crontab, agendador de tarefas, rodar todo dia, automatizar horário, task scheduler
---
## Passos
1. Garanta que o script roda sozinho pelo terminal antes de agendar.
2. Use caminhos absolutos (o agendador não começa na sua pasta).
3. Mostre o agendamento: linha do cron com a explicação de cada campo, ou o comando `schtasks` / passo a passo do Agendador do Windows.
4. Grave um registro (log) com data e resultado a cada execução.
5. Diga como saber se falhou e como testar sem esperar o horário.
## Checklist
- Caminhos absolutos.
- Cron explicado campo por campo (ou schtasks).
- Arquivo de registro.
- Como testar agora.
## Exemplo
Entrada: "rodar backup.py todo dia às 2h"
Saída: `0 2 * * * /usr/bin/python3 /home/ana/scripts/backup.py >> /home/ana/scripts/backup.log 2>&1` com "minuto 0, hora 2, todo dia".
## Erros comuns
- Caminho relativo que funciona no terminal e falha no agendador.
- Sem log: falha em silêncio.
- Confundir a ordem dos campos do cron.
