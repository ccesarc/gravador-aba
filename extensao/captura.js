// AudioWorklet do MP3: junta o som em blocos de 4096 amostras (esquerda e direita) e manda para o
// offscreen, que codifica com o lamejs. Roda na thread de áudio do Chrome.
'use strict'

const BLOCO = 4096

class Captura extends AudioWorkletProcessor {
  constructor() {
    super()
    this.novo()
  }

  novo() {
    this.esq = new Float32Array(BLOCO)
    this.dir = new Float32Array(BLOCO)
    this.n = 0
  }

  process([entrada]) {
    const esq = entrada[0]
    if (!esq) return true
    this.esq.set(esq, this.n)
    this.dir.set(entrada[1] || esq, this.n)
    this.n += esq.length
    if (this.n >= BLOCO) {
      this.port.postMessage([this.esq, this.dir], [this.esq.buffer, this.dir.buffer])
      this.novo()
    }
    return true
  }
}

registerProcessor('captura', Captura)
