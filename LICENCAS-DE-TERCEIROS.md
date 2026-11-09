# Licenças de terceiros

O Gyde é distribuído sob a licença MIT (veja [LICENSE](LICENSE)). Partes da lógica abaixo vieram de outros projetos, e as
licenças deles seguem aqui, como elas exigem.

## FreeLLMAPI

O Gyde pode usar o FreeLLMAPI como roteador opcional (modo avançado), e o roteador de modelos do próprio Gyde aproveita
ideias e lógica dele: fila de modelos por provedor, troca automática quando um modelo atinge o limite e registro de uso
por chave.

- Projeto: https://github.com/tashfeenahmed/freellmapi
- Licença: MIT

```
MIT License

Copyright (c) 2026 Tashfeen Ahmed

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## three.js

A Cidade do código em 3D (aba Cidade da Forja) usa o three.js, incluído no Gyde e carregado só quando a aba abre.
Também usa os complementos que vêm no próprio pacote: OrbitControls (girar e aproximar) e o pós-processamento
EffectComposer, RenderPass, UnrealBloomPass e OutputPass (o brilho extra, ligado só quando a placa de vídeo aguenta).

- Projeto: https://github.com/mrdoob/three.js
- Licença: MIT

```
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
