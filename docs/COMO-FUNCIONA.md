# Como funciona

Extensão Manifest V3 sem build: os arquivos de `extensao/` são carregados como estão. Única peça de
terceiro: `vendor/lame.min.js` (lamejs 1.2.1, LGPL-3.0, codificador MP3 em JS puro, copiado do npm;
sha256 `15d285e2…6ec6df4`, licença em `vendor/lame.LICENSE`). Remover = apagar o arquivo e a opção MP3.

| Arquivo | Papel |
|---|---|
| `manifest.json` | Permissões: `tabCapture` (pegar a aba), `offscreen` (documento escondido que grava), `downloads` (salvar), `storage` (estado e escolhas), `unlimitedStorage` (lista de gravações), `activeTab` + `scripting` (pôr a caneta só na aba em que a pessoa clicou/apertou o atalho), `desktopCapture` (tela inteira ou janela, com a escolha do próprio Chrome). Sem `host_permissions`: a extensão não lê nenhuma página. Atalhos em `commands`. |
| `comum.js` | Qualidades (leve/normal/alta), configuração guardada, nome do arquivo, tempo descontando pausas, checagem de quem mandou a mensagem. |
| `popup.html/js` | Escolhas (som ou vídeo, qualidade, formato, microfone), relógio, Pausar/Continuar, Parar, Desenhar, Gravações. Pede o id da captura com `chrome.tabCapture.getMediaStreamId` — precisa ser no clique da pessoa. |
| `fundo.js` | Service worker: abre/fecha o offscreen, abre a escolha da tela (`chrome.desktopCapture.chooseDesktopMedia` sem aba: o id vale para o offscreen), guarda o estado em `chrome.storage.session`, tempo no ícone (cinza-amarelo "II" pausado, "!" erro), atalhos de teclado, baixa o arquivo (se "baixar automaticamente") e para sozinho se a aba fechar. |
| `offscreen.html/js` | Grava: `getUserMedia` com `chromeMediaSource: 'tab'`, devolve o som da aba para o alto-falante (a captura cala a aba), mistura o microfone num `AudioContext` (48 kHz). Tela: `chromeMediaSource: 'desktop'`, sem tocar o som de volta (a captura da tela não cala nada). WebM: `MediaRecorder` (pedaços de 1 s, `pause/resume`). MP3: `captura.js` + lamejs codificando enquanto grava. No fim guarda na lista. |
| `captura.js` | AudioWorklet do MP3: manda blocos de 4096 amostras (esq./dir.) para o offscreen. |
| `biblioteca.js` | IndexedDB `gravador`: `meta` (nome, duração, tamanho…) e `arquivos` (blob), separados para listar rápido. |
| `gravacoes.html/js` | Lista: ouvir/assistir, renomear, baixar de novo, apagar, ligar/desligar o download automático. |
| `desenho.js` | Caneta injetada na aba: canvas por cima da tela (shadow DOM fechado), caneta, marca-texto, seta, retângulo, modo "mexer na página", cores, desfazer, apagar, Esc fecha. Entra na gravação de vídeo porque a captura pega a aba como é desenhada. |
| `ajuda.html` | Como usar (abre na primeira instalação e pelo ⓘ do popup). |
| `microfone.html/js` | Pede a permissão do microfone numa página visível (no popup e no offscreen a pergunta não aparece). |
| `estilo.css`, `icones/` | Visual (claro/escuro) e ícones. |

## Fluxo

```
popup/atalho ── streamId ──▶ fundo.js ── abre ──▶ offscreen.js ── grava ──▶ Blob ──▶ IndexedDB (lista)
                                ▲   ◀── "tique" a cada 1 s (tempo no ícone) ──┤
                                └──────────── "pronto" (URL do blob) ◀────────┘
fundo.js → chrome.downloads → Downloads/Gravacoes/<título>-<data>.<webm|mp3> → fecha o offscreen
```

## Segurança e privacidade

- Nada sai do computador: sem `fetch`, CSP `connect-src 'none'`, sem código de fora.
- Só grava a aba em que a pessoa clicou, e o Chrome mostra o aviso de captura na aba.
- Microfone: só com a caixa marcada e com a permissão dada pela pessoa.
- `fundo.js` e `offscreen.js` só aceitam mensagens das páginas da própria extensão (`daExtensao`):
  nem site nem o `desenho.js` injetado conseguem pedir download ou gravação.
- Caneta: só entra na aba em que a pessoa clicou (`activeTab`), roda isolada do site (mundo isolado +
  shadow DOM fechado) e não lê nada da página.
- Lista: os nomes passam por `limparNome` (só letras, números, `-` e espaço), sem risco de caminho
  estranho no download; tudo é mostrado com `textContent`.
- As gravações da lista ficam sem criptografia no perfil do Chrome (como em Downloads): quem usa o
  mesmo usuário do computador consegue abrir.

## Testar

Carregar `extensao/` em `chrome://extensions` (modo desenvolvedor). Erros: na extensão, **Service worker**
(console do `fundo.js`) e, durante a gravação, **offscreen.html** em "Inspecionar visualizações".

## Ideias para depois

Transcrever a fala (local), cortar trechos, salvar em MP4, câmera no canto,
gravar em disco aos poucos (sem segurar tudo na memória), publicar na Chrome Web Store.
