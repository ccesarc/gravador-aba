// Lista das gravações guardadas (IndexedDB): ouvir/assistir, renomear, baixar de novo e apagar.
'use strict'

const $ = (id) => document.getElementById(id)
const urls = new Map() // id → URL do arquivo aberto no player

function tamanho(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace('.', ',')} MB`
  return `${(bytes / 1024 ** 3).toFixed(2).replace('.', ',')} GB`
}

function data(ms) {
  return new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

async function urlDe(id) {
  if (!urls.has(id)) urls.set(id, URL.createObjectURL(await Biblioteca.arquivo(id)))
  return urls.get(id)
}

function criar(tag, props = {}, filhos = []) {
  const el = Object.assign(document.createElement(tag), props)
  el.append(...filhos)
  return el
}

// O WebM do MediaRecorder sai sem duração: o player mostra "∞" e não deixa pular. Ir até o fim
// uma vez faz o Chrome descobrir a duração.
function corrigirDuracao(midia) {
  midia.addEventListener('loadedmetadata', () => {
    if (midia.duration !== Infinity) return
    midia.currentTime = 1e101
    midia.addEventListener('timeupdate', () => (midia.currentTime = 0), { once: true })
  })
}

function item(g) {
  const li = criar('li', { className: 'item' })
  const nome = criar('input', { className: 'nome', value: g.nome, title: 'Clique para renomear' })
  nome.setAttribute('aria-label', 'Nome da gravação')
  nome.addEventListener('change', async () => {
    const novo = limparNome(nome.value)
    if (!novo) return (nome.value = g.nome)
    await Biblioteca.renomear(g.id, novo)
    g.nome = nome.value = novo
  })

  const detalhes = criar('p', {
    className: 'nota',
    textContent: `${data(g.criado)} · ${mmss(g.duracaoMs)} · ${tamanho(g.tamanho)} · ${g.video ? 'vídeo ' : ''}${g.ext.toUpperCase()}`,
    title: g.titulo || '',
  })

  const player = criar('div', { className: 'player' })
  const ver = criar('button', { className: 'secundario', textContent: g.video ? '▶ Assistir' : '▶ Ouvir' })
  ver.addEventListener('click', async () => {
    if (player.firstChild) {
      player.replaceChildren()
      ver.textContent = g.video ? '▶ Assistir' : '▶ Ouvir'
      return
    }
    const midia = criar(g.video ? 'video' : 'audio', { controls: true, src: await urlDe(g.id) })
    corrigirDuracao(midia)
    player.append(midia)
    ver.textContent = '✕ Fechar'
    midia.play().catch(() => {})
  })

  const baixar = criar('button', { className: 'secundario', textContent: '⬇ Baixar' })
  baixar.addEventListener('click', async () => {
    await chrome.downloads.download({ url: await urlDe(g.id), filename: `Gravacoes/${g.nome}.${g.ext}` })
  })

  const apagar = criar('button', { className: 'secundario perigo', textContent: '🗑 Apagar' })
  apagar.addEventListener('click', async () => {
    if (!confirm(`Apagar "${g.nome}" da lista? O arquivo em Downloads (se houver) continua lá.`)) return
    await Biblioteca.apagar(g.id)
    if (urls.has(g.id)) URL.revokeObjectURL(urls.get(g.id))
    urls.delete(g.id)
    mostrar()
  })

  li.append(nome, detalhes, criar('div', { className: 'linha' }, [ver, baixar, apagar]), player)
  return li
}

async function mostrar() {
  const lista = await Biblioteca.listar()
  const total = lista.reduce((s, g) => s + g.tamanho, 0)
  $('resumo').textContent = lista.length
    ? `${lista.length} gravaç${lista.length === 1 ? 'ão' : 'ões'} · ${tamanho(total)}`
    : ''
  $('lista').replaceChildren(
    ...(lista.length
      ? lista.map(item)
      : [criar('li', { className: 'nota', textContent: 'Nenhuma gravação ainda. Grave pelo ícone da extensão.' })]),
  )
}

lerConfig().then((c) => ($('baixarAuto').checked = c.baixarAuto))
$('baixarAuto').addEventListener('change', (e) => salvarConfig({ baixarAuto: e.target.checked }))

// Gravação nova terminou com esta página aberta: atualiza a lista.
chrome.storage.session.onChanged.addListener((mudou) => {
  if (mudou.gravando?.newValue === false) mostrar()
})
mostrar()
