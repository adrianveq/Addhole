import * as THREE from "three"

/**
 * Oriented bounding-box manipulator for ToolMode "transform".
 *
 * The rig uses the primary mesh quaternion (group frame for multi-select)
 * and the geometry bounds in that frame, so the box rotates with the model.
 *
 * Scale handles carry local signs in {-1, 0, 1}. ViewportCanvas scales about
 * the opposite face/corner and keeps that anchor fixed in world space.
 */
export type TransformHandleAxis =
  | "sall"
  | "sx"
  | "sy"
  | "sz"
  | "mz"
  | "rx"
  | "ry"
  | "rz"

export interface TransformScaleDrag {
  quaternion: THREE.Quaternion
  anchor: THREE.Vector3
  direction: THREE.Vector3
  span: number
}

export interface TransformBoxRig {
  root: THREE.Group
  setVisible: (visible: boolean) => void
  setTargets: (meshes: THREE.Object3D[]) => void
  hasTargets: () => boolean
  setHovered: (handleId: string | null) => void
  getHitTargets: () => THREE.Object3D[]
  /** Last target is the orientation source. Signs point at the grabbed handle. */
  getScaleDrag: (sign: { x: number; y: number; z: number }) => TransformScaleDrag
  update: (camera: THREE.Camera) => void
  dispose: () => void
}

type Extents = { hx: number; hy: number; hz: number; hs: number }
type Sign = -1 | 0 | 1

type ScaleSlot = {
  id: string
  axis: "sall" | "sx" | "sy" | "sz"
  sign: { x: Sign; y: Sign; z: Sign }
  color: number
  size: number
  place: (e: Extents, out: THREE.Vector3) => void
}

type RotAxis = "rx" | "ry" | "rz"

