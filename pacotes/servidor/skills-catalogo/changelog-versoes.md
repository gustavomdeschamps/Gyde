---
id: changelog-versoes
nome: Versões e changelog
descricao: Decide o número da próxima versão e escreve o changelog para quem usa, não para quem programa.
icone: history
categoria: Documentação
comando: /changelog
gatilhos: changelog, versão, semver, release, notas de versão, novidades da versão
---
## Passos
1. Número da versão (SemVer): quebra compatibilidade → maior (2.0.0); função nova → do meio (1.3.0); só correção → última (1.2.1).
2. Agrupe em Novidades, Correções e Mudanças que quebram.
3. Cada item diz o efeito para quem usa ("Exportar agora inclui as imagens"), não o nome do arquivo.
4. Mudança que quebra traz o que fazer para atualizar.
5. Data no formato AAAA-MM-DD.
## Checklist
- Versão justificada pelo SemVer.
- Grupos Novidades/Correções.
- Itens escritos para quem usa.
- Instrução de atualização se quebra algo.
## Exemplo
Entrada: "adicionei filtro por data e corrigi o login que caía"
Saída: versão 1.4.0 (função nova); Novidades: "Filtrar tarefas por data"; Correções: "O login não cai mais depois de 1 hora".
## Erros comuns
- "Refatorado o módulo X" sem efeito para quem usa.
- Subir a versão maior por qualquer coisa.
- Changelog copiado dos commits.
