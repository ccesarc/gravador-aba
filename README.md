# Gravador de Aba

Extensão do Chrome que grava o **som** (ou **som e vídeo**) da aba aberta, com a opção de juntar o
**seu microfone** (reunião). Tudo fica no seu computador: sem servidor, sem conta, nada é enviado.

## Instalar (modo desenvolvedor)

1. Chrome → `chrome://extensions` → ligue **Modo do desenvolvedor** (canto de cima).
2. **Carregar sem compactação** → escolha a pasta `extensao/` deste repositório.
3. Fixe o ícone (quebra-cabeça → alfinete) para achar fácil.

Atualizou o código? Em `chrome://extensions`, clique no ↻ da extensão.

## Usar

1. Abra a aba que quer gravar (vídeo, Meet, WhatsApp Web, música…).
2. Clique no ícone → escolha **Só o som** ou **Som e vídeo da aba** → (opcional) **Incluir meu
   microfone** → **Gravar esta aba**.
3. Pode fechar o popup: a gravação continua (o ícone mostra **REC**). Você segue ouvindo a aba.
4. Ícone → **Parar e salvar**. O arquivo vai para `Downloads/Gravacoes/<título>-<data>-<hora>.webm`.

Na primeira vez com microfone, abre uma página para você **permitir o microfone** (o Chrome não
pergunta dentro do popup). Depois é só gravar de novo.

Fechar a aba ou sair da página no meio também para e salva o que já foi gravado.

## O que grava e o que não grava

| Situação | Grava? |
|---|---|
| Som de qualquer aba (vídeo, aula, podcast, música) | Sim |
| Reunião no navegador (Meet, Teams web, Zoom web) | Sim; a sua voz só com **Incluir meu microfone** |
| Mensagem de voz no WhatsApp Web | Sim, enquanto toca |
| Ligação do WhatsApp | Não: só existe no app do Windows/Mac, fora do navegador |
| Vídeo com proteção (Netflix, Prime…) | O vídeo sai preto; o som costuma gravar |
| Páginas internas (`chrome://…`, loja de extensões) | Não (o Chrome não deixa) |

## Formato

`.webm` (áudio Opus; vídeo VP9/VP8 até 1080p 30 fps). Abre no Chrome, VLC, mpv e no WhatsApp/Drive.
Precisa de MP3 ou MP4? `ffmpeg -i entrada.webm saida.mp3` ou `ffmpeg -i entrada.webm saida.mp4`.

A gravação fica na memória até parar: vídeo longo (1 h ≈ 1,1 GB) pede um computador com folga.

## Cuidado legal

- Gravar uma conversa **da qual você participa** costuma ser aceito no Brasil, mas **divulgar** sem
  autorização pode violar a privacidade (e a LGPD). Avise que está gravando.
- Música e vídeo de terceiros: só para uso pessoal; repassar ou publicar infringe direito autoral.

Mais detalhes: [`docs/COMO-FUNCIONA.md`](docs/COMO-FUNCIONA.md) · histórico em [`docs/HISTORICO.md`](docs/HISTORICO.md).
