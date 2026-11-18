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

## Lucide (ícones)

Todos os ícones do app, das extensões e do site vêm do Lucide, gerados por `ferramentas/gerar-icones.mjs` (só os
ícones usados). Versão 1.66.0.

- Projeto: https://lucide.dev (https://github.com/lucide-icons/lucide)
- Licença: ISC (alguns ícones derivados do Feather, sob MIT, como diz o texto abaixo)

```
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

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

## Pacotes dentro do app

<!-- dependencias:inicio (gerado por ferramentas/licencas.mjs; não edite à mão) -->

66 pacotes vão dentro do app (dependências de produção e as dependências delas). O texto de cada licença fica
na pasta do pacote, em `node_modules`. O Electron inclui no instalador as licenças do Chromium e do Node.js.

| Pacote | Versão | Licença |
|---|---|---|
| @highlightjs/cdn-assets | 11.12.0 | BSD-3-Clause |
| @types/trusted-types | 2.0.7 | MIT |
| accepts | 2.0.0 | MIT |
| argparse | 2.0.1 | Python-2.0 |
| body-parser | 2.4.0 | MIT |
| builder-util-runtime | 9.7.0 | MIT |
| bytes | 3.1.2 | MIT |
| content-disposition | 2.0.1 | MIT |
| content-type | 2.1.0 | MIT |
| cookie | 0.7.2 | MIT |
| cookie-signature | 1.2.2 | MIT |
| debug | 4.4.3 | MIT |
| depd | 2.0.0 | MIT |
| dompurify | 3.4.17 | (MPL-2.0 OR Apache-2.0) |
| electron-updater | 6.8.11 | MIT |
| encodeurl | 2.0.0 | MIT |
| escape-html | 1.0.3 | MIT |
| etag | 1.8.1 | MIT |
| express | 5.3.0 | MIT |
| fflate | 0.8.3 | MIT |
| finalhandler | 2.1.1 | MIT |
| forwarded | 0.2.0 | MIT |
| fresh | 2.0.0 | MIT |
| fs-extra | 10.1.0 | MIT |
| graceful-fs | 4.2.11 | ISC |
| gyde | 2.5.0 | MIT |
| http-errors | 2.0.1 | MIT |
| iconv-lite | 0.7.3 | MIT |
| ipaddr.js | 1.9.1 | MIT |
| is-promise | 4.0.0 | MIT |
| js-yaml | 4.3.2 | MIT |
| jsonfile | 6.2.1 | MIT |
| lazy-val | 1.0.5 | MIT |
| lodash.escaperegexp | 4.1.2 | MIT |
| lodash.isequal | 4.5.0 | MIT |
| lucide | 1.66.0 | ISC |
| marked | 16.4.2 | MIT |
| merge-descriptors | 2.0.0 | MIT |
| mime-types | 3.0.2 | MIT |
| ms | 2.1.3 | MIT |
| negotiator | 1.1.0 | MIT |
| nodemailer | 10.2.1 | MIT-0 |
| on-finished | 2.4.2 | MIT |
| once | 1.4.0 | ISC |
| parseurl | 1.3.3 | MIT |
| path-to-regexp | 8.4.2 | MIT |
| proxy-addr | 2.0.8 | MIT |
| qs | 6.16.1 | BSD-3-Clause |
| range-parser | 1.3.0 | MIT |
| raw-body | 3.0.2 | MIT |
| router | 2.2.0 | MIT |
| safer-buffer | 2.1.2 | MIT |
| sax | 1.6.1 | BlueOak-1.0.0 |
| semver | 7.7.4 | ISC |
| send | 1.2.1 | MIT |
| serve-static | 2.2.1 | MIT |
| statuses | 2.0.2 | MIT |
| three | 0.186.1 | MIT |
| tiny-typed-emitter | 2.1.0 | MIT |
| type-is | 2.1.0 | MIT |
| universalify | 2.0.1 | MIT |
| unpdf | 1.9.1 | MIT |
| unpipe | 1.0.0 | MIT |
| vary | 1.1.2 | MIT |
| wrappy | 1.0.2 | ISC |
| zod | 4.6.7 | MIT |

<!-- dependencias:fim -->
