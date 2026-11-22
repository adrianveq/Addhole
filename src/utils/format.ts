export const fmt = (n: number): string =>
  Number.isFinite(n) ? n.toFixed(2) : "0.00"

export const uid = (tag = "obj"): string =>
  `${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
