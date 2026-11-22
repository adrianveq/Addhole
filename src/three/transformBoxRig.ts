import * as THREE from "three"

/**
 * Oriented bounding-box manipulator for ToolMode "transform".
 * The rig follows the primary mesh quaternion, so the box and handles
 * rotate with the model. Scale signs are in {-1, 0, 1}: corners are XY
 * only (z = 0). ViewportCanvas freezes this frame on pointerdown.
 */
export type TransformHandleAxis =
  | "sxy"
  | "sx"
  | "sy"
  | "sz"
  | "mz"
  | "rx"
  | "ry"
  | "rz"

export interface TransformFrame {
  center: THREE.Vector3
  quaternion: THREE.Quaternion
  hx: number
  hy: number
  hz: number
}

export interface TransformBoxRig {
  root: THREE.Group
  setVisible: (visible: boolean) => void
  setTargets: (meshes: THREE.Object3D[]) => void
  hasTargets: () => boolean
  setHovered: (handleId: string | null) => void
  getHitTargets: () => THREE.Object3D[]
  getFrame: () => TransformFrame
  /** X/Y edges on the rig base plane for a corner handle. */
  getCornerCallout: (handleId: string) => CornerCallout | null
  /** Full height for a blue Z face handle. */
  getHeightCallout: (handleId: string) => HeightCallout | null
  /** Single X or Y span on the base plane for a side face handle. */
  getPlanarFaceCallout: (handleId: string) => PlanarFaceCallout | null
  update: (camera: THREE.Camera) => void
  dispose: () => void
}

type Extents = { hx: number; hy: number; hz: number }
type Sign = -1 | 0 | 1
type ScaleKind = "corner" | "face"

type ScaleSlot = {
  id: string
  axis: "sxy" | "sx" | "sy" | "sz"
  kind: ScaleKind
  sign: { x: Sign; y: Sign; z: Sign }
  color: number
  size: number
  place: (e: Extents, out: THREE.Vector3) => void
}

type RotAxis = "rx" | "ry" | "rz"

