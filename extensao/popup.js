// Popup: escolhe o que gravar e mostra o tempo. O id da captura (tabCapture) precisa sair daqui,
// do clique da pessoa; quem grava é o offscreen (o popup fecha e a gravação continua).
'use strict'

const $ = (id) => document.getElementById(id)
let relogio

function mostrarErro(msg) {
  $('erro').textContent = msg
  $('erro').hidden = !msg
}

async function abaAtual() {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true })
  return aba
}

function mmss(ms) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const p = (n) => String(n).padStart(2, '0')
  return (h ? `${h}:` : '') + `${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

async function atualizar() {
  const st = await chrome.storage.session.get(['gravando', 'inicio', 'titulo', 'ultimoErro'])
  $('parado').hidden = !!st.gravando
  $('gravando').hidden = !st.gravando
  clearInterval(relogio)
  if (st.gravando) {
    $('abaGravando').textContent = st.titulo || ''
    const tic = () => ($('tempo').textContent = mmss(Date.now() - st.inicio))
    tic()
    relogio = setInterval(tic, 500)
  } else {
    const aba = await abaAtual()
    $('aba').textContent = aba?.title || ''
    if (st.ultimoErro) {
      mostrarErro(st.ultimoErro)
      chrome.storage.session.remove('ultimoErro')
    }
  }
}

async function microfoneLiberado() {
  try {
    const p = await navigator.permissions.query({ name: 'microphone' })
    return p.state === 'granted'
  } catch {
    return false
  }
}

$('gravar').addEventListener('click', async () => {
  mostrarErro('')
  const aba = await abaAtual()
  if (!aba?.id || /^(chrome|edge|about|chrome-extension):/.test(aba.url || '')) {
    mostrarErro('Esta aba não pode ser gravada (páginas internas do Chrome). Abra o site e tente de novo.')
    return
  }
  const microfone = $('microfone').checked
  if (microfone && !(await microfoneLiberado())) {
    // A pergunta do microfone só aparece numa página visível.
    chrome.tabs.create({ url: 'microfone.html' })
    return
  }
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: aba.id })
    const video = document.querySelector('input[name=modo]:checked').value === 'video'
    const r = await chrome.runtime.sendMessage({
      alvo: 'fundo',
      tipo: 'iniciar',
      dados: { streamId, video, microfone, tabId: aba.id, titulo: aba.title },
    })
    if (!r?.ok) throw new Error(r?.erro)
    atualizar()
  } catch (e) {
    mostrarErro(String(e?.message || e || 'Não consegui gravar.'))
  }
})

$('parar').addEventListener('click', async () => {
  $('parar').disabled = true
  await chrome.runtime.sendMessage({ alvo: 'fundo', tipo: 'parar' })
  setTimeout(() => {
    $('parar').disabled = false
    atualizar()
  }, 800)
})

chrome.storage.session.onChanged.addListener(atualizar)
atualizar()
