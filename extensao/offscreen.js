// Documento escondido que grava de verdade: pega o som (e o vídeo) da aba pelo id que o popup
// conseguiu com chrome.tabCapture, mistura o microfone se pedido, toca o som da aba de volta (a
// captura cala a aba) e grava com o MediaRecorder do próprio Chrome. Nada sai do computador.
'use strict'

let gravador = null
let pedacos = []
let fluxos = []
let audio = null
let urlFinal = null

const TIPOS_VIDEO = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
const TIPOS_AUDIO = ['audio/webm;codecs=opus', 'audio/webm']

function escolherTipo(lista) {
  return lista.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

function soltarTudo() {
  for (const f of fluxos) f.getTracks().forEach((t) => t.stop())
  fluxos = []
  if (audio) audio.close().catch(() => {})
  audio = null
}

async function iniciar({ streamId, video, microfone }) {
  const fonte = { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }
  const aba = await navigator.mediaDevices.getUserMedia({
    audio: fonte,
    video: video
      ? { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId, maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30 } }
      : false,
  })
  fluxos.push(aba)

  audio = new AudioContext()
  const destino = audio.createMediaStreamDestination()
  if (aba.getAudioTracks().length) {
    const somAba = audio.createMediaStreamSource(aba)
    somAba.connect(destino)
    somAba.connect(audio.destination) // a pessoa continua ouvindo a aba
  }
  if (microfone) {
    // A permissão do microfone já foi dada na página microfone.html (aqui não aparece pergunta).
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    fluxos.push(mic)
    audio.createMediaStreamSource(mic).connect(destino) // não toca de volta: daria eco
  }

  const final = new MediaStream([...destino.stream.getAudioTracks(), ...aba.getVideoTracks()])
  const tipo = escolherTipo(video ? TIPOS_VIDEO : TIPOS_AUDIO)
  gravador = new MediaRecorder(final, {
    mimeType: tipo || undefined,
    audioBitsPerSecond: 128_000,
    videoBitsPerSecond: video ? 2_500_000 : undefined,
  })
  pedacos = []
  gravador.ondataavailable = (e) => e.data.size && pedacos.push(e.data)
  gravador.onstop = terminar
  gravador.onerror = (e) => falhar(e.error?.message || 'erro do gravador')
  // A aba parou de mandar imagem/som (navegou, fechou): encerra e salva o que tem.
  aba.getTracks().forEach((t) => (t.onended = () => parar()))
  gravador.start(1000) // um pedaço por segundo: perde pouco se algo der errado
}

function parar() {
  if (gravador && gravador.state !== 'inactive') gravador.stop()
}

async function terminar() {
  const tipo = gravador?.mimeType || 'audio/webm'
  const blob = new Blob(pedacos, { type: tipo })
  pedacos = []
  gravador = null
  soltarTudo()
  if (urlFinal) URL.revokeObjectURL(urlFinal)
  urlFinal = URL.createObjectURL(blob)
  await chrome.runtime.sendMessage({ alvo: 'fundo', tipo: 'pronto', url: urlFinal, ext: 'webm' })
}

function falhar(erro) {
  soltarTudo()
  gravador = null
  chrome.runtime.sendMessage({ alvo: 'fundo', tipo: 'falhou', erro })
}

chrome.runtime.onMessage.addListener((msg, _de, responder) => {
  if (msg?.alvo !== 'offscreen') return
  if (msg.tipo === 'iniciar') {
    iniciar(msg).then(
      () => responder({ ok: true }),
      (e) => {
        soltarTudo()
        responder({ ok: false, erro: mensagem(e) })
      },
    )
    return true
  }
  if (msg.tipo === 'parar') {
    parar()
    responder({ ok: true })
  }
})

function mensagem(e) {
  const n = e?.name || ''
  if (n === 'NotAllowedError') return 'Permissão negada (microfone ou captura da aba).'
  if (n === 'NotFoundError') return 'Nenhum microfone encontrado.'
  return String(e?.message || e)
}
