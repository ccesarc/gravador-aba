// Popup: escolhe o que gravar, mostra o tempo e pausa/para. O id da captura (tabCapture) precisa
// sair daqui, do clique da pessoa; quem grava é o offscreen (o popup fecha e a gravação continua).
// As escolhas ficam guardadas e valem também para o atalho de teclado.
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

function modoEscolhido() {
  return document.querySelector('input[name=modo]:checked')?.value || 'audio'
}

// Formato só vale para "só o som"; a qualidade mostra o que muda em cada modo.
function ajustarOpcoes() {
  const modo = modoEscolhido()
  const video = modo !== 'audio'
  $('campoFormato').hidden = video
  $('notaTela').hidden = modo !== 'tela'
  $('gravar').textContent = modo === 'tela' ? '● Escolher e gravar' : '● Gravar esta aba'
  for (const op of $('qualidade').options) {
    const q = QUALIDADES[op.value]
    op.textContent = `${q.nome} · ${video ? q.resumo : `${q.audioKbps} kbps`}`
  }
}

async function carregarConfig() {
  const c = await lerConfig()
  document.querySelector(`input[name=modo][value=${c.modo}]`).checked = true
  $('qualidade').value = c.qualidade
  $('formato').value = c.formato
  $('microfone').checked = c.microfone
  ajustarOpcoes()
}

function guardarConfig() {
  ajustarOpcoes()
  salvarConfig({
    modo: modoEscolhido(),
    qualidade: $('qualidade').value,
    formato: $('formato').value,
    microfone: $('microfone').checked,
  })
}

async function atualizar() {
  const st = await chrome.storage.session.get(['gravando', 'inicio', 'pausadoEm', 'pausadoTotal', 'titulo', 'ultimoErro'])
  $('parado').hidden = !!st.gravando
  $('gravando').hidden = !st.gravando
  clearInterval(relogio)
  if (st.gravando) {
    $('abaGravando').textContent = st.titulo || ''
    $('estado').textContent = st.pausadoEm ? 'Pausado' : 'Gravando'
    $('estado').classList.toggle('pausado', !!st.pausadoEm)
    $('pausar').textContent = st.pausadoEm ? '▶ Continuar' : '❚❚ Pausar'
    const tic = () => ($('tempo').textContent = mmss(decorrido(st)))
    tic()
    if (!st.pausadoEm) relogio = setInterval(tic, 500)
  } else {
    const aba = await abaAtual()
    $('aba').textContent = aba?.title || ''
  }
  if (st.ultimoErro) {
    mostrarErro(st.ultimoErro)
    chrome.storage.session.remove('ultimoErro')
    if (!st.gravando) chrome.action.setBadgeText({ text: '' })
  }
}

async function mostrarAtalhos() {
  const nomes = { 'gravar-parar': 'gravar/parar', pausar: 'pausar', desenhar: 'desenhar' }
  const lista = (await chrome.commands.getAll()).filter((c) => nomes[c.name] && c.shortcut)
  const el = $('atalhos')
  el.textContent = lista.length ? `Atalhos: ${lista.map((c) => `${c.shortcut} ${nomes[c.name]}`).join(' · ')} · ` : ''
  const mudar = document.createElement('a')
  mudar.href = '#'
  mudar.textContent = lista.length ? 'mudar' : 'Configurar atalhos de teclado'
  mudar.addEventListener('click', (e) => {
    e.preventDefault()
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })
  })
  el.append(mudar)
}

$('gravar').addEventListener('click', async () => {
  mostrarErro('')
  const aba = await abaAtual()
  const modo = modoEscolhido()
  if (modo !== 'tela' && !podeGravar(aba)) {
    mostrarErro('Esta aba não pode ser gravada (páginas internas do Chrome). Abra o site e tente de novo.')
    return
  }
  const microfone = $('microfone').checked
  if (microfone && !(await microfoneLiberado())) {
    // A pergunta do microfone só aparece numa página visível.
    chrome.tabs.create({ url: 'microfone.html' })
    return
  }
  if (modo === 'tela') {
    // A janela de escolha do Chrome fecha o popup; o fundo.js segue sozinho.
    await chrome.runtime.sendMessage({
      alvo: 'fundo',
      tipo: 'gravarTela',
      dados: { microfone, qualidade: $('qualidade').value },
    })
    window.close()
    return
  }
  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: aba.id })
    const r = await chrome.runtime.sendMessage({
      alvo: 'fundo',
      tipo: 'iniciar',
      dados: {
        streamId,
        video: modo === 'video',
        microfone,
        qualidade: $('qualidade').value,
        formato: $('formato').value,
        tabId: aba.id,
        titulo: aba.title,
      },
    })
    if (!r?.ok) throw new Error(r?.erro)
    atualizar()
  } catch (e) {
    mostrarErro(String(e?.message || e || 'Não consegui gravar.'))
  }
})

$('pausar').addEventListener('click', async () => {
  const { pausadoEm } = await chrome.storage.session.get('pausadoEm')
  await chrome.runtime.sendMessage({ alvo: 'fundo', tipo: pausadoEm ? 'continuar' : 'pausar' })
})

$('parar').addEventListener('click', async () => {
  $('parar').disabled = true
  await chrome.runtime.sendMessage({ alvo: 'fundo', tipo: 'parar' })
  setTimeout(() => {
    $('parar').disabled = false
    atualizar()
  }, 800)
})

$('desenhar').addEventListener('click', async () => {
  mostrarErro('')
  const aba = await abaAtual()
  try {
    if (!podeGravar(aba)) throw new Error('Não dá para desenhar nesta página (páginas internas do Chrome).')
    await alternarDesenho(aba.id)
    window.close()
  } catch (e) {
    mostrarErro(String(e?.message || e))
  }
})

$('lista').addEventListener('click', () => chrome.tabs.create({ url: 'gravacoes.html' }))
$('ajuda').addEventListener('click', () => chrome.tabs.create({ url: 'ajuda.html' }))

for (const el of document.querySelectorAll('#parado input, #parado select')) el.addEventListener('change', guardarConfig)
chrome.storage.session.onChanged.addListener(atualizar)
carregarConfig()
mostrarAtalhos()
atualizar()
