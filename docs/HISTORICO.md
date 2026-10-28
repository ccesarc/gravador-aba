# Histórico

## 28/10/2026 — versão 0.2.0

- Pedido do dono: "mais opções". Entrou: **Pausar/Continuar** com tempo no ícone; **qualidade**
  (leve/normal/alta); **MP3** para só o som (lamejs, com o ok do dono); **Minhas gravações** (ouvir,
  renomear, baixar de novo, apagar; download automático pode ser desligado); **atalhos** Alt+Shift+G
  (gravar/parar), Alt+Shift+S (pausar), Alt+Shift+D (desenhar); **caneta na tela** (entra no vídeo).
- Também: **Tela inteira ou outra janela** (`desktopCapture`; som do computador só no Windows) e
  **informativos**: página Como usar (ⓘ no popup, abre na instalação) e dicas ao passar o mouse.
- Corrigido: o popup mostrava as telas "parado" e "gravando" juntas (`section` sobrescrevia `hidden`).
- Segurança: mensagens internas só aceitas de páginas da extensão.
- Testado no Chromium 156 headless: telas, MP3 (worklet + lamejs, 2 s decodificados de volta), lista,
  renomear, caneta. Falta o teste de verdade gravando uma aba (precisa do clique de uma pessoa).

## 28/10/2026 — versão 0.1.0

- Ideia do dono: pegar o som (ou som e vídeo) de qualquer página — reunião, música, áudio do WhatsApp Web.
- Feito: gravar a aba (só som ou som e vídeo), juntar o microfone, relógio no popup, selo REC, parar e
  salvar em `Downloads/Gravacoes`, parada automática ao fechar a aba, página para liberar o microfone.
- Não testado ainda no navegador do dono: carregar `extensao/` e gravar um vídeo e uma reunião de teste.
