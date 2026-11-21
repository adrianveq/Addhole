import * as THREE from "three"
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js"
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { SUBTRACTION, ADDITION, Brush, Evaluator } from "three-bvh-csg"
import { BevelMode, PrimitiveKind } from "../types/editor"

export function normalizeBottomCenter(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.computeBoundingBox()
  const bb = g.boundingBox!
  g.translate(
    -(bb.min.x + bb.max.x) / 2,
    -(bb.min.y + bb.max.y) / 2,
    -bb.min.z
  )
  g.computeVertexNormals()
  return g
}

export function createRoundedBoxGeometry(
  dimMm: { x: number; y: number; z: number },
  bevelMm: number,
  mode: BevelMode
): THREE.BufferGeometry {
  const sx = Math.max(1, dimMm.x)
  const sy = Math.max(1, dimMm.y)
  const sz = Math.max(1, dimMm.z)
  const r = THREE.MathUtils.clamp(bevelMm, 0.1, Math.min(sx, sy, sz) * 0.45)
  const hx = sx / 2
  const hy = sy / 2
  const ix = Math.max(0.05, hx - r)
  const iy = Math.max(0.05, hy - r)

  const shape = new THREE.Shape()
  if (mode === "chamfer") {
    shape.moveTo(-ix, -hy)
    shape.lineTo(ix, -hy)
    shape.lineTo(hx, -iy)
    shape.lineTo(hx, iy)
    shape.lineTo(ix, hy)
    shape.lineTo(-ix, hy)
    shape.lineTo(-hx, iy)
    shape.lineTo(-hx, -iy)
  } else {
    shape.moveTo(-ix, -hy)
    shape.lineTo(ix, -hy)
    shape.quadraticCurveTo(hx, -hy, hx, -iy)
    shape.lineTo(hx, iy)
    shape.quadraticCurveTo(hx, hy, ix, hy)
    shape.lineTo(-ix, hy)
    shape.quadraticCurveTo(-hx, hy, -hx, iy)
    shape.lineTo(-hx, -iy)
    shape.quadraticCurveTo(-hx, -hy, -ix, -hy)
  }
  shape.closePath()

  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.2, sz - 2 * r),
    bevelEnabled: true,
    bevelThickness: r,
    bevelSize: r,
    bevelSegments: mode === "chamfer" ? 1 : 6,
    curveSegments: mode === "chamfer" ? 1 : 10,
  })
  g.computeBoundingBox()
  const bb = g.boundingBox!
  g.scale(
    sx / Math.max(1e-3, bb.max.x - bb.min.x),
    sy / Math.max(1e-3, bb.max.y - bb.min.y),
    sz / Math.max(1e-3, bb.max.z - bb.min.z)
  )
  return g
}

