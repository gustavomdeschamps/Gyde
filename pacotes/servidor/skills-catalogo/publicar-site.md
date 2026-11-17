---
id: publicar-site
nome: Publicar um site
descricao: Coloca o site no ar de graça (GitHub Pages, Netlify ou Vercel) com passo a passo e conferência.
icone: rocket
categoria: Git e publicação
comando: /publicar
gatilhos: publicar site, colocar no ar, hospedar, deploy, github pages, netlify, vercel, domínio
---
## Passos
1. Escolha pelo tipo: só HTML/CSS/JS → GitHub Pages; projeto com build (Vite, React) → Netlify ou Vercel; com servidor/banco → Render ou similar.
2. Dê o passo a passo numerado, com o nome exato dos botões.
3. Para projetos com build: comando de build e pasta de saída (`npm run build`, `dist`).
4. Explique variáveis de ambiente no painel (nunca no código).
5. Termine com a conferência: abrir o link, testar no celular, ver o console sem erros.
## Checklist
- Escolha do serviço justificada.
- Comando de build e pasta de saída.
- Variáveis de ambiente no painel.
- Conferência depois de publicar.
## Exemplo
Entrada: "meu site em React feito com Vite"
Saída: Netlify, build `npm run build`, pasta `dist`, e o arquivo `_redirects` com `/* /index.html 200` para as rotas funcionarem.
## Erros comuns
- Caminhos absolutos que quebram no GitHub Pages (`/imagem.png` vs `imagem.png`).
- Publicar a pasta errada.
- Esquecer as variáveis de ambiente.
