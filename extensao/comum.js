// Coisas usadas em mais de um lugar (popup, lista, service worker e offscreen): qualidades,
// configuração guardada, nome do arquivo e a caneta. No offscreen só as constantes são usadas
// (lá não existe chrome.storage).
'use strict'

const QUALIDADES = {
  leve: { nome: 'Leve', audioKbps: 64, largura: 1280, altura: 720, fps: 24, videoBps: 1_200_000, resumo: '720p' },
  normal: { nome: 'Normal', audioKbps: 128, largura: 1920, altura: 1080, fps: 30, videoBps: 2_500_000, resumo: '1080p' },
  alta: { nome: 'Alta', audioKbps: 192, largura: 1920, altura: 1080, fps: 60, videoBps: 6_000_000, resumo: '1080p 60 qps' },
}

const CONFIG_PADRAO = { modo: 'audio', formato: 'webm', qualidade: 'normal', microfone: false, baixarAuto: true }

async function lerConfig() {
  const { config } = await chrome.storage.local.get('config')
  return { ...CONFIG_PADRAO, ...config }
}

async function salvarConfig(parcial) {
  await chrome.storage.local.set({ config: { ...(await lerConfig()), ...parcial } })
}

// Nome do arquivo (sem pasta nem extensão): título da aba (limpo) + data e hora.
function nomeArquivo(titulo) {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const quando = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}h${p(d.getMinutes())}`
  return `${limparNome(titulo) || 'gravacao'}-${quando}`
}

function limparNome(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

function mmss(ms) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const p = (n) => String(n).padStart(2, '0')
  return (h ? `${h}:` : '') + `${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

// Tempo gravado descontando as pausas (estado guardado em chrome.storage.session pelo fundo.js).
function decorrido(st) {
  return (st.pausadoEm || Date.now()) - st.inicio - (st.pausadoTotal || 0)
}

// Só aceita pedidos das páginas da própria extensão (popup, lista, offscreen); nunca de um site
// nem do desenho.js injetado nas páginas (lá o endereço é o do site).
function daExtensao(de) {
  return de?.id === chrome.runtime.id && (de.url || '').startsWith(chrome.runtime.getURL(''))
}

function podeGravar(aba) {
  return !!aba?.id && !/^(chrome|edge|about|chrome-extension|devtools):/.test(aba.url || '')
}

async function microfoneLiberado() {
  try {
    return (await navigator.permissions.query({ name: 'microphone' })).state === 'granted'
  } catch {
    return false
  }
}

// Liga/desliga a caneta na aba (desenho.js fecha se já estiver aberto).
async function alternarDesenho(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['desenho.js'] })
}
