// Documento escondido que grava de verdade: pega o som (e o vídeo) da aba pelo id que o popup
// conseguiu com chrome.tabCapture, mistura o microfone se pedido, toca o som da aba de volta (a
// captura cala a aba) e grava. WebM: MediaRecorder do próprio Chrome. MP3: AudioWorklet
// (captura.js) + lamejs, codificando enquanto grava. No fim guarda na lista (IndexedDB) e avisa o
// fundo.js. Nada sai do computador.
'use strict'

let gravador = null // MediaRecorder (WebM)
let mp3 = null // { codificador, no } quando o formato é MP3
let pedacos = []
let fluxos = []
let audio = null
let urlFinal = null
let info = null // { titulo, video, ext } da gravação atual
let relogio = { inicio: 0, pausadoEm: 0, pausadoTotal: 0 }
let tique = null

const TIPOS_VIDEO = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
const TIPOS_AUDIO = ['audio/webm;codecs=opus', 'audio/webm']

function escolherTipo(lista) {
  return lista.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

function soltarTudo() {
  clearInterval(tique)
  for (const f of fluxos) f.getTracks().forEach((t) => t.stop())
  fluxos = []
  if (audio) audio.close().catch(() => {})
  audio = null
}

// tela: id do chrome.desktopCapture (tela inteira ou janela); somTela: a pessoa liberou o som do
// computador (só existe no Windows/ChromeOS). Sem tela: id do chrome.tabCapture (a aba).
async function iniciar({ streamId, tela, somTela, video, microfone, qualidade, formato, titulo }) {
  const q = QUALIDADES[qualidade] || QUALIDADES.normal
  const comMp3 = !video && formato === 'mp3'
  const fonte = { chromeMediaSource: tela ? 'desktop' : 'tab', chromeMediaSourceId: streamId }
  const aba = await navigator.mediaDevices.getUserMedia({
    audio: !tela || somTela ? { mandatory: fonte } : false,
    video: video
      ? { mandatory: { ...fonte, maxWidth: q.largura, maxHeight: q.altura, maxFrameRate: q.fps } }
      : false,
  })
  fluxos.push(aba)

  // 48 kHz fixo: o MP3 não aceita taxas maiores (algumas placas de som usam 96 kHz).
  audio = new AudioContext({ sampleRate: 48000 })
  const mistura = audio.createGain()
  if (aba.getAudioTracks().length) {
    const somAba = audio.createMediaStreamSource(aba)
    somAba.connect(mistura)
    // A captura da aba cala a aba: toca de volta para a pessoa continuar ouvindo. A da tela não
    // cala nada (tocar de volta daria som dobrado).
    if (!tela) somAba.connect(audio.destination)
  }
  if (microfone) {
    // A permissão do microfone já foi dada na página microfone.html (aqui não aparece pergunta).
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    fluxos.push(mic)
    audio.createMediaStreamSource(mic).connect(mistura) // não toca de volta: daria eco
  }

  pedacos = []
  info = { titulo, video, ext: comMp3 ? 'mp3' : 'webm' }
  if (comMp3) await iniciarMp3(mistura, q.audioKbps)
  else iniciarWebm(mistura, aba, video, q)

  // A aba parou de mandar imagem/som (navegou, fechou): encerra e salva o que tem.
  aba.getTracks().forEach((t) => (t.onended = () => parar()))
  relogio = { inicio: Date.now(), pausadoEm: 0, pausadoTotal: 0 }
  // O fundo.js usa para mostrar o tempo no ícone.
  tique = setInterval(
    () => chrome.runtime.sendMessage({ alvo: 'fundo', tipo: 'tique', ms: decorrido(relogio) }).catch(() => {}),
    1000,
  )
}

function iniciarWebm(mistura, aba, video, q) {
  const destino = audio.createMediaStreamDestination()
  mistura.connect(destino)
  const final = new MediaStream([...destino.stream.getAudioTracks(), ...aba.getVideoTracks()])
  const tipo = escolherTipo(video ? TIPOS_VIDEO : TIPOS_AUDIO)
  gravador = new MediaRecorder(final, {
    mimeType: tipo || undefined,
    audioBitsPerSecond: q.audioKbps * 1000,
    videoBitsPerSecond: video ? q.videoBps : undefined,
  })
  gravador.ondataavailable = (e) => e.data.size && pedacos.push(e.data)
  gravador.onstop = terminar
  gravador.onerror = (e) => falhar(e.error?.message || 'erro do gravador')
  gravador.start(1000) // um pedaço por segundo: perde pouco se algo der errado
}

async function iniciarMp3(mistura, kbps) {
  await audio.audioWorklet.addModule('captura.js')
  const no = new AudioWorkletNode(audio, 'captura', {
    channelCount: 2,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  })
  const codificador = new lamejs.Mp3Encoder(2, audio.sampleRate, kbps)
  no.port.onmessage = ({ data: [esq, dir] }) => {
    if (relogio.pausadoEm) return
    const parte = codificador.encodeBuffer(paraInt16(esq), paraInt16(dir))
    if (parte.length) pedacos.push(parte)
  }
  mistura.connect(no)
  // Ligado a uma saída muda para o Chrome não deixar o nó parado.
  const mudo = audio.createGain()
  mudo.gain.value = 0
  no.connect(mudo).connect(audio.destination)
  mp3 = { codificador, no }
}

function paraInt16(f) {
  const r = new Int16Array(f.length)
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]))
    r[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return r
}