export function createPrimitiveGeometry(
  kind: PrimitiveKind,
  opts?: {
    dimMm?: { x: number; y: number; z: number }
    sizeMm?: number
    mode?: BevelMode
  }
): THREE.BufferGeometry {
  let g: THREE.BufferGeometry
  if (kind === "box") g = new THREE.BoxGeometry(20, 20, 20)
  else if (kind === "roundedBox") {
    g = createRoundedBoxGeometry(
      opts?.dimMm ?? { x: 20, y: 20, z: 20 },
      opts?.sizeMm ?? 2.5,
      opts?.mode ?? "fillet"
    )
  } else if (kind === "cylinder") {
    g = new THREE.CylinderGeometry(10, 10, 20, 36)
    g.rotateX(Math.PI / 2)
  } else if (kind === "sphere") {
    g = new THREE.SphereGeometry(10, 32, 24)
  } else if (kind === "hemisphere") {
    g = new THREE.SphereGeometry(10, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    g.rotateX(Math.PI / 2)
    const cap = new THREE.CircleGeometry(10, 32)
    cap.rotateX(Math.PI)
    g = mergeBakedGeometries([g, cap])
  } else if (kind === "cone") {
    g = new THREE.ConeGeometry(10, 20, 36)
    g.rotateX(Math.PI / 2)
  } else if (kind === "pyramid") {
    g = new THREE.ConeGeometry(12, 20, 4)
    g.rotateX(Math.PI / 2)
    g.rotateZ(Math.PI / 4)
  } else if (kind === "prism") {
    g = new THREE.CylinderGeometry(10, 10, 20, 6)
    g.rotateX(Math.PI / 2)
  } else if (kind === "torus") {
    g = new THREE.TorusGeometry(10, 3.5, 18, 40)
  } else if (kind === "tube") {
    const s = new THREE.Shape()
    s.absarc(0, 0, 10, 0, Math.PI * 2, false)
    const h = new THREE.Path()
    h.absarc(0, 0, 6.5, 0, Math.PI * 2, true)
    s.holes.push(h)
    g = new THREE.ExtrudeGeometry(s, {
      depth: 20,
      bevelEnabled: false,
      curveSegments: 36,
    })
  } else if (kind === "arch") {
    const s = new THREE.Shape()
    s.moveTo(-10, 0)
    s.lineTo(-5.2, 0)
    s.absarc(0, 0, 5.2, Math.PI, 0, true)
    s.lineTo(10, 0)
    s.lineTo(10, 16)
    s.lineTo(-10, 16)
    s.closePath()
    g = new THREE.ExtrudeGeometry(s, {
      depth: 12,
      bevelEnabled: false,
      curveSegments: 24,
    })
    g.rotateX(Math.PI / 2)
  } else {
    const s = new THREE.Shape()
    s.moveTo(-10, 0)
    s.lineTo(10, 0)
    s.lineTo(-10, 20)
    s.closePath()
    g = new THREE.ExtrudeGeometry(s, { depth: 20, bevelEnabled: false })
    g.rotateY(Math.PI / 2)
    g.rotateZ(Math.PI / 2)
  }
  return normalizeBottomCenter(g)
}

export function getTriangleCount(geom: THREE.BufferGeometry): number {
  if (!geom) return 0
  if (geom.index) return Math.floor(geom.index.count / 3)
  return geom.attributes.position ? Math.floor(geom.attributes.position.count / 3) : 0
}

export function simplifyBufferGeometry(
  rawGeom: THREE.BufferGeometry,
  reductionRatio: number
): THREE.BufferGeometry {
  let welded = rawGeom.clone()
  for (const key of Object.keys(welded.attributes)) {
    if (key !== "position") welded.deleteAttribute(key)
  }
  welded = mergeVertices(welded, 1e-4)
  const curTris = getTriangleCount(welded)
  if (curTris <= 12) return rawGeom.clone()
  const removeCount = Math.min(curTris - 12, Math.max(1, Math.floor(curTris * reductionRatio)))
  const simplified = new SimplifyModifier().modify(welded, removeCount)
  const out = simplified.index ? simplified.toNonIndexed() : simplified
  out.computeVertexNormals()
  return out
}

export function extractCoplanarPatchGeometry(
  rawGeom: THREE.BufferGeometry,
  seedFaceIndex: number
): THREE.BufferGeometry {
  const geom = rawGeom.index ? rawGeom.toNonIndexed() : rawGeom
  const pos = geom.attributes.position
  if (!pos) return new THREE.BufferGeometry()
  const triCount = Math.floor(pos.count / 3)
  if (seedFaceIndex < 0 || seedFaceIndex >= triCount) return new THREE.BufferGeometry()

  const normals = new Float32Array(triCount * 3)
  const vA = new THREE.Vector3()
  const vB = new THREE.Vector3()
  const vC = new THREE.Vector3()
  const cb = new THREE.Vector3()
  const ab = new THREE.Vector3()

  for (let t = 0; t < triCount; t++) {
    vA.fromBufferAttribute(pos, t * 3)
    vB.fromBufferAttribute(pos, t * 3 + 1)
    vC.fromBufferAttribute(pos, t * 3 + 2)
    cb.subVectors(vC, vB).cross(ab.subVectors(vA, vB)).normalize()
    normals[t * 3] = cb.x
    normals[t * 3 + 1] = cb.y
    normals[t * 3 + 2] = cb.z
  }

  const seedN = new THREE.Vector3(
    normals[seedFaceIndex * 3],
    normals[seedFaceIndex * 3 + 1],
    normals[seedFaceIndex * 3 + 2]
  )
  if (seedN.lengthSq() < 0.5) return new THREE.BufferGeometry()

  const vertMap = new Map<number, number>()
  const triVerts = new Int32Array(triCount * 3)
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const idx = t * 3 + k
      const ix = Math.round(pos.getX(idx) * 1000) + 1048576
      const iy = Math.round(pos.getY(idx) * 1000) + 1048576
      const iz = Math.round(pos.getZ(idx) * 1000) + 1048576
      const key = (ix * 2097152 + iy) * 2097152 + iz
      let vid = vertMap.get(key)
      if (vid === undefined) {
        vid = vertMap.size
        vertMap.set(key, vid)
      }
      triVerts[idx] = vid
    }
  }

  const vertToTris: number[][] = Array.from({ length: vertMap.size }, () => [])
  for (let t = 0; t < triCount; t++) {
    vertToTris[triVerts[t * 3]].push(t)
    vertToTris[triVerts[t * 3 + 1]].push(t)
    vertToTris[triVerts[t * 3 + 2]].push(t)
  }

  const visited = new Uint8Array(triCount)
  const patch: number[] = []
  const queue = [seedFaceIndex]
  visited[seedFaceIndex] = 1
  while (queue.length > 0) {
    const cur = queue.pop()!
    patch.push(cur)
    for (let k = 0; k < 3; k++) {
      for (const nb of vertToTris[triVerts[cur * 3 + k]]) {
        if (
          !visited[nb] &&
          seedN.x * normals[nb * 3] +
            seedN.y * normals[nb * 3 + 1] +
            seedN.z * normals[nb * 3 + 2] >=
            0.996
        ) {
          visited[nb] = 1
          queue.push(nb)
        }
      }
    }
  }

  const coords = new Float32Array(patch.length * 9)
  let off = 0
  for (const t of patch) {
    for (let k = 0; k < 3; k++) {
      const vi = t * 3 + k
      coords[off++] = pos.getX(vi) + seedN.x * 0.08
      coords[off++] = pos.getY(vi) + seedN.y * 0.08
      coords[off++] = pos.getZ(vi) + seedN.z * 0.08
    }
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute("position", new THREE.BufferAttribute(coords, 3))
  out.computeVertexNormals()
  return out
}

