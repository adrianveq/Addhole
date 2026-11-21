import * as THREE from "three"
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js"
import { OCCT_CDN } from "../constants/editorConfig"
import { SvgAnalysis, SvgLayerInfo } from "../types/editor"

function pointInPoly(pt: THREE.Vector2, poly: THREE.Vector2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    if (
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi
    ) {
      inside = !inside
    }
  }
  return inside
}

export function analyzeSvg(svgText: string, fileName: string): SvgAnalysis {
  const data = new SVGLoader().parse(svgText)
  const svgEl = new DOMParser()
    .parseFromString(svgText, "image/svg+xml")
    .querySelector("svg")

  let vbX = 0
  let vbY = 0
  let vbW = 100
  let vbH = 100

  if (svgEl) {
    const vb = (svgEl.getAttribute("viewBox") || "")
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
      ;[vbX, vbY, vbW, vbH] = vb
    } else {
      vbW = parseFloat(svgEl.getAttribute("width") || "100") || 100
      vbH = parseFloat(svgEl.getAttribute("height") || "100") || 100
    }
  }

  const groupsMap = new Map<string, SvgLayerInfo>()
  let bgCounter = 0

  data.paths.forEach((path) => {
    const fill = path.userData?.style?.fill
    const fillOpacity = path.userData?.style?.fillOpacity
    if (fill === "none" || fillOpacity === 0 || fillOpacity === "0") return

    const contours: THREE.Vector2[][] = []
    for (const sub of path.subPaths) {
      const clean: THREE.Vector2[] = []
      for (const p of sub.getPoints(16)) {
        const v = new THREE.Vector2(p.x, -p.y)
        if (!clean.length || clean[clean.length - 1].distanceToSquared(v) > 1e-6) {
          clean.push(v)
        }
      }
      if (
        clean.length > 2 &&
        clean[0].distanceToSquared(clean[clean.length - 1]) < 1e-6
      ) {
        clean.pop()
      }
      if (clean.length >= 3) contours.push(clean)
    }
    if (!contours.length) return

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (const c of contours) {
      for (const p of c) {
        minX = Math.min(minX, p.x)
        maxX = Math.max(maxX, p.x)
        minY = Math.min(minY, p.y)
        maxY = Math.max(maxY, p.y)
      }
    }

    const area = (maxX - minX) * (maxY - minY)
    const isBg =
      contours.length === 1 &&
      contours[0].length <= 5 &&
      vbW * vbH > 0 &&
      area / (vbW * vbH) >= 0.85

    const colorStr = path.color
      ? `#${path.color.getHexString().toUpperCase()}`
      : "#1E293B"
    const key = isBg ? `bg_${++bgCounter}` : `col_${colorStr}`

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        id: key,
        name: isBg ? `Background (${colorStr})` : `Color ${colorStr}`,
        color: colorStr,
        isBg,
        included: !isBg,
        contours: [],
        bounds: {
          minX: Infinity,
          maxX: -Infinity,
          minY: Infinity,
          maxY: -Infinity,
        },
      })
    }

    const g = groupsMap.get(key)!
    g.contours.push(...contours)
    g.bounds.minX = Math.min(g.bounds.minX, minX)
    g.bounds.maxX = Math.max(g.bounds.maxX, maxX)
    g.bounds.minY = Math.min(g.bounds.minY, minY)
    g.bounds.maxY = Math.max(g.bounds.maxY, maxY)
  })

  const layers = Array.from(groupsMap.values())
  if (!layers.length) throw new Error("No filled vector shapes found in SVG")
  if (!layers.some((l) => l.included)) layers[0].included = true

  const getBounds = (active: SvgLayerInfo[]) => {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const l of active) {
      minX = Math.min(minX, l.bounds.minX)
      maxX = Math.max(maxX, l.bounds.maxX)
      minY = Math.min(minY, l.bounds.minY)
      maxY = Math.max(maxY, l.bounds.maxY)
    }
    return {
      minX: isFinite(minX) ? minX : 0,
      maxX: isFinite(maxX) ? maxX : 100,
      minY: isFinite(minY) ? minY : 0,
      maxY: isFinite(maxY) ? maxY : 100,
    }
  }

  const b = getBounds(layers.filter((l) => l.included))
  return {
    fileName,
    vb: `${vbX} ${vbY} ${vbW} ${vbH}`,
    layers,
    getBounds,
    spanX: Math.max(1e-3, b.maxX - b.minX),
    spanY: Math.max(1e-3, b.maxY - b.minY),
  }
}

export function buildGeometryFromContours(
  contours: THREE.Vector2[][],
  minX: number,
  minY: number,
  scaleX: number,
  scaleY: number,
  depthMm: number
): THREE.BufferGeometry {
  const items = contours
    .map((pts, i) => {
      const scaled = pts.map(
        (p) => new THREE.Vector2((p.x - minX) * scaleX, (p.y - minY) * scaleY)
      )
      return {
        i,
        pts: scaled,
        area: Math.abs(THREE.ShapeUtils.area(scaled)),
        depth: 0,
        parent: -1,
      }
    })
    .sort((a, b) => b.area - a.area)

  for (let i = 0; i < items.length; i++) {
    let depth = 0
    let parent = -1
    for (let j = 0; j < i; j++) {
      if (pointInPoly(items[i].pts[0], items[j].pts)) {
        depth++
        parent = j
      }
    }
    items[i].depth = depth
    items[i].parent = parent
  }

  const shapes: THREE.Shape[] = []
  for (let i = 0; i < items.length; i++) {
    if (items[i].depth % 2 === 1) continue
    const shape = new THREE.Shape(items[i].pts)
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].depth === items[i].depth + 1 && items[j].parent === i) {
        shape.holes.push(new THREE.Path(items[j].pts))
      }
    }
    shapes.push(shape)
  }

  const geom = new THREE.ExtrudeGeometry(shapes, {
    depth: Math.max(0.4, depthMm),
    bevelEnabled: false,
    curveSegments: 12,
  })
  geom.computeVertexNormals()
  return geom
}