function pausar() {
  if (relogio.pausadoEm) return
  if (gravador?.state === 'recording') gravador.pause()
  relogio.pausadoEm = Date.now()
}

function continuar() {
  if (!relogio.pausadoEm) return
  if (gravador?.state === 'paused') gravador.resume()
  relogio.pausadoTotal += Date.now() - relogio.pausadoEm
  relogio.pausadoEm = 0
}

function parar() {
  if (gravador && gravador.state !== 'inactive') gravador.stop() // chama terminar()
  else if (mp3) {
    const { codificador, no } = mp3
    mp3 = null
    no.port.onmessage = null
    pedacos.push(codificador.flush())
    terminar()
  }
}

async function terminar() {
  const tipo = info.ext === 'mp3' ? 'audio/mpeg' : gravador?.mimeType || (info.video ? 'video/webm' : 'audio/webm')
  const blob = new Blob(pedacos, { type: tipo })
  const duracaoMs = decorrido(relogio)
  pedacos = []
  gravador = null
  soltarTudo()

  const nome = nomeArquivo(info.titulo)
  let aviso = ''
  try {
    await Biblioteca.salvar(
      { nome, titulo: info.titulo, ext: info.ext, tipo, video: info.video, tamanho: blob.size, duracaoMs, criado: Date.now() },
      blob,
    )
  } catch (e) {
    aviso = `A gravação não coube na lista (${e?.message || e}). O arquivo baixado continua valendo.`
  }
  if (urlFinal) URL.revokeObjectURL(urlFinal)
  urlFinal = URL.createObjectURL(blob)
  await chrome.runtime.sendMessage({ alvo: 'fundo', tipo: 'pronto', url: urlFinal, nome, ext: info.ext, aviso })
}

function falhar(erro) {
  soltarTudo()
  gravador = null
  mp3 = null
  chrome.runtime.sendMessage({ alvo: 'fundo', tipo: 'falhou', erro })
}

chrome.runtime.onMessage.addListener((msg, de, responder) => {
  if (msg?.alvo !== 'offscreen' || !daExtensao(de)) return
  if (msg.tipo === 'iniciar') {
    iniciar(msg).then(
      () => responder({ ok: true }),
      (e) => {
        soltarTudo()
        gravador = null
        mp3 = null
        responder({ ok: false, erro: mensagem(e) })
      },
    )
    return true
  }
  const acoes = { parar, pausar, continuar }
  if (acoes[msg.tipo]) {
    acoes[msg.tipo]()
    responder({ ok: true })
  }
})

function mensagem(e) {
  const n = e?.name || ''
  if (n === 'NotAllowedError') return 'Permissão negada (microfone ou captura da aba).'
  if (n === 'NotFoundError') return 'Nenhum microfone encontrado.'
  return String(e?.message || e)
}
