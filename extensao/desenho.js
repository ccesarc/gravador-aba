// Caneta por cima da página: desenha numa camada transparente (canvas) que cobre a tela. Se a aba
// estiver sendo gravada com vídeo, o desenho entra na gravação. Injetado pelo popup ou pelo atalho;
// injetar de novo fecha. Estilos por CSSStyleSheet construída (o CSP do site não bloqueia).
;(() => {
  'use strict'
  if (window.__gravadorDesenho) return window.__gravadorDesenho.fechar()

  const CORES = ['#ea4335', '#fbbc04', '#34a853', '#4285f4', '#ffffff', '#202124']
  const FERRAMENTAS = [
    ['caneta', '✎', 'Caneta (C)', 'c'],
    ['marca', '▍', 'Marca-texto (M)', 'm'],
    ['seta', '➚', 'Seta (S)', 's'],
    ['retangulo', '▢', 'Retângulo (R)', 'r'],
    ['mouse', '☝', 'Mexer na página sem apagar o desenho (U)', 'u'],
  ]
  let ferramenta = 'caneta'
  let cor = CORES[0]
  const tracos = [] // tudo o que foi desenhado, para redesenhar ao mudar o tamanho e desfazer
  let atual = null

  const host = document.createElement('div')
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;'
  const raiz = host.attachShadow({ mode: 'closed' })
  const css = `
    canvas { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: auto; cursor: crosshair; touch-action: none; }
    canvas.solto { pointer-events: none; }
    .barra { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); pointer-events: auto;
      display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-radius: 12px;
      background: #202124; color: #e8eaed; box-shadow: 0 4px 16px rgba(0,0,0,.35);
      font: 14px/1 system-ui, sans-serif; user-select: none; }
    button { all: unset; box-sizing: border-box; min-width: 30px; height: 30px; padding: 0 6px; border-radius: 8px;
      display: grid; place-items: center; cursor: pointer; font-size: 16px; color: inherit; }
    button:hover { background: #3c4043; }
    button:focus-visible { outline: 2px solid #8ab4f8; }
    button.ativo { background: #ea4335; color: #fff; }
    .cor { min-width: 22px; width: 22px; height: 22px; padding: 0; border-radius: 50%; border: 2px solid #5f6368; }
    .cor.ativo { border-color: #fff; outline: 2px solid #ea4335; }
    .sep { width: 1px; height: 22px; background: #5f6368; margin: 0 4px; }
    .alca { cursor: grab; color: #9aa0a6; font-size: 14px; padding: 0 2px; }
  `
  try {
    const folha = new CSSStyleSheet()
    folha.replaceSync(css)
    raiz.adoptedStyleSheets = [folha]
  } catch {
    const s = document.createElement('style')
    s.textContent = css
    raiz.append(s)
  }

  const tela = document.createElement('canvas')
  const c = tela.getContext('2d')
  const barra = document.createElement('div')
  barra.className = 'barra'
  barra.setAttribute('role', 'toolbar')
  barra.setAttribute('aria-label', 'Desenhar na tela')
  raiz.append(tela, barra)

  function botao(texto, titulo, acao, classe = '') {
    const b = document.createElement('button')
    b.textContent = texto
    b.title = titulo
    b.setAttribute('aria-label', titulo)
    b.className = classe
    b.addEventListener('click', acao)
    barra.append(b)
    return b
  }
  const separador = () => barra.append(Object.assign(document.createElement('span'), { className: 'sep' }))

  const alca = document.createElement('span')
  alca.className = 'alca'
  alca.textContent = '⠿'
  alca.title = 'Arrastar a barra'
  barra.append(alca)

  const botoesFerramenta = {}
  for (const [id, icone, titulo] of FERRAMENTAS) botoesFerramenta[id] = botao(icone, titulo, () => escolher(id))
  separador()
  const botoesCor = CORES.map((valor) => {
    const b = botao('', `Cor ${valor}`, () => escolherCor(valor), 'cor')
    b.style.background = valor
    return b
  })
  separador()
  botao('↶', 'Desfazer (Ctrl+Z)', desfazer)
  botao('🗑', 'Apagar tudo (Delete)', limpar)
  botao('✕', 'Fechar a caneta (Esc)', fechar)

  function escolher(id) {
    ferramenta = id
    for (const [k, b] of Object.entries(botoesFerramenta)) b.classList.toggle('ativo', k === id)
    tela.classList.toggle('solto', id === 'mouse')
  }

  function escolherCor(valor) {
    cor = valor
    botoesCor.forEach((b, i) => b.classList.toggle('ativo', CORES[i] === valor))
    if (ferramenta === 'mouse') escolher('caneta')
  }

  function ajustarTamanho() {
    const dpr = window.devicePixelRatio || 1
    tela.width = Math.round(innerWidth * dpr)
    tela.height = Math.round(innerHeight * dpr)
    c.setTransform(dpr, 0, 0, dpr, 0, 0)
    redesenhar()
  }

  function desenharTraco(t) {
    const p = t.pontos
    c.save()
    c.strokeStyle = c.fillStyle = t.cor
    c.lineCap = c.lineJoin = 'round'
    c.lineWidth = t.tipo === 'marca' ? 22 : 4
    if (t.tipo === 'marca') c.globalAlpha = 0.35
    if (t.tipo === 'caneta' || t.tipo === 'marca') {
      c.beginPath()
      c.moveTo(p[0].x, p[0].y)
      for (const q of p.slice(1)) c.lineTo(q.x, q.y)
      if (p.length === 1) c.lineTo(p[0].x + 0.1, p[0].y)
      c.stroke()
    } else if (p.length > 1) {
      const [a, b] = [p[0], p[p.length - 1]]
      if (t.tipo === 'retangulo') c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y)
      else {
        const ang = Math.atan2(b.y - a.y, b.x - a.x)
        const ponta = 18
        c.beginPath()
        c.moveTo(a.x, a.y)
        c.lineTo(b.x - Math.cos(ang) * ponta * 0.6, b.y - Math.sin(ang) * ponta * 0.6)
        c.stroke()
        c.beginPath()
        c.moveTo(b.x, b.y)
        c.lineTo(b.x - ponta * Math.cos(ang - 0.45), b.y - ponta * Math.sin(ang - 0.45))
        c.lineTo(b.x - ponta * Math.cos(ang + 0.45), b.y - ponta * Math.sin(ang + 0.45))
        c.closePath()
        c.fill()
      }
    }
    c.restore()
  }

  function redesenhar() {
    c.clearRect(0, 0, innerWidth, innerHeight)
    tracos.forEach(desenharTraco)
  }

  function desfazer() {
    tracos.pop()
    redesenhar()
  }

  function limpar() {
    tracos.length = 0
    redesenhar()
  }

  tela.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    tela.setPointerCapture(e.pointerId)
    atual = { tipo: ferramenta, cor, pontos: [{ x: e.clientX, y: e.clientY }] }
    tracos.push(atual)
    redesenhar()
  })
  tela.addEventListener('pointermove', (e) => {
    if (!atual) return
    const pt = { x: e.clientX, y: e.clientY }
    if (atual.tipo === 'caneta' || atual.tipo === 'marca') atual.pontos.push(pt)
    else atual.pontos[1] = pt
    redesenhar()
  })
  const soltar = () => (atual = null)
  tela.addEventListener('pointerup', soltar)
  tela.addEventListener('pointercancel', soltar)

  // Arrastar a barra pela alça.
  alca.addEventListener('pointerdown', (e) => {
    alca.setPointerCapture(e.pointerId)
    const r = barra.getBoundingClientRect()
    const dx = e.clientX - r.left
    const dy = e.clientY - r.top
    const mover = (ev) => {
      barra.style.transform = 'none'
      barra.style.left = `${Math.max(0, Math.min(innerWidth - r.width, ev.clientX - dx))}px`
      barra.style.top = `${Math.max(0, Math.min(innerHeight - r.height, ev.clientY - dy))}px`
    }
    const largar = () => {
      alca.removeEventListener('pointermove', mover)
      alca.removeEventListener('pointerup', largar)
    }
    alca.addEventListener('pointermove', mover)
    alca.addEventListener('pointerup', largar)
  })

  // Teclas: Esc fecha sempre; as outras só fora do modo "mexer na página" (para não roubar a digitação).
  function teclas(e) {
    if (e.key === 'Escape') {
      fechar()
    } else if (ferramenta === 'mouse') {
      return
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      desfazer()
    } else if (e.key === 'Delete') {
      limpar()
    } else {
      const f = !e.ctrlKey && !e.metaKey && !e.altKey && FERRAMENTAS.find((x) => x[3] === e.key.toLowerCase())
      if (!f) return
      escolher(f[0])
    }
    e.preventDefault()
    e.stopPropagation()
  }

  function fechar() {
    removeEventListener('keydown', teclas, true)
    removeEventListener('resize', ajustarTamanho)
    host.remove()
    delete window.__gravadorDesenho
  }

  addEventListener('keydown', teclas, true)
  addEventListener('resize', ajustarTamanho)
  document.documentElement.append(host)
  escolher('caneta')
  escolherCor(cor)
  ajustarTamanho()
  window.__gravadorDesenho = { fechar }
})()