const ARC_STEPS = 12
const ARC_SWEEP = 0.9
const ARC_START = -0.15
const UP = new THREE.Vector3(0, 1, 0)
const FACE_COLOR = {
  sx: 0xf87171,
  sy: 0x4ade80,
  sz: 0x60a5fa,
  sall: 0xf8fafc,
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
          axis: "sall",
          sign: { x, y, z },
          color: FACE_COLOR.sall,
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
    sign,
    color: FACE_COLOR[axis],
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
  const pickGeo = new THREE.SphereGeometry(1, 8, 6)
  const invisible = new THREE.MeshBasicMaterial({ visible: false })
  disposables.push(cubeGeo, cubeHitGeo, pickGeo, invisible, boxLines.geometry, boxLines.material)

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

  const arrowMats = depthPair(0x3b82f6)
  const arrow = new THREE.Group()
  arrow.name = "move-z"
  const shaftGeo = new THREE.CylinderGeometry(0.42, 0.42, 15, 10)
  const headGeo = new THREE.ConeGeometry(1.65, 4.6, 14)
  const arrowHitGeo = new THREE.CylinderGeometry(3.1, 3.1, 20, 8)
  const shaft = new THREE.Mesh(shaftGeo, arrowMats.front)
  const shaftGhost = new THREE.Mesh(shaftGeo, arrowMats.back)
  shaft.position.y = 7.5
  shaftGhost.position.y = 7.5
  shaft.renderOrder = 1002
  shaftGhost.renderOrder = 1001
  const head = new THREE.Mesh(headGeo, arrowMats.front)
  const headGhost = new THREE.Mesh(headGeo, arrowMats.back)
  head.position.y = 17
  headGhost.position.y = 17
  head.renderOrder = 1002
  headGhost.renderOrder = 1001
  const arrowHit = new THREE.Mesh(arrowHitGeo, invisible)
  arrowHit.position.y = 10
  arrowHit.userData = { gizmoAxis: "mz" satisfies TransformHandleAxis, handleId: "move-z" }
  arrow.add(shaftGhost, shaft, headGhost, head, arrowHit)
  root.add(arrow)
  hitTargets.push(arrowHit)
  disposables.push(arrowMats.front, arrowMats.back, shaftGeo, headGeo, arrowHitGeo)

  const rotColors: Record<RotAxis, number> = {
    rx: 0xf87171,
    ry: 0x4ade80,
    rz: 0x7dd3fc,
  }

  const arcs = (["rx", "ry", "rz"] as const).map((axis) => {
    const mats = depthPair(rotColors[axis])
    const headMats = depthPair(rotColors[axis])
    const tube = new THREE.Mesh(new THREE.BufferGeometry(), mats.front)
    const tubeGhost = new THREE.Mesh(tube.geometry, mats.back)
    tube.name = `rot-${axis}`
    tube.renderOrder = 1002
    tubeGhost.renderOrder = 1001
    tube.frustumCulled = false
    tubeGhost.frustumCulled = false
    tube.userData = { gizmoAxis: axis, handleId: `rot-${axis}` }
    const coneGeo = new THREE.ConeGeometry(1.05, 2.8, 10)
    const headGroup = new THREE.Group()
    const cone = new THREE.Mesh(coneGeo, headMats.front)
    const coneGhost = new THREE.Mesh(coneGeo, headMats.back)
    cone.renderOrder = 1002
    coneGhost.renderOrder = 1001
    cone.userData = { gizmoAxis: axis, handleId: `rot-${axis}` }
    headGroup.add(coneGhost, cone)
    const pickers = [0.2, 0.55, 0.9].map(() => {
      const pick = new THREE.Mesh(pickGeo, invisible)
      pick.userData = { gizmoAxis: axis, handleId: `rot-${axis}` }
      return pick
    })
    root.add(tubeGhost, tube, headGroup, ...pickers)
    hitTargets.push(tube, cone, ...pickers)
    disposables.push(mats.front, mats.back, headMats.front, headMats.back, coneGeo)
    return {
      axis,
      tube,
      tubeGhost,
      mats,
      headMats,
      headGroup,
      pickers,
      pts: Array.from({ length: ARC_STEPS + 1 }, () => new THREE.Vector3()),
      cache: { radius: -1, origin: 0, tubeR: -1 },
    }
  })

  const box3 = new THREE.Box3()
  const corner = new THREE.Vector3()
  const frameCenter = new THREE.Vector3()
  const worldCenter = new THREE.Vector3()
  const size = new THREE.Vector3()
  const camLocal = new THREE.Vector3()
  const tangent = new THREE.Vector3()
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
    const arrowColor = arrowHot ? 0x93c5fd : 0x3b82f6
    arrowMats.front.color.set(arrowColor)
    arrowMats.back.color.set(arrowColor)
    for (const arc of arcs) {
      const hot = hoveredId === `rot-${arc.axis}`
      const color = hot ? 0xffffff : rotColors[arc.axis]
      arc.mats.front.color.set(color)
      arc.mats.back.color.set(color)
      arc.headMats.front.color.set(color)
      arc.headMats.back.color.set(color)
      arc.headGroup.scale.setScalar(hs * (hot ? 1.22 : 1))
    }
  }

  const writeArc = (arc: (typeof arcs)[number], radius: number, origin: number) => {
    for (let i = 0; i <= ARC_STEPS; i++) {
      const a = ARC_START + (ARC_SWEEP * i) / ARC_STEPS
      const c = Math.cos(a) * radius
      const s = Math.sin(a) * radius
      const p = arc.pts[i]
      if (arc.axis === "rz") p.set(c, s, origin)
      else if (arc.axis === "rx") p.set(origin, c, s)
      else p.set(s, origin, c)
    }
  }

  const syncArc = (arc: (typeof arcs)[number], radius: number, origin: number, tubeR: number) => {
    const cache = arc.cache
    const dirty =
      Math.abs(radius - cache.radius) > 0.2 ||
      Math.abs(origin - cache.origin) > 0.2 ||
      Math.abs(tubeR - cache.tubeR) > 0.04
    if (!dirty) return
    writeArc(arc, radius, origin)
    const geom = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(arc.pts),
      ARC_STEPS,
      tubeR,
      5,
      false
    )
    arc.tube.geometry.dispose()
    arc.tube.geometry = geom
    arc.tubeGhost.geometry = geom
    cache.radius = radius
    cache.origin = origin
    cache.tubeR = tubeR
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
    getScaleDrag: (sign) => {
      root.updateMatrixWorld(true)
      const anchor = new THREE.Vector3(-sign.x * hx, -sign.y * hy, -sign.z * hz)
      const handle = new THREE.Vector3(sign.x * hx, sign.y * hy, sign.z * hz)
      const span = Math.max(anchor.distanceTo(handle), 0.5)
      root.localToWorld(anchor)
      const direction = new THREE.Vector3(sign.x, sign.y, sign.z).normalize()
      direction.transformDirection(root.matrixWorld)
      return {
        quaternion: root.quaternion.clone(),
        anchor,
        direction,
        span,
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
      const ext: Extents = { hx, hy, hz, hs }
      for (const handle of scaleHandles) handle.place(ext, handle.group.position)

      const signZ = camLocal.z >= 0 ? 1 : -1
      const lift = Math.max(1.6, hs * 2.2)
      arrow.position.set(0, 0, signZ * (hz + lift + hs * 1.4))
      arrow.rotation.set(signZ > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0)

      const arcRadius = (u: number, v: number) =>
        Math.min(hs * 5.6, Math.max(Math.min(u, v) * 0.72, hs * 3.4))
      const tubeR = hs * 0.46
      const layouts: Record<RotAxis, { radius: number; origin: number }> = {
        rz: { radius: arcRadius(hx, hy), origin: hz + lift },
        rx: { radius: arcRadius(hy, hz), origin: hx + lift },
        ry: { radius: arcRadius(hx, hz), origin: hy + lift },
      }
      for (const arc of arcs) {
        const layout = layouts[arc.axis]
        syncArc(arc, layout.radius, layout.origin, tubeR)
        const end = arc.pts[ARC_STEPS]
        const prev = arc.pts[ARC_STEPS - 1]
        tangent.copy(end).sub(prev)
        if (tangent.lengthSq() < 1e-8) tangent.set(0, 0, 1)
        else tangent.normalize()
        arc.headGroup.position.copy(end).addScaledVector(tangent, hs * 0.9)
        arc.headGroup.quaternion.setFromUnitVectors(UP, tangent)
        arc.pickers.forEach((pick, index) => {
          const i = Math.round((index === 0 ? 0.2 : index === 1 ? 0.55 : 0.9) * ARC_STEPS)
          pick.position.copy(arc.pts[i])
          pick.scale.setScalar(hs * 2.6)
        })
      }

      paint(hs)
    },
    dispose: () => {
      for (const arc of arcs) arc.tube.geometry.dispose()
      for (const item of disposables) item.dispose()
      root.removeFromParent()
    },
  }
}
