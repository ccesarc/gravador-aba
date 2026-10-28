// Pede a permissão do microfone numa página visível (no popup e no offscreen a pergunta não aparece).
// Depois de permitido, vale para a extensão toda.
'use strict'

const res = document.getElementById('resultado')
document.getElementById('permitir').addEventListener('click', async () => {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true })
    s.getTracks().forEach((t) => t.stop())
    res.textContent = 'Pronto! Pode fechar esta aba e gravar de novo pelo ícone da extensão.'
    res.className = 'nota ok'
  } catch {
    res.textContent =
      'O Chrome bloqueou. Clique no cadeado ao lado do endereço, libere o microfone e tente de novo.'
    res.className = 'nota erro'
  }
})
