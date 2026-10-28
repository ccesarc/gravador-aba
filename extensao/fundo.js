// Service worker: guarda o estado da gravação, abre o documento escondido (offscreen) que de fato
// grava, mostra o tempo no ícone, atende os atalhos de teclado e baixa o arquivo no fim. O popup
// (ou o atalho) pede; o offscreen grava; aqui só coordena.
'use strict'

importScripts('comum.js')

const OFFSCREEN = 'offscreen.html'
const COR_REC = '#ea4335'
const COR_PAUSA = '#f9ab00'

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

function avisarOffscreen(tipo) {
  return chrome.runtime.sendMessage({ alvo: 'offscreen', tipo })
}

async function selo(texto, cor = COR_REC) {
  await chrome.action.setBadgeText({ text: texto })
  if (texto) await chrome.action.setBadgeBackgroundColor({ color: cor })
}

// Tempo curto para caber no ícone: 0:42, 9:59, 12m, 2h.
function textoSelo(ms) {
  const s = Math.floor(ms / 1000)
  if (s < 600) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const m = Math.floor(s / 60)
  return m < 100 ? `${m}m` : `${Math.floor(m / 60)}h`
}

async function marcarParado(extra = {}) {
  await chrome.storage.session.set({ gravando: false, pausadoEm: 0, pausadoTotal: 0, ...extra })
  await selo(extra.ultimoErro ? '!' : '')
}

// Erro sem popup aberto (atalho, escolha da tela): guarda para o popup e mostra "!" no ícone.
async function avisarErro(e) {
  await chrome.storage.session.set({ ultimoErro: String(e?.message || e) })
  const { gravando } = await chrome.storage.session.get('gravando')
  if (!gravando) await selo('!')
}

async function iniciarGravacao(dados) {
  const { gravando } = await chrome.storage.session.get('gravando')
  if (gravando) throw new Error('Já existe uma gravação em andamento.')
  await abrirOffscreen()
  const r = await chrome.runtime.sendMessage({ alvo: 'offscreen', tipo: 'iniciar', ...dados })
  if (!r?.ok) {
    await fecharOffscreen()
    throw new Error(r?.erro || 'Não consegui começar a gravar.')
  }
  await chrome.storage.session.set({
    gravando: true,
    inicio: Date.now(),
    pausadoEm: 0,
    pausadoTotal: 0,
    titulo: dados.titulo,
    video: dados.video,
    tabId: dados.tabId,
  })
  await selo('0:00')
}

async function parar() {
  if (await temOffscreen()) await avisarOffscreen('parar')
  else await marcarParado()
}

async function pausar() {
  const st = await chrome.storage.session.get(['gravando', 'pausadoEm'])
  if (!st.gravando || st.pausadoEm) return
  await avisarOffscreen('pausar')
  await chrome.storage.session.set({ pausadoEm: Date.now() })
  await selo('II', COR_PAUSA)
}

async function continuar() {
  const st = await chrome.storage.session.get(['gravando', 'pausadoEm', 'pausadoTotal'])
  if (!st.gravando || !st.pausadoEm) return
  await avisarOffscreen('continuar')
  await chrome.storage.session.set({ pausadoEm: 0, pausadoTotal: (st.pausadoTotal || 0) + Date.now() - st.pausadoEm })
}

// Tela inteira ou janela: o Chrome mostra a própria janela de escolha. Sem aba: o id vale para a
// extensão (o offscreen). Cancelou = id vazio, sem erro.
function escolherTela() {
  return new Promise((ok) =>
    chrome.desktopCapture.chooseDesktopMedia(['screen', 'window', 'audio'], (id, opcoes) =>
      ok({ id, somTela: !!opcoes?.canRequestAudioTrack }),
    ),
  )
}

async function gravarTela({ microfone, qualidade }) {
  const { gravando } = await chrome.storage.session.get('gravando')
  if (gravando) throw new Error('Já existe uma gravação em andamento.')
  const { id, somTela } = await escolherTela()
  if (!id) return
  await iniciarGravacao({ streamId: id, tela: true, somTela, video: true, microfone, qualidade, titulo: 'Tela' })
}

