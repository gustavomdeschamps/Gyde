---
id: senhas-seguras
nome: Login e senhas seguros
descricao: Guarda senhas com hash forte, limita tentativas e cuida da sessão do login.
icone: key-round
categoria: Segurança
comando: /senhas
gatilhos: senha, login, autenticação, hash, bcrypt, argon2, sessão, jwt, cadastro de usuário
---
## Passos
1. Nunca guarde a senha em texto nem com MD5/SHA puro: use bcrypt, scrypt ou Argon2.
2. Compare com a função da biblioteca (tempo constante), não com `==`.
3. Limite tentativas de login por conta e por IP.
4. Mensagem de erro igual para "e-mail não existe" e "senha errada".
5. Sessão: cookie `HttpOnly`, `Secure`, `SameSite=Lax`; se usar JWT, prazo curto.
## Checklist
- Hash lento com sal (bcrypt/scrypt/Argon2).
- Limite de tentativas.
- Mensagem de erro que não revela se o e-mail existe.
- Cookie HttpOnly e Secure.
## Exemplo
Entrada: "salvar senha do usuário no cadastro"
Saída: `const hash = await bcrypt.hash(senha, 12);` e no login `await bcrypt.compare(senha, usuario.hash)`.
## Erros comuns
- `sha256(senha)` sem sal.
- Guardar o token JWT no localStorage sem pensar em XSS.
- "Usuário não encontrado" vs "senha incorreta" (revela contas).
