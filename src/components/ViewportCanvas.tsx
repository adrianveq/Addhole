import * as React from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import {
  EditingGroupState,
  SceneControllerHandle,
  SceneObject,
  ToolMode,
} from "../types/editor"
import { extractCoplanarPatchGeometry } from "../three/geometryOps"
import {
  buildBottomContactGeometry,
  buildCornerBracketsGeometry,
  createBananaMesh,
  createBuildPlate,
} from "../three/sceneHelpers"
import { buildModeGizmo } from "../three/gizmo"
import { createTransformBoxRig } from "../three/transformBoxRig"
import { parse3mfToGeometry, parseStepToGeometry } from "../utils/fileLoaders"

export interface ViewportCanvasProps {
  sceneRef: React.MutableRefObject<SceneControllerHandle | null>
  bgHex: string
  accent: string
  accentBorder: string
  bananaCm: number
  gridSizeCm: number
  gridStepCm: number
  objects: SceneObject[]
  selectedIds: string[]
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>
  toolMode: ToolMode
  isOrtho: boolean
  isTurntable: boolean
  setIsTurntable: React.Dispatch<React.SetStateAction<boolean>>
  showGrid: boolean
  showScaleRef: boolean
  showWireframe: boolean
  showEdgeHighlight: boolean
  layOnFaceMode: boolean
  setLayOnFaceMode: React.Dispatch<React.SetStateAction<boolean>>
  marqueeSelectMode: boolean
  editingGroupState: EditingGroupState | null
  exitGroupIsolation: (nextSelectedIdsAfterExit?: string[]) => Promise<void>
  applyLayOnFace: (objId: string, worldFaceNormal: THREE.Vector3) => void
  setPlateSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>
  setContextMenu: React.Dispatch<React.SetStateAction<null | { x: number; y: number }>>
  setMarqueeBox: React.Dispatch<
    React.SetStateAction<null | { x: number; y: number; w: number; h: number }>
  >
  customRefModel: { name: string; geometry: THREE.BufferGeometry } | null
  scaleRefModel?: { file?: string; name?: string }
  commitObjects: (updater: (prev: SceneObject[]) => SceneObject[], recordHistory?: boolean) => void
  historyRef: React.MutableRefObject<{ past: SceneObject[][]; future: SceneObject[][] }>
  syncHistFlags: () => void
}

