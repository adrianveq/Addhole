import * as THREE from "three"

export function buildCornerBracketsGeometry(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number
): THREE.BufferGeometry {
  const lx = Math.min(Math.max(2, maxX - minX) * 0.24, 14)
  const ly = Math.min(Math.max(2, maxY - minY) * 0.24, 14)
  const lz = Math.min(Math.max(2, maxZ - minZ) * 0.24, 14)
  const pad = 0.8
  const x0 = minX - pad
  const x1 = maxX + pad
  const y0 = minY - pad
  const y1 = maxY + pad
  const z0 = minZ - pad
  const z1 = maxZ + pad

  const pts: number[] = []
  for (const [cx, cy, cz, dx, dy, dz] of [
    [x0, y0, z0, 1, 1, 1],
    [x1, y0, z0, -1, 1, 1],
    [x0, y1, z0, 1, -1, 1],
    [x1, y1, z0, -1, -1, 1],
    [x0, y0, z1, 1, 1, -1],
    [x1, y0, z1, -1, 1, -1],
    [x0, y1, z1, 1, -1, -1],
    [x1, y1, z1, -1, -1, -1],
  ]) {
    pts.push(
      cx,
      cy,
      cz,
      cx + dx * lx,
      cy,
      cz,
      cx,
      cy,
      cz,
      cx,
      cy + dy * ly,
      cz,
      cx,
      cy,
      cz,
      cx,
      cy,
      cz + dz * lz
    )
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
  return g
}

export function buildBottomContactGeometry(
  rawGeom: THREE.BufferGeometry
): THREE.BufferGeometry {
  const geom = rawGeom.index ? rawGeom.toNonIndexed() : rawGeom
  const pos = geom.attributes.position
  if (!pos) return new THREE.BufferGeometry()
  geom.computeBoundingBox()
  const minZ = geom.boundingBox?.min.z ?? 0
  const coords: number[] = []
  for (let i = 0; i < pos.count; i += 3) {
    const z0 = pos.getZ(i)
    const z1 = pos.getZ(i + 1)
    const z2 = pos.getZ(i + 2)
    if (
      Math.abs(z0 - minZ) <= 0.18 &&
      Math.abs(z1 - minZ) <= 0.18 &&
      Math.abs(z2 - minZ) <= 0.18
    ) {
      coords.push(
        pos.getX(i),
        pos.getY(i),
        z0 - 0.06,
        pos.getX(i + 1),
        pos.getY(i + 1),
        z1 - 0.06,
        pos.getX(i + 2),
        pos.getY(i + 2),
        z2 - 0.06
      )
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(coords, 3))
  return g
}

function createPlateGearTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 128
  c.height = 128
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "rgba(9, 16, 29, 0.56)"
  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(14, 14, 100, 100, 16)
  ctx.fill()
  ctx.stroke()

  ctx.translate(64, 64)
  ctx.strokeStyle = "rgba(148, 163, 184, 0.72)"
  ctx.lineWidth = 5
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    if (i === 0) ctx.moveTo(Math.cos(a) * 28, Math.sin(a) * 28)
    else ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, 10, 0, Math.PI * 2)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  return tex
}

function buildPlateGeometries(gridSizeCm: number, majorStepCm: number) {
  const totalMm = gridSizeCm * 10
  const half = totalMm / 2
  const cornerR = Math.min(4.5, totalMm * 0.022)
  const minorPts: number[] = []
  const majorPts: number[] = []

  const getChordHalf = (p: number) => {
    const d = half - Math.abs(p)
    return d >= cornerR
      ? half
      : half - cornerR + Math.sqrt(Math.max(0, cornerR * cornerR - (cornerR - d) ** 2))
  }

  for (let i = 1; i < gridSizeCm; i++) {
    const p = -half + i * 10
    const lim = getChordHalf(p)
    const dst = majorStepCm > 0 && i % majorStepCm === 0 ? majorPts : minorPts
    dst.push(p, -lim, 0, p, lim, 0, -lim, p, 0, lim, p, 0)
  }

  const outline = new THREE.Shape()
  const ih = half - cornerR
  outline.moveTo(-ih, -half)
  outline.lineTo(ih, -half)
  outline.quadraticCurveTo(half, -half, half, -ih)
  outline.lineTo(half, ih)
  outline.quadraticCurveTo(half, half, ih, half)
  outline.lineTo(-ih, half)
  outline.quadraticCurveTo(-half, half, -half, ih)
  outline.lineTo(-half, -ih)
  outline.quadraticCurveTo(-half, -half, -ih, -half)

  const pts2D = outline.getPoints(8)
  for (let i = 0; i < pts2D.length - 1; i++) {
    majorPts.push(pts2D[i].x, pts2D[i].y, 0, pts2D[i + 1].x, pts2D[i + 1].y, 0)
  }

  const minorG = new THREE.BufferGeometry()
  minorG.setAttribute("position", new THREE.Float32BufferAttribute(minorPts, 3))
  const majorG = new THREE.BufferGeometry()
  majorG.setAttribute("position", new THREE.Float32BufferAttribute(majorPts, 3))

  return { minorG, majorG, planeG: new THREE.ShapeGeometry(outline, 8), half }
}

