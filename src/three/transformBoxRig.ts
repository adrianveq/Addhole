import * as THREE from "three"

/**
 * Bounding-box manipulator for ToolMode "transform".
 *
 * Handle ids reuse the viewport drag axes so scale / lift / rotate stay in one place:
 * - corners → sall (uniform scale about the box center)
 * - ±X / ±Y face points → sx / sy
 * - ±Z face points → sz
 * - blue arrow → mz, parked on the camera side of the box
 * - wall arcs → rx / ry / rz
 *
 * OrbitControls enable/disable stays in ViewportCanvas.
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

export interface TransformBoxRig {
  root: THREE.Group
  setVisible: (visible: boolean) => void
  setTargets: (meshes: THREE.Object3D[]) => void
  hasTargets: () => boolean
  setHovered: (handleId: string | null) => void
  getHitTargets: () => THREE.Object3D[]
  update: (camera: THREE.Camera) => void
  dispose: () => void
}

type Extents = { hx: number; hy: number; hz: number; hs: number }

type ScaleSlot = {
  id: string
  axis: "sall" | "sx" | "sy" | "sz"
  size: number
  place: (e: Extents, out: THREE.Vector3) => void
}

type RotAxis = "rx" | "ry" | "rz"

const ARC_STEPS = 16
const UP = new THREE.Vector3(0, 1, 0)

function basicMat(color: number, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
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
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        slots.push({
          id: `corner-${x}${y}${z}`,
          axis: "sall",
          size: 1,
          place: (e, out) => out.set(x * e.hx, y * e.hy, z * e.hz),
        })
      }
    }
  }
  slots.push(
    {
      id: "side-x+",
      axis: "sx",
      size: 0.82,
      place: (e, out) => out.set(e.hx + e.hs * 0.85, 0, 0),
    },
    {
      id: "side-x-",
      axis: "sx",
      size: 0.82,
      place: (e, out) => out.set(-e.hx - e.hs * 0.85, 0, 0),
    },
    {
      id: "side-y+",
      axis: "sy",
      size: 0.82,
      place: (e, out) => out.set(0, e.hy + e.hs * 0.85, 0),
    },
    {
      id: "side-y-",
      axis: "sy",
      size: 0.82,
      place: (e, out) => out.set(0, -e.hy - e.hs * 0.85, 0),
    },
    {
      id: "height-z+",
      axis: "sz",
      size: 0.82,
      place: (e, out) => out.set(0, 0, e.hz),
    },
    {
      id: "height-z-",
      axis: "sz",
      size: 0.82,
      place: (e, out) => out.set(0, 0, -e.hz),
    }
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
      opacity: 0.92,
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
    const material = basicMat(0xf8fafc)
    const visual = new THREE.Mesh(cubeGeo, material)
    visual.renderOrder = 1002
    const hit = new THREE.Mesh(cubeHitGeo, invisible)
    hit.userData = { gizmoAxis: slot.axis, handleId: slot.id }
    const group = new THREE.Group()
    group.name = slot.id
    group.add(visual, hit)
    root.add(group)
    hitTargets.push(hit)
    disposables.push(material)
    return { ...slot, group, material }
  })

  const arrowMat = basicMat(0x3b82f6)
  const arrow = new THREE.Group()
  arrow.name = "move-z"
  const shaftGeo = new THREE.CylinderGeometry(0.42, 0.42, 15, 10)
  const headGeo = new THREE.ConeGeometry(1.65, 4.6, 14)
  const arrowHitGeo = new THREE.CylinderGeometry(3.1, 3.1, 20, 8)
  const shaft = new THREE.Mesh(shaftGeo, arrowMat)
  shaft.position.y = 7.5
  shaft.renderOrder = 1002
  const head = new THREE.Mesh(headGeo, arrowMat)
  head.position.y = 17
  head.renderOrder = 1002
  const arrowHit = new THREE.Mesh(arrowHitGeo, invisible)
  arrowHit.position.y = 10
  arrowHit.userData = { gizmoAxis: "mz" satisfies TransformHandleAxis, handleId: "move-z" }
  arrow.add(shaft, head, arrowHit)
  root.add(arrow)
  hitTargets.push(arrowHit)
  disposables.push(arrowMat, shaftGeo, headGeo, arrowHitGeo)

  const rotColors: Record<RotAxis, number> = {
    rx: 0xf87171,
    ry: 0x4ade80,
    rz: 0x7dd3fc,
  }
  const rotBearing: Record<RotAxis, (cam: THREE.Vector3) => number> = {
    rz: (cam) => Math.atan2(cam.y, cam.x),
    rx: (cam) => Math.atan2(cam.z, cam.y),
    ry: (cam) => Math.atan2(cam.x, cam.z),
  }

  const arcs = (["rx", "ry", "rz"] as const).map((axis) => {
    const material = basicMat(rotColors[axis])
    const headMat = basicMat(rotColors[axis])
    const tube = new THREE.Mesh(new THREE.BufferGeometry(), material)
    tube.name = `rot-${axis}`
    tube.renderOrder = 1001
    tube.frustumCulled = false
    tube.userData = { gizmoAxis: axis, handleId: `rot-${axis}` }
    const coneGeo = new THREE.ConeGeometry(1.15, 3.3, 10)
    const cone = new THREE.Mesh(coneGeo, headMat)
    cone.renderOrder = 1002
    cone.userData = { gizmoAxis: axis, handleId: `rot-${axis}` }
    const pickers = [0.18, 0.5, 0.82].map((t) => {
      const pick = new THREE.Mesh(pickGeo, invisible)
      pick.userData = { gizmoAxis: axis, handleId: `rot-${axis}`, t }
      return pick
    })
    root.add(tube, cone, ...pickers)
    hitTargets.push(tube, cone, ...pickers)
    disposables.push(material, headMat, coneGeo)
    const pts = Array.from({ length: ARC_STEPS + 1 }, () => new THREE.Vector3())
    return {
      axis,
      tube,
      cone,
      pickers,
      pts,
      cache: { radius: -1, origin: 0, bearing: 0, tubeR: -1 },
    }
  })

  const box3 = new THREE.Box3()
  const localBox = new THREE.Box3()
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  const camLocal = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  let boxKey = ""
  let hoveredId: string | null = null
  let hx = 1
  let hy = 1
  let hz = 1

  const paint = (hs: number) => {
    for (const handle of scaleHandles) {
      const hot = handle.id === hoveredId
      handle.group.scale.setScalar(hs * handle.size * (hot ? 1.22 : 1))
      handle.material.color.set(hot ? 0xffffff : 0xf8fafc)
    }
    const arrowHot = hoveredId === "move-z"
    arrow.scale.setScalar(hs * (arrowHot ? 1.16 : 1))
    arrowMat.color.set(arrowHot ? 0x93c5fd : 0x3b82f6)
    for (const arc of arcs) {
      const hot = hoveredId === `rot-${arc.axis}`
      const color = hot ? 0xffffff : rotColors[arc.axis]
      arc.cone.scale.setScalar(hs * (hot ? 1.28 : 1))
      ;(arc.tube.material as THREE.MeshBasicMaterial).color.set(color)
      ;(arc.cone.material as THREE.MeshBasicMaterial).color.set(color)
    }
  }

  const writeArc = (
    arc: (typeof arcs)[number],
    radius: number,
    origin: number,
    bearing: number
  ) => {
    const sweep = 1.05
    const start = bearing - sweep / 2
    for (let i = 0; i <= ARC_STEPS; i++) {
      const a = start + (sweep * i) / ARC_STEPS
      const c = Math.cos(a) * radius
      const s = Math.sin(a) * radius
      const p = arc.pts[i]
      if (arc.axis === "rz") p.set(c, s, origin)
      else if (arc.axis === "rx") p.set(origin, c, s)
      else p.set(s, origin, c)
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
        box3.makeEmpty()
        for (const mesh of targets) {
          const geom = (mesh as THREE.Mesh).geometry
          mesh.updateMatrixWorld(true)
          if (geom) {
            if (!geom.boundingBox) geom.computeBoundingBox()
            if (geom.boundingBox && !geom.boundingBox.isEmpty()) {
              localBox.copy(geom.boundingBox).applyMatrix4(mesh.matrixWorld)
              box3.union(localBox)
              continue
            }
          }
          box3.expandByObject(mesh)
        }
        if (box3.isEmpty()) {
          root.visible = false
          return
        }
        box3.getCenter(center)
        box3.getSize(size)
        hx = Math.max(size.x * 0.5, 0.4)
        hy = Math.max(size.y * 0.5, 0.4)
        hz = Math.max(size.z * 0.5, 0.4)
        boxKey = key
        boxLines.scale.set(hx * 2, hy * 2, hz * 2)
      }

      root.position.copy(center)
      root.rotation.set(0, 0, 0)
      root.scale.set(1, 1, 1)
      root.updateMatrixWorld(true)
      camLocal.copy(camera.position)
      root.worldToLocal(camLocal)

      const hs = manipulatorScale(camera, center)
      const ext: Extents = { hx, hy, hz, hs }
      for (const handle of scaleHandles) handle.place(ext, handle.group.position)

      const signX = camLocal.x >= 0 ? 1 : -1
      const signY = camLocal.y >= 0 ? 1 : -1
      const signZ = camLocal.z >= 0 ? 1 : -1
      const pad = Math.max(2.2, hs * 3.4)

      arrow.position.set(0, 0, signZ * (hz + pad + hs * 1.2))
      arrow.rotation.set(signZ > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0)

      const wallRadius = (a: number, b: number) => Math.max(hs * 8, Math.min(a, b) * 0.78)
      const layouts: Record<RotAxis, { radius: number; origin: number }> = {
        rz: { radius: wallRadius(hx, hy), origin: signZ * (hz + pad * 0.45) },
        rx: { radius: wallRadius(hy, hz), origin: signX * (hx + pad * 0.45) },
        ry: { radius: wallRadius(hx, hz), origin: signY * (hy + pad * 0.45) },
      }

      const tubeR = hs * 0.62
      for (const arc of arcs) {
        const layout = layouts[arc.axis]
        const bearing = rotBearing[arc.axis](camLocal)
        const cache = arc.cache
        const dirty =
          Math.abs(layout.radius - cache.radius) > 0.25 ||
          Math.abs(layout.origin - cache.origin) > 0.25 ||
          Math.abs(bearing - cache.bearing) > 0.03 ||
          Math.abs(tubeR - cache.tubeR) > 0.04
        if (dirty) {
          writeArc(arc, layout.radius, layout.origin, bearing)
          const geom = new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(arc.pts),
            ARC_STEPS,
            tubeR,
            5,
            false
          )
          arc.tube.geometry.dispose()
          arc.tube.geometry = geom
          cache.radius = layout.radius
          cache.origin = layout.origin
          cache.bearing = bearing
          cache.tubeR = tubeR
        }
        const end = arc.pts[ARC_STEPS]
        const prev = arc.pts[ARC_STEPS - 1]
        tangent.copy(end).sub(prev)
        if (tangent.lengthSq() < 1e-8) tangent.set(0, 0, 1)
        else tangent.normalize()
        arc.cone.position.copy(end).addScaledVector(tangent, hs * 1.15)
        arc.cone.quaternion.setFromUnitVectors(UP, tangent)
        arc.pickers.forEach((pick, index) => {
          const t = index === 0 ? 0.18 : index === 1 ? 0.5 : 0.82
          const i = Math.round(t * ARC_STEPS)
          pick.position.copy(arc.pts[i])
          pick.scale.setScalar(hs * 3.3)
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