export function ViewportCanvas(props: ViewportCanvasProps) {
  const {
    sceneRef,
    bgHex,
    accent,
    accentBorder,
    bananaCm,
    gridSizeCm,
    gridStepCm,
    objects,
    selectedIds,
    setSelectedIds,
    toolMode,
    isOrtho,
    isTurntable,
    setIsTurntable,
    showGrid,
    showScaleRef,
    showWireframe,
    showEdgeHighlight,
    layOnFaceMode,
    setLayOnFaceMode,
    marqueeSelectMode,
    editingGroupState,
    exitGroupIsolation,
    applyLayOnFace,
    setPlateSettingsOpen,
    setContextMenu,
    setMarqueeBox,
    customRefModel,
    scaleRefModel,
    commitObjects,
    historyRef,
    syncHistFlags,
  } = props

  const mountRef = React.useRef<HTMLDivElement>(null)
  const commitRef = React.useRef(commitObjects)
  React.useEffect(() => {
    commitRef.current = commitObjects
  }, [commitObjects])

  React.useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(bgHex)

    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    const aspect = w / h
    const dist = 25 * 14.5

    const perspCam = new THREE.PerspectiveCamera(36, aspect, 1, 5000)
    perspCam.up.set(0, 0, 1)
    perspCam.position.set(dist * 0.85, -dist * 1.15, dist * 0.88)

    const halfH = 25 * 8.5
    const orthoCam = new THREE.OrthographicCamera(
      -halfH * aspect,
      halfH * aspect,
      halfH,
      -halfH,
      -3000,
      5000
    )
    orthoCam.up.set(0, 0, 1)
    orthoCam.position.copy(perspCam.position)

    let activeCam: THREE.PerspectiveCamera | THREE.OrthographicCamera = perspCam

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(w, h)
    renderer.domElement.style.touchAction = "none"
    container.innerHTML = ""
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(activeCam, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    }
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.36))
    const hemi = new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 0.42)
    hemi.position.set(0, 0, 300)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.15)
    keyLight.position.set(-190, -240, 310)
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.42)
    fillLight.position.set(240, 160, 95)
    const rimLight = new THREE.DirectionalLight(0xe2e8f0, 0.35)
    rimLight.position.set(40, 260, -140)
    scene.add(hemi, keyLight, fillLight, rimLight)

    const plateObj = createBuildPlate(gridSizeCm, gridStepCm)
    scene.add(plateObj.group)

    const refGroup = new THREE.Group()
    refGroup.add(createBananaMesh(bananaCm))
    refGroup.position.set(0, (gridSizeCm * 10) / 2 + 26, 0)
    scene.add(refGroup)

    const gizmoCtrl = buildModeGizmo()
    gizmoCtrl.root.visible = false
    scene.add(gizmoCtrl.root)

    const transformRig = createTransformBoxRig()
    transformRig.root.visible = false
    scene.add(transformRig.root)

    const faceHighlightMesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(accentBorder),
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    )
    faceHighlightMesh.visible = false
    faceHighlightMesh.renderOrder = 25
    scene.add(faceHighlightMesh)

    let lastHighlightedSig = ""
    const clearFaceHighlight = () => {
      if (faceHighlightMesh.visible) {
        faceHighlightMesh.visible = false
        faceHighlightMesh.geometry.dispose()
        faceHighlightMesh.geometry = new THREE.BufferGeometry()
        lastHighlightedSig = ""
      }
    }

    const meshMap = new Map<string, THREE.Mesh>()
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const dragPlane = new THREE.Plane()
    const hitPt = new THREE.Vector3()

    let activeDrag: null | {
      axis: string
      ids: string[]
      snapshot: SceneObject[]
      pivotWorld: THREE.Vector3
      startHit: THREE.Vector3
      startScreenX: number
      startScreenY: number
      startTransforms: Record<
        string,
        {
          pos: { x: number; y: number; z: number }
          rot: { x: number; y: number; z: number }
          scale: { sx: number; sy: number; sz: number }
          quat: THREE.Quaternion
        }
      >
      startAngle: number
    } = null

    let marqueeState: null | {
      startX: number
      startY: number
      additive: boolean
      baseSelection: string[]
    } = null
    let emptyPointerDown: null | { x: number; y: number } = null
    let rightPointerDown: null | { x: number; y: number } = null

    const updateRay = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, activeCam)
    }

    const captureStartTransforms = (ids: string[]) => {
      const map: Record<
        string,
        {
          pos: { x: number; y: number; z: number }
          rot: { x: number; y: number; z: number }
          scale: { sx: number; sy: number; sz: number }
          quat: THREE.Quaternion
        }
      > = {}
      for (const id of ids) {
        const m = meshMap.get(id)
        if (m) {
          map[id] = {
            pos: {
              x: m.position.x / 10,
              y: m.position.y / 10,
              z: m.position.z / 10,
            },
            rot: {
              x: THREE.MathUtils.radToDeg(m.rotation.x),
              y: THREE.MathUtils.radToDeg(m.rotation.y),
              z: THREE.MathUtils.radToDeg(m.rotation.z),
            },
            scale: { sx: m.scale.x, sy: m.scale.y, sz: m.scale.z },
            quat: m.quaternion.clone(),
          }
        }
      }
      return map
    }

    const snapshotAll = (): SceneObject[] =>
      (sceneRef.current?.latestObjects || []).map((o) => ({
        ...o,
        scale: { ...o.scale },
        pos: { ...o.pos },
        rot: { ...o.rot },
      }))

    const getInteractiveMeshes = () => {
      const ghostIds = new Set(
        (sceneRef.current?.latestObjects || [])
          .filter((o) => o.isGhostContext)
          .map((o) => o.id)
      )
      return Array.from(meshMap.entries())
        .filter(([id, m]) => m.visible && !ghostIds.has(id))
        .map(([, m]) => m)
    }

    const onContextMenu = (e: MouseEvent) => e.preventDefault()

    const onPointerDown = (e: PointerEvent) => {
      setContextMenu(null)
      if (e.button === 2) {
        rightPointerDown = { x: e.clientX, y: e.clientY }
        return
      }
      if (e.button !== 0) return
      updateRay(e)

      if (sceneRef.current?.layOnFaceMode) {
        const mHits = raycaster.intersectObjects(getInteractiveMeshes(), false)
        clearFaceHighlight()
        if (mHits.length > 0 && mHits[0].face) {
          const hitMesh = mHits[0].object as THREE.Mesh
          const clickedId = hitMesh.userData?.objId as string
          hitMesh.updateMatrixWorld(true)
          const posAttr = hitMesh.geometry.attributes.position
          const f = mHits[0].face
          const vA = new THREE.Vector3()
            .fromBufferAttribute(posAttr, f.a)
            .applyMatrix4(hitMesh.matrixWorld)
          const vB = new THREE.Vector3()
            .fromBufferAttribute(posAttr, f.b)
            .applyMatrix4(hitMesh.matrixWorld)
          const vC = new THREE.Vector3()
            .fromBufferAttribute(posAttr, f.c)
            .applyMatrix4(hitMesh.matrixWorld)
          const worldNormal = new THREE.Vector3()
            .subVectors(vB, vA)
            .cross(new THREE.Vector3().subVectors(vC, vA))
            .normalize()
          sceneRef.current?.applyLayOnFace(clickedId, worldNormal)
        } else {
          setLayOnFaceMode(false)
        }
        return
      }

      if (
        plateObj.group.visible &&
        raycaster.intersectObject(plateObj.gearTab, false).length > 0
      ) {
        setPlateSettingsOpen((v) => !v)
        return
      }

      const curSelIds: string[] = sceneRef.current?.selectedIds || []
      const primaryId = curSelIds[curSelIds.length - 1] || null

      const startAxisDrag = (axis: string, pivot: THREE.Vector3, id: string) => {
        if (!meshMap.get(id)) return false
        controls.enabled = false
        setIsTurntable(false)
        const normal =
          axis === "rx"
            ? new THREE.Vector3(1, 0, 0)
            : axis === "ry"
              ? new THREE.Vector3(0, 1, 0)
              : new THREE.Vector3(0, 0, 1)
        dragPlane.setFromNormalAndCoplanarPoint(normal, pivot)
        raycaster.ray.intersectPlane(dragPlane, hitPt)
        const startAngle =
          axis === "rx"
            ? Math.atan2(hitPt.z - pivot.z, hitPt.y - pivot.y)
            : axis === "ry"
              ? Math.atan2(hitPt.x - pivot.x, hitPt.z - pivot.z)
              : Math.atan2(hitPt.y - pivot.y, hitPt.x - pivot.x)
        activeDrag = {
          axis,
          ids: curSelIds,
          snapshot: snapshotAll(),
          pivotWorld: pivot.clone(),
          startHit: hitPt.clone(),
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startTransforms: captureStartTransforms(curSelIds),
          startAngle,
        }
        return true
      }

      if (
        sceneRef.current?.toolMode === "transform" &&
        transformRig.root.visible &&
        primaryId
      ) {
        const gHits = raycaster.intersectObjects(transformRig.getHitTargets(), false)
        const axisHit = gHits.find((h) => h.object.userData?.gizmoAxis)
        if (
          axisHit &&
          startAxisDrag(axisHit.object.userData.gizmoAxis as string, transformRig.root.position, primaryId)
        ) {
          return
        }
      }

      if (gizmoCtrl.root.visible && primaryId) {
        const mode = sceneRef.current?.toolMode || "move"
        const gHits = raycaster.intersectObjects(
          gizmoCtrl.getActiveHitTargets(mode),
          true
        )
        const axisHit = gHits.find((h) => h.object.userData?.gizmoAxis)
        if (
          axisHit &&
          startAxisDrag(
            axisHit.object.userData.gizmoAxis as string,
            gizmoCtrl.root.position,
            primaryId
          )
        ) {
          return
        }
      }

      const mHits = raycaster.intersectObjects(getInteractiveMeshes(), false)
      if (mHits.length > 0) {
        const clickedId = mHits[0].object.userData?.objId as string
        if (!clickedId) return

        controls.enabled = false
        let nextSel: string[]
        if (
          e.shiftKey ||
          e.ctrlKey ||
          e.metaKey ||
          sceneRef.current?.marqueeSelectMode
        ) {
          nextSel = curSelIds.includes(clickedId)
            ? curSelIds.filter((id) => id !== clickedId)
            : [...curSelIds, clickedId]
        } else {
          nextSel = curSelIds.includes(clickedId) ? curSelIds : [clickedId]
        }
        setSelectedIds(nextSel)

        if (nextSel.includes(clickedId)) {
          setIsTurntable(false)
          dragPlane.setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 0, 1),
            mHits[0].point
          )
          if (raycaster.ray.intersectPlane(dragPlane, hitPt)) {
            activeDrag = {
              axis: "mxy_direct",
              ids: nextSel,
              snapshot: snapshotAll(),
              pivotWorld: gizmoCtrl.root.position.clone(),
              startHit: hitPt.clone(),
              startScreenX: e.clientX,
              startScreenY: e.clientY,
              startTransforms: captureStartTransforms(nextSel),
              startAngle: 0,
            }
          }
        }
        return
      }

      const useMarquee = Boolean(
        sceneRef.current?.marqueeSelectMode || e.shiftKey || e.ctrlKey || e.metaKey
      )
      if (useMarquee) {
        controls.enabled = false
        const rect = renderer.domElement.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        marqueeState = {
          startX: sx,
          startY: sy,
          additive: true,
          baseSelection: [...curSelIds],
        }
        setMarqueeBox({ x: sx, y: sy, w: 0, h: 0 })
      } else {
        emptyPointerDown = { x: e.clientX, y: e.clientY }
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      updateRay(e)

      if (marqueeState) {
        const rect = renderer.domElement.getBoundingClientRect()
        const cx = THREE.MathUtils.clamp(e.clientX - rect.left, 0, rect.width)
        const cy = THREE.MathUtils.clamp(e.clientY - rect.top, 0, rect.height)
        const minX = Math.min(marqueeState.startX, cx)
        const maxX = Math.max(marqueeState.startX, cx)
        const minY = Math.min(marqueeState.startY, cy)
        const maxY = Math.max(marqueeState.startY, cy)
        setMarqueeBox({
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY,
        })

        if (maxX - minX > 4 || maxY - minY > 4) {
          const hitIds = new Set<string>(marqueeState.baseSelection)
          const box3 = new THREE.Box3()
          const corners = Array.from({ length: 8 }, () => new THREE.Vector3())
          for (const mesh of getInteractiveMeshes()) {
            const id = mesh.userData.objId
            mesh.updateMatrixWorld(true)
            box3.setFromObject(mesh)
            corners[0].set(box3.min.x, box3.min.y, box3.min.z)
            corners[1].set(box3.min.x, box3.min.y, box3.max.z)
            corners[2].set(box3.min.x, box3.max.y, box3.min.z)
            corners[3].set(box3.min.x, box3.max.y, box3.max.z)
            corners[4].set(box3.max.x, box3.min.y, box3.min.z)
            corners[5].set(box3.max.x, box3.min.y, box3.max.z)
            corners[6].set(box3.max.x, box3.max.y, box3.min.z)
            corners[7].set(box3.max.x, box3.max.y, box3.max.z)
            let oMinX = Infinity
            let oMaxX = -Infinity
            let oMinY = Infinity
            let oMaxY = -Infinity
            for (const c of corners) {
              c.project(activeCam)
              const sx = (c.x + 1) * 0.5 * rect.width
              const sy = (-c.y + 1) * 0.5 * rect.height
              oMinX = Math.min(oMinX, sx)
              oMaxX = Math.max(oMaxX, sx)
              oMinY = Math.min(oMinY, sy)
              oMaxY = Math.max(oMaxY, sy)
            }
            if (oMaxX >= minX && oMinX <= maxX && oMaxY >= minY && oMinY <= maxY) {
              hitIds.add(id)
            }
          }
          setSelectedIds(Array.from(hitIds))
        }
        return
      }

      if (!activeDrag) {
        if (sceneRef.current?.layOnFaceMode) {
          renderer.domElement.style.cursor = "crosshair"
          const mHits = raycaster.intersectObjects(getInteractiveMeshes(), false)
          if (
            mHits.length > 0 &&
            mHits[0].faceIndex !== undefined &&
            mHits[0].faceIndex !== null
          ) {
            const hitMesh = mHits[0].object as THREE.Mesh
            const sig = `${hitMesh.userData?.objId}_${mHits[0].faceIndex}`
            if (sig !== lastHighlightedSig) {
              lastHighlightedSig = sig
              hitMesh.updateMatrixWorld(true)
              const patchGeom = extractCoplanarPatchGeometry(
                hitMesh.geometry,
                mHits[0].faceIndex
              )
              patchGeom.applyMatrix4(hitMesh.matrixWorld)
              faceHighlightMesh.geometry.dispose()
              faceHighlightMesh.geometry = patchGeom
              faceHighlightMesh.visible = true
            }
          } else {
            clearFaceHighlight()
          }
          return
        } else {
          clearFaceHighlight()
        }

        let hov: string | null = null
        const mode = sceneRef.current?.toolMode || "move"
        if (mode === "transform" && transformRig.root.visible) {
          const gHits = raycaster.intersectObjects(transformRig.getHitTargets(), false)
          hov =
            gHits.find((h) => h.object.userData?.handleId)?.object.userData
              ?.handleId || null
          transformRig.setHovered(hov)
          gizmoCtrl.setHovered(null)
        } else {
          transformRig.setHovered(null)
          if (gizmoCtrl.root.visible) {
            const gHits = raycaster.intersectObjects(
              gizmoCtrl.getActiveHitTargets(mode),
              true
            )
            hov =
              gHits.find((h) => h.object.userData?.gizmoAxis)?.object.userData
                ?.gizmoAxis || null
            gizmoCtrl.setHovered(hov)
          }
        }
        const tabHover =
          plateObj.group.visible &&
          raycaster.intersectObject(plateObj.gearTab, false).length > 0
        renderer.domElement.style.cursor =
          hov || tabHover
            ? "pointer"
            : sceneRef.current?.marqueeSelectMode
              ? "crosshair"
              : "default"
        return
      }

      const {
        axis,
        pivotWorld,
        startHit,
        startScreenX,
        startScreenY,
        startTransforms,
        startAngle,
      } = activeDrag
      const moveDamping = 0.72
      const doCommit = commitRef.current

      if (axis === "mz") {
        const dz = (startScreenY - e.clientY) * 0.045
        doCommit(
          (prev) =>
            prev.map((o) =>
              startTransforms[o.id]
                ? {
                    ...o,
                    pos: {
                      ...o.pos,
                      z: Number((startTransforms[o.id].pos.z + dz).toFixed(2)),
                    },
                  }
                : o
            ),
          false
        )
        return
      }

      if (axis === "sz" || axis === "sall") {
        const delta =
          (startScreenY - e.clientY) * 0.008 +
          (axis === "sall" ? (e.clientX - startScreenX) * 0.008 : 0)
        const factor = Math.max(0.05, 1 + delta)
        const sxF = axis === "sall" ? factor : 1
        const syF = axis === "sall" ? factor : 1
        const szF = factor
        doCommit(
          (prev) =>
            prev.map((o) => {
              const st = startTransforms[o.id]
              if (!st) return o
              const offsetMm = new THREE.Vector3(
                (st.pos.x * 10 - pivotWorld.x) * sxF,
                (st.pos.y * 10 - pivotWorld.y) * syF,
                (st.pos.z * 10 - pivotWorld.z) * szF
              )
              return {
                ...o,
                pos: {
                  x: Number(((pivotWorld.x + offsetMm.x) / 10).toFixed(2)),
                  y: Number(((pivotWorld.y + offsetMm.y) / 10).toFixed(2)),
                  z: Number(((pivotWorld.z + offsetMm.z) / 10).toFixed(2)),
                },
                scale: {
                  sx: Number((st.scale.sx * sxF).toFixed(3)),
                  sy: Number((st.scale.sy * syF).toFixed(3)),
                  sz: Number((st.scale.sz * szF).toFixed(3)),
                },
              }
            }),
          false
        )
        return
      }

      if (!raycaster.ray.intersectPlane(dragPlane, hitPt)) return

      if (axis === "mxy_direct") {
        const dx = ((hitPt.x - startHit.x) / 10) * moveDamping
        const dy = ((hitPt.y - startHit.y) / 10) * moveDamping
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return
        doCommit(
          (prev) =>
            prev.map((o) =>
              startTransforms[o.id]
                ? {
                    ...o,
                    pos: {
                      ...o.pos,
                      x: Number((startTransforms[o.id].pos.x + dx).toFixed(2)),
                      y: Number((startTransforms[o.id].pos.y + dy).toFixed(2)),
                    },
                  }
                : o
            ),
          false
        )
      } else if (axis === "mx" || axis === "my") {
        const k = axis === "mx" ? "x" : "y"
        const d =
          ((axis === "mx" ? hitPt.x - startHit.x : hitPt.y - startHit.y) / 10) *
          moveDamping
        doCommit(
          (prev) =>
            prev.map((o) =>
              startTransforms[o.id]
                ? {
                    ...o,
                    pos: {
                      ...o.pos,
                      [k]: Number((startTransforms[o.id].pos[k] + d).toFixed(2)),
                    },
                  }
                : o
            ),
          false
        )
      } else if (axis === "sx" || axis === "sy") {
        const dMm = axis === "sx" ? hitPt.x - startHit.x : hitPt.y - startHit.y
        const factor = Math.max(0.05, 1 + dMm / 30)
        const sxF = axis === "sx" ? factor : 1
        const syF = axis === "sy" ? factor : 1
        doCommit(
          (prev) =>
            prev.map((o) => {
              const st = startTransforms[o.id]
              if (!st) return o
              const offsetMm = new THREE.Vector3(
                (st.pos.x * 10 - pivotWorld.x) * sxF,
                (st.pos.y * 10 - pivotWorld.y) * syF,
                st.pos.z * 10 - pivotWorld.z
              )
              return {
                ...o,
                pos: {
                  x: Number(((pivotWorld.x + offsetMm.x) / 10).toFixed(2)),
                  y: Number(((pivotWorld.y + offsetMm.y) / 10).toFixed(2)),
                  z: st.pos.z,
                },
                scale: {
                  sx: Number((st.scale.sx * sxF).toFixed(3)),
                  sy: Number((st.scale.sy * syF).toFixed(3)),
                  sz: st.scale.sz,
                },
              }
            }),
          false
        )
      } else if (axis === "rx" || axis === "ry" || axis === "rz") {
        const curAngle =
          axis === "rx"
            ? Math.atan2(hitPt.z - pivotWorld.z, hitPt.y - pivotWorld.y)
            : axis === "ry"
              ? Math.atan2(hitPt.x - pivotWorld.x, hitPt.z - pivotWorld.z)
              : Math.atan2(hitPt.y - pivotWorld.y, hitPt.x - pivotWorld.x)
        const rawDeltaDeg = THREE.MathUtils.radToDeg(curAngle - startAngle)
        const deltaDeg = e.altKey
          ? Math.round(rawDeltaDeg)
          : Math.round(rawDeltaDeg / 15) * 15
        const deltaRad = THREE.MathUtils.degToRad(deltaDeg)
        const rotAxisVec =
          axis === "rx"
            ? new THREE.Vector3(1, 0, 0)
            : axis === "ry"
              ? new THREE.Vector3(0, 1, 0)
              : new THREE.Vector3(0, 0, 1)
        const deltaQuat = new THREE.Quaternion().setFromAxisAngle(rotAxisVec, deltaRad)
        doCommit(
          (prev) =>
            prev.map((o) => {
              const st = startTransforms[o.id]
              if (!st) return o
              const offsetMm = new THREE.Vector3(
                st.pos.x * 10 - pivotWorld.x,
                st.pos.y * 10 - pivotWorld.y,
                st.pos.z * 10 - pivotWorld.z
              ).applyQuaternion(deltaQuat)
              const nextQuat = deltaQuat.clone().multiply(st.quat).normalize()
              const euler = new THREE.Euler().setFromQuaternion(nextQuat, "ZYX")
              return {
                ...o,
                pos: {
                  x: Number(((pivotWorld.x + offsetMm.x) / 10).toFixed(2)),
                  y: Number(((pivotWorld.y + offsetMm.y) / 10).toFixed(2)),
                  z: Number(((pivotWorld.z + offsetMm.z) / 10).toFixed(2)),
                },
                rot: {
                  x: Number(THREE.MathUtils.radToDeg(euler.x).toFixed(2)),
                  y: Number(THREE.MathUtils.radToDeg(euler.y).toFixed(2)),
                  z: Number(THREE.MathUtils.radToDeg(euler.z).toFixed(2)),
                },
              }
            }),
          false
        )
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      controls.enabled = true

      if (rightPointerDown) {
        const rDist = Math.hypot(
          e.clientX - rightPointerDown.x,
          e.clientY - rightPointerDown.y
        )
        rightPointerDown = null
        if (rDist < 5) {
          updateRay(e)
          const mHits = raycaster.intersectObjects(getInteractiveMeshes(), false)
          if (mHits.length > 0) {
            const hitId = mHits[0].object.userData?.objId as string
            const curSel: string[] = sceneRef.current?.selectedIds || []
            if (hitId && !curSel.includes(hitId)) setSelectedIds([hitId])
          }
          const rect = renderer.domElement.getBoundingClientRect()
          setContextMenu({
            x: Math.min(rect.width - 190, Math.max(12, e.clientX - rect.left)),
            y: Math.min(rect.height - 230, Math.max(12, e.clientY - rect.top)),
          })
          return
        }
      }

      if (emptyPointerDown) {
        const distMoved = Math.hypot(
          e.clientX - emptyPointerDown.x,
          e.clientY - emptyPointerDown.y
        )
        emptyPointerDown = null
        if (distMoved < 5) {
          if (sceneRef.current?.isEditingGroup) {
            sceneRef.current?.exitGroupIsolation()
          } else {
            setSelectedIds([])
          }
        }
      }

      if (marqueeState) {
        marqueeState = null
        setMarqueeBox(null)
      }

      if (activeDrag) {
        const moved =
          activeDrag.axis !== "mxy_direct" ||
          Math.hypot(
            (sceneRef.current?.latestObjects.find(
              (o) => o.id === activeDrag!.ids[0]
            )?.pos.x || 0) -
              (activeDrag.startTransforms[activeDrag.ids[0]]?.pos.x || 0),
            (sceneRef.current?.latestObjects.find(
              (o) => o.id === activeDrag!.ids[0]
            )?.pos.y || 0) -
              (activeDrag.startTransforms[activeDrag.ids[0]]?.pos.y || 0)
          ) > 0.01
        if (moved && !sceneRef.current?.isEditingGroup) {
          historyRef.current.past.push(activeDrag.snapshot)
          if (historyRef.current.past.length > 40) historyRef.current.past.shift()
          historyRef.current.future = []
          syncHistFlags()
        }
        activeDrag = null
      }
    }

    const dom = renderer.domElement
    dom.addEventListener("contextmenu", onContextMenu)
    dom.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)

    const ro = new ResizeObserver(() => {
      if (!container) return
      const cw = Math.max(1, container.clientWidth)
      const ch = Math.max(1, container.clientHeight)
      const asp = cw / ch
      perspCam.aspect = asp
      perspCam.updateProjectionMatrix()
      orthoCam.left = -halfH * asp
      orthoCam.right = halfH * asp
      orthoCam.top = halfH
      orthoCam.bottom = -halfH
      orthoCam.updateProjectionMatrix()
      renderer.setSize(cw, ch)
    })
    ro.observe(container)

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      controls.autoRotate = Boolean(sceneRef.current?.isTurntable)
      controls.autoRotateSpeed = 2.2
      controls.update()
      transformRig.update(activeCam)
      gizmoCtrl.updatePerspectiveOrientation(activeCam)
      renderer.render(scene, activeCam)
    }
    animate()

    const internalHandle = {
      scene,
      renderer,
      controls,
      plateObj,
      buildPlate: plateObj.group,
      refGroup,
      gizmoCtrl,
      transformRig,
      faceHighlightMesh,
      meshMap,
      selectedIds: [] as string[],
      toolMode: "move" as ToolMode,
      latestObjects: [] as SceneObject[],
      isTurntable: false,
      layOnFaceMode: false,
      marqueeSelectMode: false,
      isEditingGroup: false,
      exitGroupIsolation: () => {},
      applyLayOnFace: (_id: string, _n: THREE.Vector3) => {},
      captureCustomSnapshot: async (opts: {
        includeModel: boolean
        includePlate: boolean
        includeBg: boolean
      }) => {
        const prevBg = scene.background
        const prevPlateVis = plateObj.group.visible
        const prevRefVis = refGroup.visible
        const prevGizmoVis = gizmoCtrl.root.visible
        const prevTransformVis = transformRig.root.visible
        const prevHighlightVis = faceHighlightMesh.visible
        const prevMeshStates = new Map<string, { vis: boolean; bracketVis: boolean }>()

        for (const [id, mesh] of meshMap.entries()) {
          const br = mesh.getObjectByName("sel_brackets")
          prevMeshStates.set(id, {
            vis: mesh.visible,
            bracketVis: br ? br.visible : false,
          })
          if (!opts.includeModel) mesh.visible = false
          if (br) br.visible = false
        }

        scene.background = opts.includeBg ? new THREE.Color(bgHex) : null
        renderer.setClearColor(0x000000, opts.includeBg ? 1 : 0)
        plateObj.group.visible = opts.includePlate
        refGroup.visible =
          opts.includeModel && Boolean(sceneRef.current?.showScaleRef)
        gizmoCtrl.root.visible = false
        transformRig.root.visible = false
        faceHighlightMesh.visible = false
        renderer.render(scene, activeCam)

        const blob = await new Promise<Blob | null>((r) =>
          renderer.domElement.toBlob(r, "image/png")
        )

        scene.background = prevBg
        renderer.setClearColor(new THREE.Color(bgHex), 1)
        plateObj.group.visible = prevPlateVis
        refGroup.visible = prevRefVis
        gizmoCtrl.root.visible = prevGizmoVis
        transformRig.root.visible = prevTransformVis
        faceHighlightMesh.visible = prevHighlightVis

        for (const [id, st] of prevMeshStates.entries()) {
          const m = meshMap.get(id)
          if (m) {
            m.visible = st.vis
            const br = m.getObjectByName("sel_brackets")
            if (br) br.visible = st.bracketVis
          }
        }
        renderer.render(scene, activeCam)
        return blob
      },
      setOrthoMode: (ortho: boolean) => {
        const prevCam = activeCam
        const nextCam = ortho ? orthoCam : perspCam
        if (prevCam === nextCam) return
        nextCam.position.copy(prevCam.position)
        nextCam.quaternion.copy(prevCam.quaternion)
        if (ortho) {
          orthoCam.zoom =
            1 /
            Math.max(
              0.25,
              prevCam.position.distanceTo(controls.target) / (dist * 1.55)
            )
          orthoCam.updateProjectionMatrix()
        }
        activeCam = nextCam
        controls.object = activeCam
        controls.update()
      },
      focusObject: (id: string | null) => {
        const m = id ? meshMap.get(id) : null
        if (m) {
          m.updateMatrixWorld(true)
          const center = new THREE.Box3()
            .setFromObject(m)
            .getCenter(new THREE.Vector3())
          controls.target.copy(center)
        } else {
          controls.target.set(0, 0, 0)
        }
        controls.update()
      },
      setViewPreset: (x: number, y: number, z: number) => {
        setIsTurntable(false)
        controls.target.set(0, 0, 0)
        activeCam.position.set(x * dist * 1.5, y * dist * 1.5, z * dist * 1.5)
        controls.update()
      },
    }

    sceneRef.current = internalHandle as any

    return () => {
      cancelAnimationFrame(raf)
      transformRig.dispose()
      ro.disconnect()
      dom.removeEventListener("contextmenu", onContextMenu)
      dom.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      renderer.dispose()
    }
  }, [bgHex, bananaCm, accentBorder])

  // Update build plate grid dimensions
  React.useEffect(() => {
    const st = sceneRef.current as any
    if (!st) return
    st.plateObj?.updateDimensions(gridSizeCm, gridStepCm)
    st.refGroup?.position.set(0, (gridSizeCm * 10) / 2 + 26, 0)
  }, [gridSizeCm, gridStepCm])

  // Sync Lay on Face mode
  React.useEffect(() => {
    const st = sceneRef.current as any
    if (!st) return
    st.layOnFaceMode = layOnFaceMode
    if (!layOnFaceMode && st.faceHighlightMesh) {
      st.faceHighlightMesh.visible = false
    }
    st.applyLayOnFace = applyLayOnFace
  }, [layOnFaceMode, applyLayOnFace])

  // Sync scale reference mesh
  React.useEffect(() => {
    const st = sceneRef.current as any
    if (!st) return
    if (customRefModel?.geometry) {
      st.refGroup.clear()
      st.refGroup.add(
        new THREE.Mesh(
          customRefModel.geometry,
          new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.48 })
        )
      )
      return
    }
    const url = scaleRefModel?.file
    if (!url) {
      st.refGroup.clear()
      st.refGroup.add(createBananaMesh(bananaCm))
      return
    }
    let dead = false
    ;(async () => {
      try {
        const res = await fetch(url)
        if (!res.ok || dead) return
        const buf = await res.arrayBuffer()
        const name =
          scaleRefModel?.name || url.split("?")[0].split("/").pop() || "ref.stl"
        const ext = name.split(".").pop()?.toLowerCase()
        const geom =
          ext === "step" || ext === "stp"
            ? await parseStepToGeometry(buf)
            : ext === "3mf"
              ? await parse3mfToGeometry(buf)
              : new STLLoader().parse(buf)
        if (dead || !sceneRef.current) return
        geom.computeBoundingBox()
        const bb = geom.boundingBox!
        geom.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -bb.min.z)
        ;(sceneRef.current as any).refGroup.clear()
        ;(sceneRef.current as any).refGroup.add(
          new THREE.Mesh(
            geom,
            new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.48 })
          )
        )
      } catch {
        // Ignore broken optional scale ref URL
      }
    })()
    return () => {
      dead = true
    }
  }, [customRefModel, scaleRefModel?.file, scaleRefModel?.name, bananaCm])

  // Sync viewport flags
  React.useEffect(() => {
    const st = sceneRef.current as any
    if (!st) return
    st.toolMode = toolMode
    st.isTurntable = isTurntable
    st.showScaleRef = showScaleRef
    st.marqueeSelectMode = marqueeSelectMode
    st.isEditingGroup = Boolean(editingGroupState)
    st.exitGroupIsolation = exitGroupIsolation
    st.buildPlate.visible = showGrid
    st.refGroup.visible = showScaleRef
    st.gizmoCtrl.setMode(toolMode)
    if (toolMode === "transform") {
      st.gizmoCtrl.root.visible = false
      st.transformRig.setVisible(st.transformRig.hasTargets())
    } else {
      st.transformRig.setHovered(null)
      st.transformRig.setVisible(false)
      if (st.transformRig.hasTargets()) st.gizmoCtrl.root.visible = true
    }
    st.setOrthoMode(isOrtho)
  }, [
    toolMode,
    isTurntable,
    showScaleRef,
    marqueeSelectMode,
    editingGroupState,
    exitGroupIsolation,
    showGrid,
    isOrtho,
  ])

  // Sync scene meshes, overlays, and gizmo center
  React.useEffect(() => {
    const st = sceneRef.current as any
    if (!st) return
    st.selectedIds = selectedIds
    st.latestObjects = objects

    const activeIds = new Set(objects.map((o) => o.id))
    const selSet = new Set(selectedIds)

    for (const [id, mesh] of st.meshMap.entries()) {
      if (!activeIds.has(id)) {
        st.scene.remove(mesh)
        mesh.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose()
          if (child.material) child.material.dispose()
        })
        st.meshMap.delete(id)
      }
    }

    for (const obj of objects) {
      const hasVertexColors = Boolean(obj.geometry.attributes?.color)
      let mesh: THREE.Mesh | undefined = st.meshMap.get(obj.id)
      if (!mesh) {
        mesh = new THREE.Mesh(
          obj.geometry,
          new THREE.MeshStandardMaterial({
            color: hasVertexColors
              ? new THREE.Color("#FFFFFF")
              : new THREE.Color(obj.color),
            vertexColors: hasVertexColors,
            roughness: 0.52,
            metalness: 0.04,
            side: THREE.DoubleSide,
          })
        )
        mesh.userData = { objId: obj.id, lastTransformSig: "" }
        st.scene.add(mesh)
        st.meshMap.set(obj.id, mesh)
      } else if (mesh.geometry !== obj.geometry) {
        mesh.geometry.dispose()
        mesh.geometry = obj.geometry
        mesh.userData.lastTransformSig = ""
        for (const childName of [
          "sel_brackets",
          "bed_contact",
          "wireframe_overlay",
          "edge_highlight_overlay",
        ]) {
          const oldChild = mesh.getObjectByName(childName)
          if (oldChild) {
            mesh.remove(oldChild)
            ;(oldChild as THREE.Mesh).geometry.dispose()
          }
        }
      }

      mesh.visible = obj.visible
      mesh.scale.set(obj.scale.sx, obj.scale.sy, obj.scale.sz)
      mesh.position.set(obj.pos.x * 10, obj.pos.y * 10, obj.pos.z * 10)
      mesh.rotation.set(
        THREE.MathUtils.degToRad(obj.rot.x),
        THREE.MathUtils.degToRad(obj.rot.y),
        THREE.MathUtils.degToRad(obj.rot.z),
        "ZYX"
      )

      const mat = mesh.material as THREE.MeshStandardMaterial
      if (mat.vertexColors !== hasVertexColors) {
        mat.vertexColors = hasVertexColors
        mat.needsUpdate = true
      }

      const isSel = selSet.has(obj.id) && !obj.isGhostContext
      const userOpacity = THREE.MathUtils.clamp(obj.opacity ?? 1, 0.1, 1)

      if (obj.isGhostContext) {
        mat.color.set("#64748B")
        mat.transparent = true
        mat.opacity = 0.22
        mat.depthWrite = false
      } else if (obj.isHole) {
        mat.color.set("#F87171")
        mat.transparent = true
        mat.opacity = 0.44
        mat.depthWrite = false
      } else {
        mat.color.set(hasVertexColors ? "#FFFFFF" : obj.color)
        mat.transparent = userOpacity < 0.99
        mat.opacity = userOpacity
        mat.depthWrite = userOpacity >= 0.99
      }

      mat.emissive.set(
        isSel
          ? obj.isHole
            ? "#EF4444"
            : accent
          : obj.isHole
            ? "#7F1D1D"
            : "#000000"
      )
      mat.emissiveIntensity = isSel ? 0.16 : obj.isHole ? 0.12 : 0

      let edgeOverlay = mesh.getObjectByName("edge_highlight_overlay") as
        | THREE.LineSegments
        | undefined
      if (showEdgeHighlight && obj.visible && !obj.isGhostContext) {
        if (!edgeOverlay) {
          edgeOverlay = new THREE.LineSegments(
            new THREE.EdgesGeometry(obj.geometry, 26),
            new THREE.LineBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: isSel ? 0.34 : 0.22,
            })
          )
          edgeOverlay.name = "edge_highlight_overlay"
          mesh.add(edgeOverlay)
        }
        edgeOverlay.visible = true
      } else if (edgeOverlay) {
        edgeOverlay.visible = false
      }

      let wireOverlay = mesh.getObjectByName("wireframe_overlay") as
        | THREE.LineSegments
        | undefined
      if (showWireframe && obj.visible && !obj.isGhostContext) {
        if (!wireOverlay) {
          wireOverlay = new THREE.LineSegments(
            new THREE.WireframeGeometry(obj.geometry),
            new THREE.LineBasicMaterial({
              color: isSel ? 0x5eead4 : 0x94a3b8,
              transparent: true,
              opacity: isSel ? 0.55 : 0.3,
            })
          )
          wireOverlay.name = "wireframe_overlay"
          mesh.add(wireOverlay)
        }
        wireOverlay.visible = true
      } else if (wireOverlay) {
        wireOverlay.visible = false
      }

      const transformSig = `${obj.pos.x}_${obj.pos.y}_${obj.pos.z}_${obj.rot.x}_${obj.rot.y}_${obj.rot.z}_${obj.scale.sx}_${obj.scale.sy}_${obj.scale.sz}`
      if (mesh.userData.lastTransformSig !== transformSig) {
        mesh.userData.lastTransformSig = transformSig
        mesh.updateMatrixWorld(true)
        const worldBox = new THREE.Box3().setFromObject(mesh)
        mesh.userData.isTouchingBed =
          !obj.isHole && !obj.isGhostContext && Math.abs(worldBox.min.z) <= 0.18
      }

      const isTouchingBed = Boolean(obj.visible && mesh.userData.isTouchingBed)
      let bedContact = mesh.getObjectByName("bed_contact") as THREE.Mesh | undefined
      if (isTouchingBed) {
        if (!bedContact) {
          bedContact = new THREE.Mesh(
            buildBottomContactGeometry(obj.geometry),
            new THREE.MeshBasicMaterial({
              color: new THREE.Color(accentBorder),
              transparent: true,
              opacity: 0.42,
              side: THREE.DoubleSide,
              polygonOffset: true,
              polygonOffsetFactor: -1,
              polygonOffsetUnits: -1,
            })
          )
          bedContact.name = "bed_contact"
          mesh.add(bedContact)
        }
        bedContact.visible = true
      } else if (bedContact) {
        bedContact.visible = false
      }

      let brackets = mesh.getObjectByName("sel_brackets") as
        | THREE.LineSegments
        | undefined
      if (isSel && obj.visible) {
        if (!brackets) {
          obj.geometry.computeBoundingBox()
          const bb = obj.geometry.boundingBox!
          brackets = new THREE.LineSegments(
            buildCornerBracketsGeometry(
              bb.min.x,
              bb.max.x,
              bb.min.y,
              bb.max.y,
              bb.min.z,
              bb.max.z
            ),
            new THREE.LineBasicMaterial({
              color: 0xe2e8f0,
              transparent: true,
              opacity: 0.85,
            })
          )
          brackets.name = "sel_brackets"
          mesh.add(brackets)
        }
        brackets.visible = true
      } else if (brackets) {
        brackets.visible = false
      }
    }

    const activeSelected = objects.filter(
      (o) => selSet.has(o.id) && o.visible && !o.isGhostContext
    )
    if (activeSelected.length > 0) {
      const combinedBox = new THREE.Box3()
      const selectedMeshes: THREE.Object3D[] = []
      let hasValid = false
      for (const item of activeSelected) {
        const m = st.meshMap.get(item.id)
        if (m) {
          m.updateMatrixWorld(true)
          combinedBox.expandByObject(m)
          selectedMeshes.push(m)
          hasValid = true
        }
      }
      st.transformRig.setTargets(selectedMeshes)
      if (hasValid && !combinedBox.isEmpty()) {
        st.gizmoCtrl.root.position.copy(combinedBox.getCenter(new THREE.Vector3()))
        const showTransform = st.toolMode === "transform"
        st.gizmoCtrl.root.visible = !showTransform
        st.transformRig.setVisible(showTransform)
      } else {
        st.gizmoCtrl.root.visible = false
        st.transformRig.setVisible(false)
      }
    } else {
      st.gizmoCtrl.root.visible = false
      st.transformRig.setTargets([])
      st.transformRig.setVisible(false)
    }
  }, [objects, selectedIds, showWireframe, showEdgeHighlight, accent, accentBorder])

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
}