export function buildValidCsgBrush(rawGeom: THREE.BufferGeometry): Brush {
  let g = rawGeom.clone()
  for (const key of Object.keys(g.attributes)) {
    if (key !== "position") g.deleteAttribute(key)
  }
  g = mergeVertices(g, 1e-4)
  g.computeVertexNormals()
  g.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)
  )
  const brush = new Brush(g)
  brush.updateMatrixWorld(true)
  return brush
}

export function findConnectedComponents(rawGeom: THREE.BufferGeometry): number[][] {
  const geom = rawGeom.index ? rawGeom.toNonIndexed() : rawGeom
  const pos = geom.attributes.position
  if (!pos) return []
  const triCount = Math.floor(pos.count / 3)
  if (triCount <= 1) return triCount === 1 ? [[0]] : []

  const vertMap = new Map<number, number>()
  const triVerts = new Int32Array(triCount * 3)
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const idx = t * 3 + k
      const ix = Math.round(pos.getX(idx) * 1000) + 1048576
      const iy = Math.round(pos.getY(idx) * 1000) + 1048576
      const iz = Math.round(pos.getZ(idx) * 1000) + 1048576
      const key = (ix * 2097152 + iy) * 2097152 + iz
      let vid = vertMap.get(key)
      if (vid === undefined) {
        vid = vertMap.size
        vertMap.set(key, vid)
      }
      triVerts[idx] = vid
    }
  }

  const vertToTris: number[][] = Array.from({ length: vertMap.size }, () => [])
  for (let t = 0; t < triCount; t++) {
    vertToTris[triVerts[t * 3]].push(t)
    vertToTris[triVerts[t * 3 + 1]].push(t)
    vertToTris[triVerts[t * 3 + 2]].push(t)
  }

  const visited = new Uint8Array(triCount)
  const components: number[][] = []
  const queue = new Int32Array(triCount)
  for (let t = 0; t < triCount; t++) {
    if (visited[t]) continue
    visited[t] = 1
    let head = 0
    let tail = 0
    queue[tail++] = t
    const comp: number[] = []
    while (head < tail) {
      const cur = queue[head++]
      comp.push(cur)
      for (let k = 0; k < 3; k++) {
        for (const nb of vertToTris[triVerts[cur * 3 + k]]) {
          if (!visited[nb]) {
            visited[nb] = 1
            queue[tail++] = nb
          }
        }
      }
    }
    components.push(comp)
  }
  return components
}

