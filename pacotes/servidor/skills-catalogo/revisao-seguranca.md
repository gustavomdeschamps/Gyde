---
id: revisao-seguranca
nome: Revisão de segurança
descricao: Passa um checklist de segurança no projeto e lista riscos por gravidade com correção.
icone: shield-check
categoria: Segurança
comando: /seguranca
gatilhos: segurança, seguro, vulnerabilidade, owasp, auditoria, revisar segurança, pentest
---
## Passos
1. Percorra o checklist: autenticação, permissão (cada rota confere o dono do dado), entrada do usuário, segredos, dependências, erros expostos, upload de arquivos.
2. Para cada achado: onde, risco em uma frase, gravidade (Grave/Médio/Leve) e correção.
3. Destaque o acesso a dado de outra pessoa (trocar o id na URL) como teste obrigatório.
4. Recomende `npm audit` / `pip-audit` para dependências.
5. Feche com os 3 primeiros itens a corrigir.
## Checklist
- Confere permissão por dono (IDOR).
- Achados com gravidade e correção.
- Dependências verificadas.
- Lista curta de prioridades.
## Exemplo
Entrada: "GET /pedidos/:id devolve o pedido"
Saída: "Grave: qualquer pessoa logada vê o pedido de outra trocando o id. Correção: `WHERE id = ? AND usuario_id = ?`."
## Erros comuns
- Só olhar senha e esquecer permissão.
- Mostrar stack trace para o usuário.
- Aceitar upload de qualquer tipo de arquivo.