const UP = new THREE.Vector3(0, 1, 0)
const RIG_Z = new THREE.Vector3(0, 0, 1)
const Z_SHAFT = 1.26
const Z_HEAD = 4.6
const MIN_SCALE = 0.05
const AXIS_COLORS = {
  x: 0xeb9090,
  y: 0x78d896,
  z: 0x84b4f8,
}
const axisCss = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`
export const TRANSFORM_AXIS_CSS = {
  x: axisCss(AXIS_COLORS.x),
  y: axisCss(AXIS_COLORS.y),
  z: axisCss(AXIS_COLORS.z),
}
/** Rig space is millimetres; the UI shows centimetres. */
const DISPLAY_PER_WORLD = 0.1
/** Fixed local gap outside the box. Independent of camera distance. */
const CALLOUT_OUTSET = 18

/** Flip a local offset so it points from the box center toward the edge/anchor. */
function outwardAwayFromCenter(edgeLocal: THREE.Vector3, outward: THREE.Vector3) {
  const fromCenter = edgeLocal.clone()
  if (fromCenter.lengthSq() < 1e-8) return outward
  if (outward.dot(fromCenter) < 0) outward.negate()
  return outward
}
const CORNER_COLOR = 0xf8fafc
const ARC_START = Math.PI * 0.2
const ARC_END = Math.PI * 0.8
const ARC_RADIUS = 4.35
const ARC_TUBE = 0.4
const ARC_STEPS = 16

const spanFactor = (
  active: number,
  half: number,
  delta: number,
  symmetric: boolean
) => {
  if (!active || half < 1e-4) return 1
  const span = symmetric ? half : 2 * half
  return Math.max(MIN_SCALE, (span + active * delta) / span)
}

const uniformKFromVector = (vx: number, vy: number, vz: number, localDelta: THREE.Vector3) => {
  const v = new THREE.Vector3(vx, vy, vz)
  const len = v.length()
  if (len < 1e-4) return 1
  return Math.max(MIN_SCALE, (len + localDelta.dot(v.clone().normalize())) / len)
}

/** Diagonal used by uniform corner scale. Same vector the drag path samples. */
function cornerUniformVector(
  sign: { x: number; y: number; z: number },
  half: { x: number; y: number; z: number },
  symmetric: boolean
) {
  if (symmetric) {
    return new THREE.Vector3(sign.x * half.x, sign.y * half.y, sign.z * half.z)
  }
  const ax = -sign.x * half.x
  const ay = -sign.y * half.y
  const az = (sign.z > 0 ? 1 : -1) * half.z
  return new THREE.Vector3(
    sign.x * half.x - ax,
    sign.y * half.y - ay,
    sign.z * half.z - az
  )
}

/**
 * Pointer delta that makes `rigScaleFactors` scale `axis` by `factor`.
 * Uniform corner scale moves along the same diagonal the drag uses, so every
 * axis receives that factor. Anchor selection stays inside `rigScaleFactors`.
 */
export function deltaForAxisFactor(
  kind: ScaleKind,
  sign: { x: number; y: number; z: number },
  half: { x: number; y: number; z: number },
  axis: "x" | "y" | "z",
  factor: number,
  uniform: boolean,
  symmetric: boolean
) {
  const f = Math.max(MIN_SCALE, factor)
  if (uniform && kind === "corner") {
    return cornerUniformVector(sign, half, symmetric).multiplyScalar(f - 1)
  }
  const signA = axis === "x" ? sign.x : axis === "y" ? sign.y : sign.z
  const halfA = axis === "x" ? half.x : axis === "y" ? half.y : half.z
  if (!signA || halfA < 1e-4) return new THREE.Vector3()
  const span = symmetric ? halfA : 2 * halfA
  const delta = signA * (f - 1) * span
  return new THREE.Vector3(
    axis === "x" ? delta : 0,
    axis === "y" ? delta : 0,
    axis === "z" ? delta : 0
  )
}

/** Per-axis factors from the pointer-down half extents. Anchor is rig-local. */
export function rigScaleFactors(
  kind: ScaleKind,
  sign: { x: number; y: number; z: number },
  half: { x: number; y: number; z: number },
  localDelta: THREE.Vector3,
  uniform: boolean,
  symmetric: boolean
) {
  const rawX = spanFactor(sign.x, half.x, localDelta.x, symmetric)
  const rawY = spanFactor(sign.y, half.y, localDelta.y, symmetric)
  const rawZ = spanFactor(sign.z, half.z, localDelta.z, symmetric)

  let fx = 1
  let fy = 1
  let fz = 1

  if (uniform) {
    let k = 1
    if (kind === "corner") {
      const probe = cornerUniformVector(sign, half, symmetric)
      k = uniformKFromVector(probe.x, probe.y, probe.z, localDelta)
    } else {
      k = sign.x ? rawX : sign.y ? rawY : rawZ
    }
    fx = fy = fz = k
  } else if (kind === "corner") {
    fx = spanFactor(sign.x, half.x, localDelta.x, symmetric)
    fy = spanFactor(sign.y, half.y, localDelta.y, symmetric)
    fz = 1
  } else {
    fx = sign.x ? rawX : 1
    fy = sign.y ? rawY : 1
    fz = sign.z ? rawZ : 1
  }

  const anchor = symmetric
    ? new THREE.Vector3(0, 0, 0)
    : uniform && kind === "corner"
      ? new THREE.Vector3(
          -sign.x * half.x,
          -sign.y * half.y,
          (sign.z > 0 ? 1 : -1) * half.z
        )
      : new THREE.Vector3(
          sign.x ? -sign.x * half.x : 0,
          sign.y ? -sign.y * half.y : 0,
          kind === "corner" ? 0 : sign.z ? -sign.z * half.z : 0
        )

  return { fx, fy, fz, anchor }
}

export interface CornerEdgeMeasure {
  axis: "x" | "y"
  /** Full edge length in display centimetres. */
  length: number
  direction: THREE.Vector3
  /** Unit world vector in the base plane, pointing away from the box. */
  outward: THREE.Vector3
  /** On-box edge, base plane. */
  boxStart: THREE.Vector3
  boxEnd: THREE.Vector3
  /** Dimension segment, base plane, fixed outset from the box edge. */
  start: THREE.Vector3
  end: THREE.Vector3
  mid: THREE.Vector3
}

export interface CornerCallout {
  id: string
  sign: { x: number; y: number; z: number }
  edges: [CornerEdgeMeasure, CornerEdgeMeasure]
}

/** X and Y edges on the rig's base plane (local z = -hz). Lengths are centimetres. */
export function cornerEdgeMeasures(
  frame: TransformFrame,
  sign: { x: number; y: number; z: number }
): [CornerEdgeMeasure, CornerEdgeMeasure] {
  const { center, quaternion, hx, hy, hz } = frame
  const baseZ = -hz
  const toWorld = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y, z).applyQuaternion(quaternion).add(center)
  const measure = (axis: "x" | "y"): CornerEdgeMeasure => {
    const along = axis === "x" ? hx : hy
    const side = axis === "x" ? sign.y * hy : sign.x * hx
    const out = CALLOUT_OUTSET
    const boxStart =
      axis === "x"
        ? toWorld(sign.x * along, side, baseZ)
        : toWorld(side, sign.y * along, baseZ)
    const boxEnd =
      axis === "x"
        ? toWorld(-sign.x * along, side, baseZ)
        : toWorld(side, -sign.y * along, baseZ)
    const start =
      axis === "x"
        ? toWorld(sign.x * along, side + sign.y * out, baseZ)
        : toWorld(side + sign.x * out, sign.y * along, baseZ)
    const end =
      axis === "x"
        ? toWorld(-sign.x * along, side + sign.y * out, baseZ)
        : toWorld(side + sign.x * out, -sign.y * along, baseZ)
    const mid = start.clone().lerp(end, 0.5)
    const direction = end.clone().sub(start)
    const span = direction.length()
    if (span > 1e-8) direction.multiplyScalar(1 / span)
    const edgeLocal =
      axis === "x"
        ? new THREE.Vector3(0, sign.y * hy, 0)
        : new THREE.Vector3(sign.x * hx, 0, 0)
    const outwardLocal = outwardAwayFromCenter(
      edgeLocal,
      axis === "x" ? new THREE.Vector3(0, sign.y, 0) : new THREE.Vector3(sign.x, 0, 0)
    ).applyQuaternion(quaternion)
    return {
      axis,
      length: span * DISPLAY_PER_WORLD,
      direction,
      outward: outwardLocal,
      boxStart,
      boxEnd,
      start,
      end,
      mid,
    }
  }
  return [measure("x"), measure("y")]
}

export interface HeightEdgeMeasure {
  axis: "z"
  /** Full height in display centimetres. */
  length: number
  direction: THREE.Vector3
  /** Unit world vector in the base plane, pointing away from the box and the Z arrow. */
  outward: THREE.Vector3
  boxStart: THREE.Vector3
  boxEnd: THREE.Vector3
  start: THREE.Vector3
  end: THREE.Vector3
  mid: THREE.Vector3
}

export interface HeightCallout {
  id: string
  sign: { x: number; y: number; z: number }
  edge: HeightEdgeMeasure
}

export interface PlanarFaceCallout {
  id: string
  sign: { x: number; y: number; z: number }
  edge: CornerEdgeMeasure | HeightEdgeMeasure
}

/** One full width/depth span on an outer base edge (local z = -hz), not through the center. */
export function planarFaceEdgeMeasure(
  frame: TransformFrame,
  axis: "x" | "y",
  sign: { x: number; y: number; z: number }
): CornerEdgeMeasure {
  const { center, quaternion, hx, hy, hz } = frame
  const baseZ = -hz
  const toWorld = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y, z).applyQuaternion(quaternion).add(center)
  let start: THREE.Vector3
  let end: THREE.Vector3
  let edgeLocal: THREE.Vector3
  let outwardLocal: THREE.Vector3
  let boxStart: THREE.Vector3
  let boxEnd: THREE.Vector3
  if (axis === "x") {
    const yEdge = sign.y !== 0 ? sign.y * hy : hy
    const yOut = yEdge + Math.sign(yEdge || 1) * CALLOUT_OUTSET
    boxStart = toWorld(-hx, yEdge, baseZ)
    boxEnd = toWorld(hx, yEdge, baseZ)
    start = toWorld(-hx, yOut, baseZ)
    end = toWorld(hx, yOut, baseZ)
    edgeLocal = new THREE.Vector3(0, yEdge, 0)
    outwardLocal = outwardAwayFromCenter(edgeLocal, new THREE.Vector3(0, Math.sign(yEdge) || 1, 0))
  } else {
    const xEdge = sign.x !== 0 ? sign.x * hx : hx
    const xOut = xEdge + Math.sign(xEdge || 1) * CALLOUT_OUTSET
    boxStart = toWorld(xEdge, -hy, baseZ)
    boxEnd = toWorld(xEdge, hy, baseZ)
    start = toWorld(xOut, -hy, baseZ)
    end = toWorld(xOut, hy, baseZ)
    edgeLocal = new THREE.Vector3(xEdge, 0, 0)
    outwardLocal = outwardAwayFromCenter(edgeLocal, new THREE.Vector3(Math.sign(xEdge) || 1, 0, 0))
  }
  const mid = start.clone().lerp(end, 0.5)
  const direction = end.clone().sub(start)
  const span = direction.length()
  if (span > 1e-8) direction.multiplyScalar(1 / span)
  const outward = outwardLocal.applyQuaternion(quaternion)
  return {
    axis,
    length: span * DISPLAY_PER_WORLD,
    direction,
    outward,
    boxStart,
    boxEnd,
    start,
    end,
    mid,
  }
}

/** Vertical span on an outer corner edge, from the base plane to the top. */
export function heightEdgeMeasure(
  frame: TransformFrame,
  sign: { x: number; y: number; z: number }
): HeightEdgeMeasure {
  const { center, quaternion, hx, hy, hz } = frame
  const toWorld = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y, z).applyQuaternion(quaternion).add(center)
  const xEdge = sign.x !== 0 ? sign.x * hx : hx
  const yEdge = sign.y !== 0 ? sign.y * hy : hy
  const boxStart = toWorld(xEdge, yEdge, -hz)
  const boxEnd = toWorld(xEdge, yEdge, hz)
  const start = toWorld(
    xEdge + (xEdge === 0 ? 0 : Math.sign(xEdge)) * CALLOUT_OUTSET,
    yEdge + (yEdge === 0 ? 0 : Math.sign(yEdge)) * CALLOUT_OUTSET,
    -hz
  )
  const end = toWorld(
    xEdge + (xEdge === 0 ? 0 : Math.sign(xEdge)) * CALLOUT_OUTSET,
    yEdge + (yEdge === 0 ? 0 : Math.sign(yEdge)) * CALLOUT_OUTSET,
    hz
  )
  const mid = start.clone().lerp(end, 0.5)
  const direction = end.clone().sub(start)
  const span = direction.length()
  if (span > 1e-8) direction.multiplyScalar(1 / span)
  const edgeLocal = new THREE.Vector3(xEdge, yEdge, 0)
  let outwardLocal = edgeLocal.clone()
  if (outwardLocal.lengthSq() < 1e-8) outwardLocal.set(1, 0, 0)
  else outwardLocal.normalize()
  outwardLocal = outwardAwayFromCenter(edgeLocal, outwardLocal)
  const outward = outwardLocal.applyQuaternion(quaternion)
  return {
    axis: "z",
    length: span * DISPLAY_PER_WORLD,
    direction,
    outward,
    boxStart,
    boxEnd,
    start,
    end,
    mid,
  }
}

function depthPair(color: number) {
  const front = new THREE.MeshBasicMaterial({
    color,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  })
  const back = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.22,
    depthTest: true,
    depthWrite: false,
    depthFunc: THREE.GreaterDepth,
    toneMapped: false,
  })
  return { front, back }
}

function manipulatorScale(cam: THREE.Camera, center: THREE.Vector3) {
  const ortho = cam as THREE.OrthographicCamera
  if (ortho.isOrthographicCamera) {
    return THREE.MathUtils.clamp(1 / Math.max(ortho.zoom, 0.001), 0.55, 2.2)
  }
  return THREE.MathUtils.clamp(cam.position.distanceTo(center) / 360, 0.55, 2.2)
}

function scaleSlots(): ScaleSlot[] {
  const slots: ScaleSlot[] = []
  for (const x of [-1, 1] as const) {
    for (const y of [-1, 1] as const) {
      for (const z of [-1, 1] as const) {
        slots.push({
          id: `corner-${x}${y}${z}`,
          axis: "sxy",
          kind: "corner",
          sign: { x, y, z },
          color: CORNER_COLOR,
          size: 1,
          place: (e, out) => out.set(x * e.hx, y * e.hy, z * e.hz),
        })
      }
    }
  }
  const face = (
    id: string,
    axis: "sx" | "sy" | "sz",
    sign: { x: Sign; y: Sign; z: Sign },
    place: ScaleSlot["place"]
  ): ScaleSlot => ({
    id,
    axis,
    kind: "face",
    sign,
    color: AXIS_COLORS[axis === "sx" ? "x" : axis === "sy" ? "y" : "z"],
    size: 0.86,
    place,
  })
  slots.push(
    face("side-x+", "sx", { x: 1, y: 0, z: 0 }, (e, out) => out.set(e.hx, 0, 0)),
    face("side-x-", "sx", { x: -1, y: 0, z: 0 }, (e, out) => out.set(-e.hx, 0, 0)),
    face("side-y+", "sy", { x: 0, y: 1, z: 0 }, (e, out) => out.set(0, e.hy, 0)),
    face("side-y-", "sy", { x: 0, y: -1, z: 0 }, (e, out) => out.set(0, -e.hy, 0)),
    face("height-z+", "sz", { x: 0, y: 0, z: 1 }, (e, out) => out.set(0, 0, e.hz)),
    face("height-z-", "sz", { x: 0, y: 0, z: -1 }, (e, out) => out.set(0, 0, -e.hz))
  )
  return slots
}

/** 110° arch in local XY, peak toward +Y. Group rotation places it; no billboard. */
function createRotationArc(color: number, axis: RotAxis, hitMat: THREE.Material) {
  const letter = axis.slice(1) as "x" | "y" | "z"
  const meta = { gizmoAxis: axis, axis: letter, handleId: `rot-${axis}` }
  const mark = (obj: THREE.Object3D) => {
    obj.userData = meta
    obj.frustumCulled = false
  }
  const group = new THREE.Group()
  group.name = `rot-${axis}`
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = ARC_START + ((ARC_END - ARC_START) * i) / ARC_STEPS
    pts.push(new THREE.Vector3(Math.cos(a) * ARC_RADIUS, Math.sin(a) * ARC_RADIUS, 0))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const mats = depthPair(color)
  const headMats = depthPair(color)
  const tubeGeo = new THREE.TubeGeometry(curve, ARC_STEPS, ARC_TUBE, 5, false)
  const hitGeo = new THREE.TubeGeometry(curve, ARC_STEPS, ARC_TUBE * 2.7, 6, false)
  const tube = new THREE.Mesh(tubeGeo, mats.front)
  const ghost = new THREE.Mesh(tubeGeo, mats.back)
  const hit = new THREE.Mesh(hitGeo, hitMat)
  tube.renderOrder = 1002
  ghost.renderOrder = 1001
  mark(tube)
  mark(hit)
  const coneGeo = new THREE.ConeGeometry(1.05, 2.6, 10)
  const heads: THREE.Mesh[] = []
  const addHead = (angle: number, dir: THREE.Vector3) => {
    const g = new THREE.Group()
    const cone = new THREE.Mesh(coneGeo, headMats.front)
    const coneGhost = new THREE.Mesh(coneGeo, headMats.back)
    cone.renderOrder = 1002
    coneGhost.renderOrder = 1001
    mark(cone)
    g.add(coneGhost, cone)
    g.position.set(Math.cos(angle) * ARC_RADIUS, Math.sin(angle) * ARC_RADIUS, 0)
    g.position.addScaledVector(dir, 0.85)
    g.quaternion.setFromUnitVectors(UP, dir)
    group.add(g)
    heads.push(cone)
  }
  addHead(
    ARC_END,
    new THREE.Vector3(-Math.sin(ARC_END), Math.cos(ARC_END), 0).normalize()
  )
  addHead(
    ARC_START,
    new THREE.Vector3(Math.sin(ARC_START), -Math.cos(ARC_START), 0).normalize()
  )
  group.add(ghost, tube, hit)
  return { axis, letter, group, mats, headMats, tube, hit, heads, tubeGeo, hitGeo, coneGeo }
}

export function createTransformBoxRig(): TransformBoxRig {
  const root = new THREE.Group()
  root.name = "transformBoxRig"
  root.renderOrder = 1000

  const disposables: Array<{ dispose: () => void }> = []
  const hitTargets: THREE.Object3D[] = []
  const targets: THREE.Object3D[] = []

  const unitBox = new THREE.BoxGeometry(1, 1, 1)
  const boxLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(unitBox),
    new THREE.LineBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.48,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  )
  unitBox.dispose()
  boxLines.name = "transform-box"
  boxLines.renderOrder = 4
  root.add(boxLines)

  const cubeGeo = new THREE.BoxGeometry(2.7, 2.7, 2.7)
  const cubeHitGeo = new THREE.BoxGeometry(5.4, 5.4, 5.4)
  const invisible = new THREE.MeshBasicMaterial({ visible: false })
  disposables.push(cubeGeo, cubeHitGeo, invisible, boxLines.geometry, boxLines.material)

  const scaleHandles = scaleSlots().map((slot) => {
    const { front, back } = depthPair(slot.color)
    const visual = new THREE.Mesh(cubeGeo, front)
    const ghost = new THREE.Mesh(cubeGeo, back)
    visual.renderOrder = 1002
    ghost.renderOrder = 1001
    visual.frustumCulled = false
    ghost.frustumCulled = false
    const hit = new THREE.Mesh(cubeHitGeo, invisible)
    hit.userData = {
      gizmoAxis: slot.axis,
      handleId: slot.id,
      handleKind: slot.kind,
      signX: slot.sign.x,
      signY: slot.sign.y,
      signZ: slot.sign.z,
    }
    const group = new THREE.Group()
    group.name = slot.id
    group.add(ghost, visual, hit)
    root.add(group)
    hitTargets.push(hit)
    disposables.push(front, back)
    return { ...slot, group, front, back }
  })

  const arrowMats = depthPair(AXIS_COLORS.z)
  const arrow = new THREE.Group()
  arrow.name = "move-z"
  const shaftGeo = new THREE.CylinderGeometry(0.42, 0.42, Z_SHAFT, 10)
  const headGeo = new THREE.ConeGeometry(1.65, Z_HEAD, 14)
  const arrowHitGeo = new THREE.CylinderGeometry(2.5, 2.5, Z_SHAFT + Z_HEAD, 8)
  const shaft = new THREE.Mesh(shaftGeo, arrowMats.front)
  const shaftGhost = new THREE.Mesh(shaftGeo, arrowMats.back)
  shaft.position.y = Z_SHAFT / 2
  shaftGhost.position.y = Z_SHAFT / 2
  shaft.renderOrder = 1002
  shaftGhost.renderOrder = 1001
  const head = new THREE.Mesh(headGeo, arrowMats.front)
  const headGhost = new THREE.Mesh(headGeo, arrowMats.back)
  head.position.y = Z_SHAFT + Z_HEAD / 2
  headGhost.position.y = Z_SHAFT + Z_HEAD / 2
  head.renderOrder = 1002
  headGhost.renderOrder = 1001
  const arrowHit = new THREE.Mesh(arrowHitGeo, invisible)
  arrowHit.position.y = (Z_SHAFT + Z_HEAD) / 2
  arrowHit.userData = { gizmoAxis: "mz" satisfies TransformHandleAxis, handleId: "move-z" }
  for (const mesh of [shaft, shaftGhost, head, headGhost, arrowHit]) mesh.frustumCulled = false
  arrow.add(shaftGhost, shaft, headGhost, head, arrowHit)
  root.add(arrow)
  hitTargets.push(arrowHit)
  disposables.push(arrowMats.front, arrowMats.back, shaftGeo, headGeo, arrowHitGeo)

  const arcX = createRotationArc(AXIS_COLORS.x, "rx", invisible)
  const arcY = createRotationArc(AXIS_COLORS.y, "ry", invisible)
  const arcZ = createRotationArc(AXIS_COLORS.z, "rz", invisible)
  const arcs = [arcX, arcY, arcZ]
  for (const arc of arcs) {
    root.add(arc.group)
    hitTargets.push(arc.tube, arc.hit, ...arc.heads)
    disposables.push(arc.tubeGeo, arc.hitGeo, arc.coneGeo, arc.mats.front, arc.mats.back, arc.headMats.front, arc.headMats.back)
  }

  const box3 = new THREE.Box3()
  const corner = new THREE.Vector3()
  const frameCenter = new THREE.Vector3()
  const worldCenter = new THREE.Vector3()
  const size = new THREE.Vector3()
  const camLocal = new THREE.Vector3()
  const frameQuat = new THREE.Quaternion()
  const invQuat = new THREE.Quaternion()
  let boxKey = ""
  let hoveredId: string | null = null
  let hx = 1
  let hy = 1
  let hz = 1

  const paint = (hs: number) => {
    for (const handle of scaleHandles) {
      const hot = handle.id === hoveredId
      handle.group.scale.setScalar(hs * handle.size * (hot ? 1.22 : 1))
      const color = hot ? 0xffffff : handle.color
      handle.front.color.set(color)
      handle.back.color.set(color)
    }
    const arrowHot = hoveredId === "move-z"
    arrow.scale.setScalar(hs * (arrowHot ? 1.16 : 1))
    const arrowColor = arrowHot ? 0xadc8fa : AXIS_COLORS.z
    arrowMats.front.color.set(arrowColor)
    arrowMats.back.color.set(arrowColor)
    for (const arc of arcs) {
      const hot = hoveredId === `rot-${arc.axis}`
      const color = hot ? 0xffffff : AXIS_COLORS[arc.letter]
      arc.mats.front.color.set(color)
      arc.mats.back.color.set(color)
      arc.headMats.front.color.set(color)
      arc.headMats.back.color.set(color)
      arc.group.scale.setScalar(hs * (hot ? 1.18 : 1))
    }
  }

  return {
    root,
    setVisible: (visible) => {
      root.visible = visible
    },
    setTargets: (meshes) => {
      targets.length = 0
      targets.push(...meshes)
      boxKey = ""
    },
    hasTargets: () => targets.length > 0,
    setHovered: (handleId) => {
      hoveredId = handleId
    },
    getHitTargets: () => hitTargets,
    getFrame: () => ({
      center: root.position.clone(),
      quaternion: root.quaternion.clone(),
      hx,
      hy,
      hz,
    }),
    getCornerCallout: (handleId) => {
      const handle = scaleHandles.find((slot) => slot.id === handleId && slot.kind === "corner")
      if (!handle) return null
      return {
        id: handle.id,
        sign: { x: handle.sign.x, y: handle.sign.y, z: handle.sign.z },
        edges: cornerEdgeMeasures(
          {
            center: root.position.clone(),
            quaternion: root.quaternion.clone(),
            hx,
            hy,
            hz,
          },
          handle.sign
        ),
      }
    },
    getHeightCallout: (handleId) => {
      const handle = scaleHandles.find(
        (slot) => slot.id === handleId && slot.kind === "face" && slot.axis === "sz"
      )
      if (!handle) return null
      return {
        id: handle.id,
        sign: { x: handle.sign.x, y: handle.sign.y, z: handle.sign.z },
        edge: heightEdgeMeasure(
          {
            center: root.position.clone(),
            quaternion: root.quaternion.clone(),
            hx,
            hy,
            hz,
          },
          handle.sign
        ),
      }
    },
    getPlanarFaceCallout: (handleId) => {
      const handle = scaleHandles.find(
        (slot) =>
          slot.id === handleId &&
          slot.kind === "face" &&
          (slot.axis === "sx" || slot.axis === "sy")
      )
      if (!handle) return null
      const axis = handle.axis === "sx" ? "x" : "y"
      const frame = {
        center: root.position.clone(),
        quaternion: root.quaternion.clone(),
        hx,
        hy,
        hz,
      }
      return {
        id: handle.id,
        sign: { x: handle.sign.x, y: handle.sign.y, z: handle.sign.z },
        edge: planarFaceEdgeMeasure(frame, axis, handle.sign),
      }
    },
    update: (camera) => {
      if (!root.visible || targets.length === 0) return

      let key = ""
      for (const mesh of targets) {
        const p = mesh.position
        const q = mesh.quaternion
        const sc = mesh.scale
        key += `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)},${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)},${q.w.toFixed(3)},${sc.x.toFixed(3)},${sc.y.toFixed(3)},${sc.z.toFixed(3)}|`
      }
      if (key !== boxKey) {
        const primary = targets[targets.length - 1]
        frameQuat.copy(primary.quaternion)
        invQuat.copy(frameQuat).invert()
        box3.makeEmpty()
        for (const mesh of targets) {
          const geom = (mesh as THREE.Mesh).geometry
          if (!geom) continue
          if (!geom.boundingBox) geom.computeBoundingBox()
          const bb = geom.boundingBox
          if (!bb || bb.isEmpty()) continue
          mesh.updateMatrixWorld(true)
          for (const x of [bb.min.x, bb.max.x]) {
            for (const y of [bb.min.y, bb.max.y]) {
              for (const z of [bb.min.z, bb.max.z]) {
                corner.set(x, y, z).applyMatrix4(mesh.matrixWorld).applyQuaternion(invQuat)
                box3.expandByPoint(corner)
              }
            }
          }
        }
        if (box3.isEmpty()) {
          root.visible = false
          return
        }
        box3.getCenter(frameCenter)
        box3.getSize(size)
        hx = Math.max(size.x * 0.5, 0.4)
        hy = Math.max(size.y * 0.5, 0.4)
        hz = Math.max(size.z * 0.5, 0.4)
        worldCenter.copy(frameCenter).applyQuaternion(frameQuat)
        root.position.copy(worldCenter)
        root.quaternion.copy(frameQuat)
        root.scale.set(1, 1, 1)
        boxLines.scale.set(hx * 2, hy * 2, hz * 2)
        boxKey = key
      }

      root.updateMatrixWorld(true)
      camLocal.copy(camera.position)
      root.worldToLocal(camLocal)

      const hs = manipulatorScale(camera, worldCenter)
      const ext: Extents = { hx, hy, hz }
      for (const handle of scaleHandles) handle.place(ext, handle.group.position)

      const signZ = camLocal.z >= 0 ? 1 : -1
      const gap = Math.max(hs * 5.2, 6.5)
      arrow.position.set(0, 0, signZ * (hz + gap))
      arrow.rotation.set(signZ > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0)

      const offset = Math.max(hs * 2.15, 1.6)
      arcZ.group.position.set(-hx - offset, 0, -hz)
      arcZ.group.rotation.set(0, 0, Math.PI / 2)
      arcY.group.position.set(0, -hy - offset * 0.6, hz + offset * 0.6)
      arcY.group.rotation.set(Math.PI / 2, 0, 0)
      arcX.group.position.set(hx + offset * 0.6, 0, hz + offset * 0.6)
      arcX.group.quaternion.copy(arcY.group.quaternion)
      arcX.group.rotateOnWorldAxis(RIG_Z, Math.PI / 2)

      paint(hs)
    },
    dispose: () => {
      for (const item of disposables) item.dispose()
      root.removeFromParent()
    },
  }
}
