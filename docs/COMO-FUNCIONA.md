# Como funciona

Extensão Manifest V3, sem dependência e sem build: os arquivos de `extensao/` são carregados como estão.

| Arquivo | Papel |
|---|---|
| `manifest.json` | Permissões: `tabCapture` (pegar a aba), `offscreen` (documento escondido que grava), `downloads` (salvar), `storage` (estado da gravação). Sem permissão de site (`host_permissions`): a extensão não lê nenhuma página. |
| `popup.html/js` | Escolha (som / som e vídeo / microfone), relógio e Parar. Pede o id da captura com `chrome.tabCapture.getMediaStreamId` — precisa ser no clique da pessoa. |
| `fundo.js` | Service worker: abre/fecha o offscreen, guarda o estado em `chrome.storage.session`, selo **REC**, baixa o arquivo e para sozinho se a aba fechar. |
| `offscreen.html/js` | Grava: `getUserMedia` com `chromeMediaSource: 'tab'`, devolve o som da aba para o alto-falante (a captura cala a aba), mistura o microfone num `AudioContext` e grava com `MediaRecorder` (pedaços de 1 s). |
| `microfone.html/js` | Pede a permissão do microfone numa página visível (no popup e no offscreen a pergunta não aparece). |
| `estilo.css`, `icones/` | Visual (claro/escuro) e ícones. |

## Fluxo

```
popup (clique) ── streamId ──▶ fundo.js ── abre ──▶ offscreen.js ── grava ──▶ Blob
                                   ▲                                         │
                                   └──────── "pronto" (URL do blob) ◀────────┘
fundo.js → chrome.downloads → Downloads/Gravacoes/<título>-<data>.webm → fecha o offscreen
```

## Segurança e privacidade

- Nada sai do computador: sem `fetch`, CSP `connect-src 'none'`, sem código de fora.
- Só grava a aba em que a pessoa clicou, e o Chrome mostra o aviso de captura na aba.
- Microfone: só com a caixa marcada e com a permissão dada pela pessoa.

## Testar

Carregar `extensao/` em `chrome://extensions` (modo desenvolvedor). Erros: na extensão, **Service worker**
(console do `fundo.js`) e, durante a gravação, **offscreen.html** em "Inspecionar visualizações".

## Ideias para depois

Transcrever a fala (local), cortar trechos, gravar a tela inteira (`getDisplayMedia`), salvar em MP3/MP4,
gravar em disco aos poucos (sem segurar tudo na memória), publicar na Chrome Web Store.
