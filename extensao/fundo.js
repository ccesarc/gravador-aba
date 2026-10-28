// Service worker: guarda o estado da gravação, abre o documento escondido (offscreen) que de fato
// grava e baixa o arquivo no fim. O popup pede; o offscreen grava; aqui só coordena.
'use strict'

const OFFSCREEN = 'offscreen.html'

async function temOffscreen() {
  const ctx = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
  return ctx.length > 0
}

async function abrirOffscreen() {
  if (await temOffscreen()) return
  await chrome.offscreen.createDocument({
    url: OFFSCREEN,
    reasons: ['USER_MEDIA'],
    justification: 'Gravar o som e o vídeo da aba que o usuário escolheu.',
  })
}

async function fecharOffscreen() {
  if (await temOffscreen()) await chrome.offscreen.closeDocument()
}

async function marcar(gravando, extra = {}) {
  await chrome.storage.session.set({ gravando, ...extra })
  await chrome.action.setBadgeText({ text: gravando ? 'REC' : '' })
  if (gravando) await chrome.action.setBadgeBackgroundColor({ color: '#ea4335' })
}

// Nome do arquivo: título da aba (limpo) + data e hora.
function nomeArquivo(titulo, ext) {
  const limpo = (titulo || 'gravacao')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'gravacao'
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const quando = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}h${p(d.getMinutes())}`
  return `Gravacoes/${limpo}-${quando}.${ext}`
}

chrome.runtime.onMessage.addListener((msg, _de, responder) => {
  if (msg?.alvo !== 'fundo') return
  ;(async () => {
    switch (msg.tipo) {
      case 'iniciar': {
        const { gravando } = await chrome.storage.session.get('gravando')
        if (gravando) throw new Error('Já existe uma gravação em andamento.')
        await abrirOffscreen()
        const r = await chrome.runtime.sendMessage({ alvo: 'offscreen', tipo: 'iniciar', ...msg.dados })
        if (!r?.ok) {
          await fecharOffscreen()
          throw new Error(r?.erro || 'Não consegui começar a gravar.')
        }
        await marcar(true, { inicio: Date.now(), titulo: msg.dados.titulo, video: msg.dados.video, tabId: msg.dados.tabId })
        return { ok: true }
      }
      case 'parar': {
        if (await temOffscreen()) await chrome.runtime.sendMessage({ alvo: 'offscreen', tipo: 'parar' })
        else await marcar(false)
        return { ok: true }
      }
      // O offscreen terminou: baixa o arquivo e fecha o documento escondido.
      case 'pronto': {
        const { titulo } = await chrome.storage.session.get('titulo')
        try {
          await chrome.downloads.download({ url: msg.url, filename: nomeArquivo(titulo, msg.ext), saveAs: false })
        } finally {
          await marcar(false)
          // Dá tempo do download ler o arquivo antes de liberar a memória.
          setTimeout(fecharOffscreen, 5000)
        }
        return { ok: true }
      }
      case 'falhou': {
        await marcar(false, { ultimoErro: msg.erro })
        await fecharOffscreen()
        return { ok: true }
      }
    }
    return { ok: false, erro: 'Pedido desconhecido.' }
  })().then(responder, (e) => responder({ ok: false, erro: String(e?.message || e) }))
  return true // resposta assíncrona
})

// Aba fechada no meio da gravação: para e salva o que já tem.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gravando, tabId: gravandoAba } = await chrome.storage.session.get(['gravando', 'tabId'])
  if (gravando && gravandoAba === tabId && (await temOffscreen()))
    chrome.runtime.sendMessage({ alvo: 'offscreen', tipo: 'parar' })
})

// Extensão recarregada/navegador reaberto: nada está gravando.
chrome.runtime.onStartup.addListener(() => marcar(false))
chrome.runtime.onInstalled.addListener(() => marcar(false))
