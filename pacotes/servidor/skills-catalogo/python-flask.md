---
id: python-flask
nome: API com Python e Flask
descricao: Cria rotas Flask com validação, códigos HTTP certos e ambiente virtual.
icone: flask-round
categoria: Aplicativos e APIs
comando: /flask
gatilhos: flask, python api, fastapi, django, back-end python, rota python
---
## Passos
1. Comece pelo ambiente virtual: `python -m venv .venv`, ativar, `pip install flask`, e `requirements.txt`.
2. Rotas com `@app.get` / `@app.post`; leia o JSON com `request.get_json(silent=True) or {}`.
3. Valide e responda `jsonify(erro=...), 400` quando faltar dado.
4. Devolva 201 ao criar e 404 quando não achar.
5. Mostre como rodar (`flask --app app run --debug`) e testar com curl.
## Checklist
- Ambiente virtual e requirements.txt.
- Validação com 400.
- Códigos 201 e 404 usados.
- `debug=True` só em desenvolvimento.
## Exemplo
Entrada: "rota para cadastrar livro"
Saída: `@app.post('/livros')` que confere `titulo`, salva e retorna `jsonify(livro), 201`.
## Erros comuns
- Instalar pacotes fora do ambiente virtual.
- `request.json` quebrando quando o corpo não é JSON.
- Deixar debug ligado em produção.