// Grava com as últimas escolhas do popup (usado pelo atalho de teclado).
async function gravarComConfig(aba) {
  const config = await lerConfig()
  if (config.microfone && !(await microfoneLiberado())) {
    await chrome.tabs.create({ url: 'microfone.html' })
    return
  }
  if (config.modo === 'tela') return gravarTela(config)
  if (!podeGravar(aba)) throw new Error('Esta aba não pode ser gravada (páginas internas do Chrome).')
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: aba.id })
  await iniciarGravacao({
    streamId,
    video: config.modo === 'video',
    microfone: config.microfone,
    qualidade: config.qualidade,
    formato: config.formato,
    tabId: aba.id,
    titulo: aba.title,
  })
}

chrome.runtime.onMessage.addListener((msg, de, responder) => {
  if (msg?.alvo !== 'fundo' || !daExtensao(de)) return
  ;(async () => {
    switch (msg.tipo) {
      case 'iniciar':
        await iniciarGravacao(msg.dados)
        return { ok: true }
      // O popup fecha quando a janela de escolha da tela abre: erro vai para o "!" do ícone.
      case 'gravarTela':
        gravarTela(msg.dados).catch(avisarErro)
        return { ok: true }
      case 'parar':
        await parar()
        return { ok: true }
      case 'pausar':
        await pausar()
        return { ok: true }
      case 'continuar':
        await continuar()
        return { ok: true }
      case 'tique': {
        const { gravando, pausadoEm } = await chrome.storage.session.get(['gravando', 'pausadoEm'])
        if (gravando && !pausadoEm) await selo(textoSelo(msg.ms))
        return { ok: true }
      }
      // O offscreen terminou: baixa o arquivo (se a pessoa quiser) e fecha o documento escondido.
      case 'pronto': {
        const { baixarAuto } = await lerConfig()
        try {
          if (baixarAuto)
            await chrome.downloads.download({ url: msg.url, filename: `Gravacoes/${msg.nome}.${msg.ext}`, saveAs: false })
        } finally {
          await marcarParado(msg.aviso ? { ultimoErro: msg.aviso } : {})
          // Dá tempo do download ler o arquivo antes de liberar a memória.
          setTimeout(fecharOffscreen, baixarAuto ? 5000 : 500)
        }
        return { ok: true }
      }
      case 'falhou':
        await marcarParado({ ultimoErro: msg.erro })
        await fecharOffscreen()
        return { ok: true }
    }
    return { ok: false, erro: 'Pedido desconhecido.' }
  })().then(responder, (e) => responder({ ok: false, erro: String(e?.message || e) }))
  return true // resposta assíncrona
})

// Atalhos de teclado (chrome://extensions/shortcuts). O erro aparece no popup e o ícone mostra "!".
chrome.commands.onCommand.addListener(async (comando, aba) => {
  try {
    if (comando === 'desenhar') {
      if (!podeGravar(aba)) throw new Error('Não dá para desenhar nesta página (páginas internas do Chrome).')
      await alternarDesenho(aba.id)
      return
    }
    const st = await chrome.storage.session.get(['gravando', 'pausadoEm'])
    if (comando === 'pausar' && st.gravando) await (st.pausadoEm ? continuar() : pausar())
    if (comando === 'gravar-parar') await (st.gravando ? parar() : gravarComConfig(aba))
  } catch (e) {
    await avisarErro(e)
  }
})

// Aba fechada no meio da gravação: para e salva o que já tem.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { gravando, tabId: gravandoAba } = await chrome.storage.session.get(['gravando', 'tabId'])
  if (gravando && gravandoAba === tabId && (await temOffscreen())) avisarOffscreen('parar')
})

// Extensão recarregada/navegador reaberto: nada está gravando.
chrome.runtime.onStartup.addListener(() => marcarParado())
chrome.runtime.onInstalled.addListener(({ reason }) => {
  marcarParado()
  if (reason === 'install') chrome.tabs.create({ url: 'ajuda.html' }) // primeira vez: como usar
})
