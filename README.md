# Gravador de Aba

Extensão do Chrome que grava o **som** (ou **som e vídeo**) da aba aberta — ou a **tela inteira /
outra janela** — com a opção de juntar o
**seu microfone** (reunião). Tudo fica no seu computador: sem servidor, sem conta, nada é enviado.

## Instalar (modo desenvolvedor)

1. Chrome → `chrome://extensions` → ligue **Modo do desenvolvedor** (canto de cima).
2. **Carregar sem compactação** → escolha a pasta `extensao/` deste repositório.
3. Fixe o ícone (quebra-cabeça → alfinete) para achar fácil.

Atualizou o código? Em `chrome://extensions`, clique no ↻ da extensão.

## Usar

Guia completo dentro da extensão: botão **ⓘ** no popup (abre sozinho na primeira instalação).

1. Abra a aba que quer gravar (vídeo, Meet, WhatsApp Web, música…).
2. Clique no ícone → escolha **Só o som**, **Som e vídeo da aba** ou **Tela inteira ou outra janela**
   (o Chrome pergunta qual; som do computador só no Windows) → (opcional) **Incluir meu
   microfone** → **Gravar esta aba**.
3. Pode fechar o popup: a gravação continua (o ícone mostra **REC**). Você segue ouvindo a aba.
4. **Pausar** quando quiser (o ícone mostra o tempo; pausado fica **II**). **Parar e salvar** manda o
   arquivo para `Downloads/Gravacoes/<título>-<data>-<hora>.webm` (ou `.mp3`).
5. **☰ Gravações** abre a lista: ouvir/assistir, renomear, baixar de novo, apagar.

**Qualidade**: Leve (720p / 64 kbps), Normal (1080p / 128 kbps), Alta (1080p 60 qps / 192 kbps).
**Formato** (só o som): WebM (menor) ou MP3 (abre em qualquer lugar).

**✎ Desenhar**: caneta por cima da página — caneta (C), marca-texto (M), seta (S), retângulo (R),
mexer na página sem apagar (U), cores, desfazer (Ctrl+Z), apagar tudo (Delete), Esc fecha. Gravando
com vídeo, o desenho entra na gravação.

**Atalhos**: Alt+Shift+G gravar/parar · Alt+Shift+S pausar · Alt+Shift+D desenhar (o atalho grava com
as últimas escolhas do popup). Mudar em `chrome://extensions/shortcuts`.

Na primeira vez com microfone, abre uma página para você **permitir o microfone** (o Chrome não
pergunta dentro do popup). Depois é só gravar de novo.

Fechar a aba ou sair da página no meio também para e salva o que já foi gravado.

## O que grava e o que não grava

| Situação | Grava? |
|---|---|
| Som de qualquer aba (vídeo, aula, podcast, música) | Sim |
| Reunião no navegador (Meet, Teams web, Zoom web) | Sim; a sua voz só com **Incluir meu microfone** |
| Mensagem de voz no WhatsApp Web | Sim, enquanto toca |
| Ligação do WhatsApp | Só com **Tela inteira** no Windows (o app fica fora do navegador) |
| Vídeo com proteção (Netflix, Prime…) | O vídeo sai preto; o som costuma gravar |
| Páginas internas (`chrome://…`, loja de extensões) | Só com **Tela inteira** |

## Formato

`.webm` (áudio Opus; vídeo VP9/VP8) ou `.mp3` (só som). Abre no Chrome, VLC, mpv e no WhatsApp/Drive.
Precisa de MP4? `ffmpeg -i entrada.webm saida.mp4`.

O MP3 usa o [LAME](https://lame.sourceforge.io) via lamejs (LGPL-3.0, `extensao/vendor/`).

A gravação fica na memória até parar e depois também na lista (dá para desligar o download
automático e apagar da lista o que não quiser): vídeo longo (1 h ≈ 1,1 GB) pede um computador com folga.

## Deu problema?

- Mensagem de erro aparece no próprio popup (ex.: página interna do Chrome, microfone bloqueado).
- Microfone bloqueado: abra de novo com **Incluir meu microfone** marcado (abre a página de permissão)
  ou libere no cadeado ao lado do endereço.
- Detalhes do erro: `chrome://extensions` → na extensão, **Service worker** (console do `fundo.js`);
  durante a gravação, **offscreen.html** em "Inspecionar visualizações".
- Ícone preso em **REC**: clique em ↻ na extensão em `chrome://extensions`.

## Cuidado legal

- Gravar uma conversa **da qual você participa** costuma ser aceito no Brasil, mas **divulgar** sem
  autorização pode violar a privacidade (e a LGPD). Avise que está gravando.
- Música e vídeo de terceiros: só para uso pessoal; repassar ou publicar infringe direito autoral.

Mais detalhes: [`docs/COMO-FUNCIONA.md`](docs/COMO-FUNCIONA.md) · histórico em [`docs/HISTORICO.md`](docs/HISTORICO.md).