export function splitGeometryIntoParts(rawGeom: THREE.BufferGeometry): THREE.BufferGeometry[] {
  const geom = rawGeom.index ? rawGeom.toNonIndexed() : rawGeom
  const pos = geom.attributes.position
  const components = findConnectedComponents(geom)
  if (components.length <= 1) return [rawGeom]
  return components.map((tris) => {
    const arr = new Float32Array(tris.length * 9)
    let off = 0
    for (const t of tris) {
      for (let k = 0; k < 3; k++) {
        const vi = t * 3 + k
        arr[off++] = pos.getX(vi)
        arr[off++] = pos.getY(vi)
        arr[off++] = pos.getZ(vi)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3))
    g.computeVertexNormals()
    return g
  })
}

export function mergeBakedGeometries(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalFloats = 0
  const nonIndexed = geoms.map((g) => {
    const ni = g.index ? g.toNonIndexed() : g
    totalFloats += ni.attributes.position.count * 3
    return ni
  })
  const merged = new Float32Array(totalFloats)
  let offset = 0
  for (const ni of nonIndexed) {
    const arr = ni.attributes.position.array as Float32Array
    merged.set(arr, offset)
    offset += arr.length
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute("position", new THREE.BufferAttribute(merged, 3))
  out.computeVertexNormals()
  return out
}

export function evaluateCsgGroup(
  solids: Array<{ geometry: THREE.BufferGeometry; color: string }>,
  holes: Array<{ geometry: THREE.BufferGeometry }>
): THREE.BufferGeometry {
  const evaluator = new Evaluator()
  evaluator.useGroups = false
  const holeBrushes = holes.map((h) => buildValidCsgBrush(h.geometry))
  const coloredGeoms: THREE.BufferGeometry[] = []

  for (const s of solids) {
    let partGeom: THREE.BufferGeometry
    if (holeBrushes.length === 0) {
      partGeom = s.geometry.index ? s.geometry.toNonIndexed() : s.geometry.clone()
    } else {
      let accBrush = buildValidCsgBrush(s.geometry)
      for (const hb of holeBrushes) {
        accBrush = evaluator.evaluate(accBrush, hb, SUBTRACTION)
      }
      partGeom = accBrush.geometry.index
        ? accBrush.geometry.toNonIndexed()
        : accBrush.geometry
    }
    const posCount = partGeom.attributes.position.count
    if (posCount === 0) continue
    const col = new THREE.Color(s.color || "#E2E8F0")
    const colArr = new Float32Array(posCount * 3)
    for (let i = 0; i < posCount; i++) {
      colArr[i * 3] = col.r
      colArr[i * 3 + 1] = col.g
      colArr[i * 3 + 2] = col.b
    }
    partGeom.setAttribute("color", new THREE.BufferAttribute(colArr, 3))
    partGeom.computeVertexNormals()
    coloredGeoms.push(partGeom)
  }

  if (!coloredGeoms.length) {
    let accBrush = buildValidCsgBrush(solids[0].geometry)
    for (let i = 1; i < solids.length; i++) {
      accBrush = evaluator.evaluate(
        accBrush,
        buildValidCsgBrush(solids[i].geometry),
        ADDITION
      )
    }
    for (const h of holes) {
      accBrush = evaluator.evaluate(
        accBrush,
        buildValidCsgBrush(h.geometry),
        SUBTRACTION
      )
    }
    accBrush.geometry.computeVertexNormals()
    return accBrush.geometry
  }

  let totalFloats = 0
  for (const g of coloredGeoms) totalFloats += g.attributes.position.count * 3
  const posMerged = new Float32Array(totalFloats)
  const colMerged = new Float32Array(totalFloats)
  let off = 0
  for (const g of coloredGeoms) {
    const pArr = g.attributes.position.array as Float32Array
    const cArr = g.attributes.color.array as Float32Array
    posMerged.set(pArr, off)
    colMerged.set(cArr, off)
    off += pArr.length
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute("position", new THREE.BufferAttribute(posMerged, 3))
  out.setAttribute("color", new THREE.BufferAttribute(colMerged, 3))
  out.computeVertexNormals()
  return out
}