export function createBuildPlate(gridSizeCm: number, majorStepCm: number) {
  const group = new THREE.Group()
  const { minorG, majorG, planeG, half } = buildPlateGeometries(gridSizeCm, majorStepCm)

  const minorLines = new THREE.LineSegments(
    minorG,
    new THREE.LineBasicMaterial({
      color: 0x475569,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    })
  )
  const majorLines = new THREE.LineSegments(
    majorG,
    new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
  )
  const plateMesh = new THREE.Mesh(
    planeG,
    new THREE.MeshBasicMaterial({
      color: 0x09101d,
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 2,
      polygonOffsetUnits: 2,
    })
  )

  const tabSize = 14
  const gearTab = new THREE.Mesh(
    new THREE.PlaneGeometry(tabSize, tabSize),
    new THREE.MeshBasicMaterial({
      map: createPlateGearTexture(),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  )
  gearTab.position.set(half + tabSize * 0.65, half - tabSize * 0.5, 0.05)
  group.add(minorLines, majorLines, plateMesh, gearTab)

  return {
    group,
    gearTab,
    updateDimensions: (newGridCm: number, newStepCm: number) => {
      const next = buildPlateGeometries(newGridCm, newStepCm)
      minorLines.geometry.dispose()
      minorLines.geometry = next.minorG
      majorLines.geometry.dispose()
      majorLines.geometry = next.majorG
      plateMesh.geometry.dispose()
      plateMesh.geometry = next.planeG
      gearTab.position.set(
        next.half + tabSize * 0.65,
        next.half - tabSize * 0.5,
        0.05
      )
    },
  }
}

export function createBananaMesh(lengthCm: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-88, -16, 4),
    new THREE.Vector3(-82, -6, 6),
    new THREE.Vector3(-72, 10, 11),
    new THREE.Vector3(-36, 28, 17),
    new THREE.Vector3(6, 30, 18),
    new THREE.Vector3(48, 18, 15),
    new THREE.Vector3(82, -2, 9),
    new THREE.Vector3(92, -10, 6),
  ])

  const tubularSegments = 22
  const radialSegments = 6
  const raw = new THREE.TubeGeometry(curve, tubularSegments, 17.5, radialSegments, false)
  const pos = raw.attributes.position
  const v = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    const ringIdx = Math.floor(i / (radialSegments + 1))
    const segIdx = i % (radialSegments + 1)
    const t = THREE.MathUtils.clamp(ringIdx / tubularSegments, 0, 1)
    const center = curve.getPointAt(t)
    v.fromBufferAttribute(pos, i).sub(center)

    let rFactor = 1
    if (t < 0.08) rFactor = 0.24 + (t / 0.08) * 0.06
    else if (t < 0.18) rFactor = 0.3 + ((t - 0.08) / 0.1) * 0.68
    else if (t > 0.9) rFactor = 0.35 + ((1 - t) / 0.1) * 0.6
    else rFactor = 0.96 + 0.08 * Math.sin(((t - 0.18) / 0.72) * Math.PI)

    const ridge = 1 + 0.055 * Math.cos((segIdx / radialSegments) * Math.PI * 2 * 5)
    v.multiplyScalar(rFactor * ridge)
    v.z *= 0.88
    pos.setXYZ(i, center.x + v.x, center.y + v.y, center.z + v.z)
  }

  const geom = raw.toNonIndexed()
  geom.computeBoundingBox()
  const bb = geom.boundingBox!
  const currentSpan = Math.max(1e-3, Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y))
  const targetMm = lengthCm * 10
  const s = targetMm / currentSpan
  geom.scale(s, s, s)
  geom.computeBoundingBox()
  const b2 = geom.boundingBox!
  geom.translate(-(b2.min.x + b2.max.x) / 2, -(b2.min.y + b2.max.y) / 2, -b2.min.z)

  const p2 = geom.attributes.position
  const colors = new Float32Array(p2.count * 3)
  const minX = b2.min.x
  const spanX = Math.max(1e-3, b2.max.x - b2.min.x)

  for (let i = 0; i < p2.count; i++) {
    const tx = THREE.MathUtils.clamp((p2.getX(i) - minX) / spanX, 0, 1)
    const isStemOrTip = tx < 0.055 || tx > 0.955
    colors[i * 3] = isStemOrTip ? 0.56 : 0.93
    colors[i * 3 + 1] = isStemOrTip ? 0.49 : 0.82
    colors[i * 3 + 2] = isStemOrTip ? 0.16 : 0.09
  }

  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  geom.computeVertexNormals()

  return new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.48,
      metalness: 0.04,
      flatShading: true,
    })
  )
}