export async function parse3mfToGeometry(
  buffer: ArrayBuffer
): Promise<THREE.BufferGeometry> {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  const dec = new TextDecoder()
  const models: string[] = []
  let pos = 0

  while (pos + 30 <= bytes.byteLength) {
    if (view.getUint32(pos, true) !== 0x04034b50) {
      pos++
      continue
    }
    const method = view.getUint16(pos + 8, true)
    const comp = view.getUint32(pos + 18, true)
    const nLen = view.getUint16(pos + 26, true)
    const eLen = view.getUint16(pos + 28, true)
    const start = pos + 30 + nLen + eLen
    const name = dec.decode(bytes.subarray(pos + 30, pos + 30 + nLen))
    if (comp > 0 && start + comp <= bytes.byteLength) {
      if (/\.model$/i.test(name)) {
        const raw = bytes.subarray(start, start + comp)
        if (method === 0) {
          models.push(dec.decode(raw))
        } else {
          const ds = new DecompressionStream("deflate-raw")
          const w = ds.writable.getWriter()
          w.write(raw).catch(() => {})
          w.close().catch(() => {})
          const buf = await new Response(ds.readable).arrayBuffer()
          models.push(dec.decode(buf))
        }
      }
      pos = start + comp
    } else {
      pos = start
    }
  }

  if (!models.length) throw new Error("No mesh found in 3MF")

  const units: Record<string, number> = {
    micron: 0.001,
    millimeter: 1,
    centimeter: 10,
    inch: 25.4,
    meter: 1000,
  }
  const coords: number[] = []
  const parser = new DOMParser()

  for (const xml of models) {
    const doc = parser.parseFromString(xml, "application/xml")
    const s =
      units[
        (doc.querySelector("model")?.getAttribute("unit") || "millimeter").toLowerCase()
      ] ?? 1
    doc.querySelectorAll("mesh").forEach((mesh) => {
      const vs = mesh.querySelectorAll("vertex")
      const ts = mesh.querySelectorAll("triangle")
      const arr = new Float32Array(vs.length * 3)
      vs.forEach((v, i) => {
        arr[i * 3] = parseFloat(v.getAttribute("x") || "0") * s
        arr[i * 3 + 1] = parseFloat(v.getAttribute("y") || "0") * s
        arr[i * 3 + 2] = parseFloat(v.getAttribute("z") || "0") * s
      })
      ts.forEach((t) => {
        const i1 = parseInt(t.getAttribute("v1") || "0", 10) * 3
        const i2 = parseInt(t.getAttribute("v2") || "0", 10) * 3
        const i3 = parseInt(t.getAttribute("v3") || "0", 10) * 3
        coords.push(
          arr[i1],
          arr[i1 + 1],
          arr[i1 + 2],
          arr[i2],
          arr[i2 + 1],
          arr[i2 + 2],
          arr[i3],
          arr[i3 + 1],
          arr[i3 + 2]
        )
      })
    })
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute("position", new THREE.Float32BufferAttribute(coords, 3))
  geom.computeVertexNormals()
  return geom
}

let occtPromise: Promise<any> | null = null

export async function parseStepToGeometry(
  buffer: ArrayBuffer
): Promise<THREE.BufferGeometry> {
  if (!occtPromise) {
    occtPromise = new Promise((resolve, reject) => {
      const boot = (fn: any) =>
        fn({ locateFile: (f: string) => `${OCCT_CDN}/${f}` })
          .then(resolve)
          .catch(reject)

      if (typeof (window as any).occtimportjs === "function") {
        return boot((window as any).occtimportjs)
      }
      const s = document.createElement("script")
      s.src = `${OCCT_CDN}/occt-import-js.js`
      s.async = true
      s.onload = () => boot((window as any).occtimportjs)
      s.onerror = () => {
        occtPromise = null
        reject(new Error("Failed to load STEP decoder"))
      }
      document.head.appendChild(s)
    })
  }

  const occt = await occtPromise
  const res = occt.ReadStepFile(new Uint8Array(buffer), {
    linearUnit: "millimeter",
    linearDeflectionType: "bounding_box_ratio",
    linearDeflection: 0.002,
    angularDeflection: 0.35,
  })
  if (!res?.success || !res.meshes?.length) {
    throw new Error("Failed to parse STEP file")
  }

  const coords: number[] = []
  for (const m of res.meshes) {
    const p = m.attributes?.position?.array
    const idx = m.index?.array
    if (!p || !idx) continue
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3
      const b = idx[i + 1] * 3
      const c = idx[i + 2] * 3
      coords.push(
        p[a],
        p[a + 1],
        p[a + 2],
        p[b],
        p[b + 1],
        p[b + 2],
        p[c],
        p[c + 1],
        p[c + 2]
      )
    }
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute("position", new THREE.Float32BufferAttribute(coords, 3))
  geom.computeVertexNormals()
  return geom
}
