import * as THREE from "three"
import { ToolMode } from "../types/editor"
import { AXIS_COLORS, BED_AXIS } from "./transformBoxRig"

const HANDLE_UP = new THREE.Vector3(0, 1, 0)

/** Point a +Y-authored handle along a bed axis (+X, +Y, or +Z). */
function pointHandleAlong(group: THREE.Object3D, axis: "x" | "y" | "z") {
  const dir = BED_AXIS[axis]
  if (dir.distanceToSquared(HANDLE_UP) < 1e-8) return
  group.quaternion.setFromUnitVectors(HANDLE_UP, dir)
}

export function buildModeGizmo() {
  const root = new THREE.Group()
  const moveGroup = new THREE.Group()
  const rotateGroup = new THREE.Group()
  const scaleGroup = new THREE.Group()
  root.add(moveGroup, rotateGroup, scaleGroup)

  const entries: Record<string, { swapToBold: (bold: boolean) => void }> = {}
  const moveArrowGroups: Partial<Record<"mx" | "my" | "mz", THREE.Group>> = {}
  const ringUpdates: Array<(toCamLocal: THREE.Vector3) => void> = []
  const toCamLocal = new THREE.Vector3()
  const invRootQuat = new THREE.Quaternion()

  const addMoveArrow = (axis: "mx" | "my" | "mz", color: number) => {
    const g = new THREE.Group()
    const mat = new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
    })
    const thinShaft = new THREE.CylinderGeometry(0.48, 0.48, 24, 10)
    const boldShaft = new THREE.CylinderGeometry(0.95, 0.95, 24, 10)
    const thinHead = new THREE.ConeGeometry(1.75, 5.5, 14)
    const boldHead = new THREE.ConeGeometry(2.4, 6.2, 14)

    const shaft = new THREE.Mesh(thinShaft, mat)
    shaft.position.y = 12
    shaft.renderOrder = 1000

    const head = new THREE.Mesh(thinHead, mat)
    head.position.y = 26
    head.renderOrder = 1000

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.2, 30, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    )
    hit.position.y = 15
    hit.userData = { gizmoAxis: axis }

    g.add(shaft, head, hit)
    pointHandleAlong(g, axis === "mx" ? "x" : axis === "my" ? "y" : "z")
    moveGroup.add(g)
    moveArrowGroups[axis] = g

    entries[axis] = {
      swapToBold: (b) => {
        shaft.geometry = b ? boldShaft : thinShaft
        head.geometry = b ? boldHead : thinHead
      },
    }
  }

  const addRotateRing = (axis: "rx" | "ry" | "rz", color: number) => {
    const g = new THREE.Group()
    const frontMat = new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
    })
    const backMat = new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.35,
      toneMapped: false,
    })

    const thinHalf = new THREE.TorusGeometry(17, 0.38, 8, 32, Math.PI)
    const boldHalf = new THREE.TorusGeometry(17, 0.88, 8, 32, Math.PI)

    const frontArc = new THREE.Mesh(thinHalf, frontMat)
    frontArc.renderOrder = 1000
    const backArc = new THREE.Mesh(thinHalf, backMat)
    backArc.rotation.z = Math.PI
    backArc.renderOrder = 1000

    const hit = new THREE.Mesh(
      new THREE.TorusGeometry(17, 2.3, 8, 36),
      new THREE.MeshBasicMaterial({ visible: false })
    )
    hit.userData = { gizmoAxis: axis }

    g.add(frontArc, backArc, hit)
    if (axis === "rx") g.rotation.y = Math.PI / 2
    if (axis === "ry") g.rotation.x = Math.PI / 2
    rotateGroup.add(g)

    ringUpdates.push((toCam) => {
      const ang =
        (axis === "rz"
          ? Math.atan2(toCam.y, toCam.x)
          : axis === "rx"
            ? Math.atan2(toCam.y, -toCam.z)
            : Math.atan2(toCam.z, toCam.x)) -
        Math.PI / 2
      frontArc.rotation.z = ang
      backArc.rotation.z = ang + Math.PI
    })

    entries[axis] = {
      swapToBold: (b) => {
        frontArc.geometry = b ? boldHalf : thinHalf
        backArc.geometry = b ? boldHalf : thinHalf
        backMat.opacity = b ? 0.65 : 0.35
      },
    }
  }

  const addScaleHandle = (axis: "sx" | "sy" | "sz" | "sall", color: number) => {
    const g = new THREE.Group()
    const mat = new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
    })

    if (axis === "sall") {
      const thinBox = new THREE.BoxGeometry(2.08, 2.08, 2.08)
      const boldBox = new THREE.BoxGeometry(2.86, 2.86, 2.86)
      const box = new THREE.Mesh(thinBox, mat)
      box.renderOrder = 1000
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(4.29, 4.29, 4.29),
        new THREE.MeshBasicMaterial({ visible: false })
      )
      hit.userData = { gizmoAxis: axis }
      g.add(box, hit)
      scaleGroup.add(g)
      entries[axis] = {
        swapToBold: (b) => {
          box.geometry = b ? boldBox : thinBox
        },
      }
      return
    }

    const thinShaft = new THREE.CylinderGeometry(0.42, 0.42, 22, 8)
    const boldShaft = new THREE.CylinderGeometry(0.85, 0.85, 22, 8)
    const thinCube = new THREE.BoxGeometry(1.82, 1.82, 1.82)
    const boldCube = new THREE.BoxGeometry(2.47, 2.47, 2.47)

    const shaft = new THREE.Mesh(thinShaft, mat)
    shaft.position.y = 11
    shaft.renderOrder = 1000

    const cube = new THREE.Mesh(thinCube, mat)
    cube.position.y = 23
    cube.renderOrder = 1000

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, 26, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    )
    hit.position.y = 13
    hit.userData = { gizmoAxis: axis }

    g.add(shaft, cube, hit)
    pointHandleAlong(g, axis === "sx" ? "x" : axis === "sy" ? "y" : "z")
    scaleGroup.add(g)

    entries[axis] = {
      swapToBold: (b) => {
        shaft.geometry = b ? boldShaft : thinShaft
        cube.geometry = b ? boldCube : thinCube
      },
    }
  }

  addMoveArrow("mx", AXIS_COLORS.x)
  addMoveArrow("my", AXIS_COLORS.y)
  addMoveArrow("mz", AXIS_COLORS.z)
  addRotateRing("rx", AXIS_COLORS.x)
  addRotateRing("ry", AXIS_COLORS.y)
  addRotateRing("rz", AXIS_COLORS.z)
  addScaleHandle("sx", AXIS_COLORS.x)
  addScaleHandle("sy", AXIS_COLORS.y)
  addScaleHandle("sz", AXIS_COLORS.z)
  addScaleHandle("sall", 0xe2e8f0)
  root.renderOrder = 1000

  return {
    root,
    setMode: (m: ToolMode) => {
      moveGroup.visible = m === "move"
      rotateGroup.visible = m === "rotate"
      scaleGroup.visible = m === "scale"
    },
    setHovered: (ax: string | null) => {
      for (const [k, e] of Object.entries(entries)) e.swapToBold(k === ax)
    },
    getActiveHitTargets: (m: ToolMode) => {
      if (m === "move") return moveGroup.children
      if (m === "rotate") return rotateGroup.children
      if (m === "scale") return scaleGroup.children
      return []
    },
    getMoveAxisTipWorld: (axis: "mx" | "my" | "mz") => {
      const g = moveArrowGroups[axis]
      if (!g) return null
      g.updateMatrixWorld(true)
      const tip = new THREE.Vector3(0, 26 + 2.75, 0)
      g.localToWorld(tip)
      return tip
    },
    updatePerspectiveOrientation: (cam: THREE.Camera) => {
      if (!root.visible) return
      const s = (cam as THREE.OrthographicCamera).isOrthographicCamera
        ? THREE.MathUtils.clamp(
            1 / (cam as THREE.OrthographicCamera).zoom,
            0.55,
            2.2
          )
        : THREE.MathUtils.clamp(cam.position.distanceTo(root.position) / 360, 0.55, 2.2)
      root.scale.setScalar(s)
      toCamLocal.copy(cam.position).sub(root.position)
      invRootQuat.copy(root.quaternion).invert()
      toCamLocal.applyQuaternion(invRootQuat)
      for (const fn of ringUpdates) fn(toCamLocal)
    },
  }
}
