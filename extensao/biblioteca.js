// Lista das gravações no IndexedDB da extensão (fica só neste computador). Os dados (meta) e o
// arquivo (blob) ficam em lugares separados para listar sem carregar os arquivos.
'use strict'

const Biblioteca = (() => {
  let banco = null

  const pedido = (r) =>
    new Promise((ok, falha) => {
      r.onsuccess = () => ok(r.result)
      r.onerror = () => falha(r.error)
    })
  const fim = (tx) =>
    new Promise((ok, falha) => {
      tx.oncomplete = () => ok()
      tx.onerror = tx.onabort = () => falha(tx.error)
    })

  function abrir() {
    if (!banco) {
      const r = indexedDB.open('gravador', 1)
      r.onupgradeneeded = () => {
        r.result.createObjectStore('meta', { keyPath: 'id', autoIncrement: true })
        r.result.createObjectStore('arquivos')
      }
      banco = pedido(r)
    }
    return banco
  }

  async function salvar(meta, blob) {
    const tx = (await abrir()).transaction(['meta', 'arquivos'], 'readwrite')
    const id = await pedido(tx.objectStore('meta').add(meta))
    tx.objectStore('arquivos').put(blob, id)
    await fim(tx)
    return id
  }

  async function listar() {
    const tx = (await abrir()).transaction('meta')
    const todas = await pedido(tx.objectStore('meta').getAll())
    return todas.sort((a, b) => b.criado - a.criado)
  }

  async function arquivo(id) {
    return pedido((await abrir()).transaction('arquivos').objectStore('arquivos').get(id))
  }

  async function renomear(id, nome) {
    const tx = (await abrir()).transaction('meta', 'readwrite')
    const loja = tx.objectStore('meta')
    const meta = await pedido(loja.get(id))
    loja.put({ ...meta, nome })
    await fim(tx)
  }

  async function apagar(id) {
    const tx = (await abrir()).transaction(['meta', 'arquivos'], 'readwrite')
    tx.objectStore('meta').delete(id)
    tx.objectStore('arquivos').delete(id)
    await fim(tx)
  }

  return { salvar, listar, arquivo, renomear, apagar }
})()
