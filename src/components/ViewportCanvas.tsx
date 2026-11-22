import * as React from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import {
  EditingGroupState,
  EditorSnapshot,
  SceneControllerHandle,
  LengthUnit,
  ScaleDimUnit,
  SceneObject,
  ToolMode,
} from "../types/editor"
import {
  lengthFromDisplay,
  lengthToDisplay,
  scaleSizeToDisplay,
} from "../utils/dimUnits"
import { extractCoplanarPatchGeometry } from "../three/geometryOps"
import {
  buildBottomContactGeometry,
  buildCornerBracketsGeometry,
  createBananaMesh,
  createBuildPlate,
} from "../three/sceneHelpers"
import { buildModeGizmo } from "../three/gizmo"
import {
  createTransformBoxRig,
  dimensionEditScale,
  rigScaleFactors,
  TRANSFORM_AXIS_CSS,
  type TransformBoxRig,
} from "../three/transformBoxRig"
import { parse3mfToGeometry, parseStepToGeometry } from "../utils/fileLoaders"
import { fmt } from "../utils/format"
import {
  gizmoSnapEnabled,
  snapCm,
  snapDragPositionCm,
  snapDragSizeCm,
  snapRotationDeltaDeg,
} from "../utils/transformSnap"

type DimAxis = "x" | "y" | "z"

const showsDimensionCallout = (ud: {
  handleKind?: string
  gizmoAxis?: string
} | null | undefined) =>
  ud?.handleKind === "corner" ||
  (ud?.handleKind === "face" &&
    (ud.gizmoAxis === "sx" || ud.gizmoAxis === "sy" || ud.gizmoAxis === "sz"))

const dimensionHandleActive = (id: string | null) =>
  !!id &&
  (id === "move-x" ||
    id === "move-y" ||
    id === "move-z" ||
    id.startsWith("corner-") ||
    id.startsWith("height-z") ||
    id.startsWith("side-x") ||
    id.startsWith("side-y"))

const MOVE_GIZMO_TO_PIN: Record<string, "move-x" | "move-y" | "move-z"> = {
  mx: "move-x",
  my: "move-y",
  mz: "move-z",
}
const MOVE_PIN_TO_GIZMO: Record<string, "mx" | "my" | "mz"> = {
  "move-x": "mx",
  "move-y": "my",
  "move-z": "mz",
}
const MOVE_PIN_TO_AXIS: Record<string, DimAxis> = {
  "move-x": "x",
  "move-y": "y",
  "move-z": "z",
}
const SCALE_GIZMO_TO_PIN: Record<string, "scale-x" | "scale-y" | "scale-z"> = {
  sx: "scale-x",
  sy: "scale-y",
  sz: "scale-z",
}
const SCALE_PIN_TO_AXIS: Record<string, DimAxis> = {
  "scale-x": "x",
  "scale-y": "y",
  "scale-z": "z",
}
const SCALE_PIN_TO_GIZMO: Record<string, "sx" | "sy" | "sz"> = {
  "scale-x": "sx",
  "scale-y": "sy",
  "scale-z": "sz",
}

const isMovePin = (id: string | null | undefined): id is "move-x" | "move-y" | "move-z" =>
  id === "move-x" || id === "move-y" || id === "move-z"
const isScaleGizmoPin = (id: string | null | undefined): id is "scale-x" | "scale-y" | "scale-z" =>
  id === "scale-x" || id === "scale-y" || id === "scale-z"

/** Snapped length/offset for on-canvas numeric labels (same step as position snapping). */
function formatOffsetDisplay(offsetCm: number, unit: LengthUnit) {
  const snapped = snapCm(offsetCm)
  return fmt(unit === "mm" ? snapped * 10 : snapped)
}

interface DimEdgeView {
  axis: DimAxis
  length: number
  color: string
  x1: number
  y1: number
  x2: number
  y2: number
  ex1: number
  ey1: number
  ex2: number
  ey2: number
  lx: number
  ly: number
}

interface DimCalloutView {
  id: string
  edges: DimEdgeView[]
  /** Move-offset along drag axis (centimetres). */
  moveDeltaCm?: number
  /** Absolute size along one axis (centimetres, full span). */
  valueCm?: number
  labelAxis?: DimAxis
  labelX?: number
  labelY?: number
  labelOnly?: boolean
}

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
  enterGroupIsolation: (groupId: string, initialChildIndex?: number) => void
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
  historyRef: React.MutableRefObject<{ past: EditorSnapshot[]; future: EditorSnapshot[] }>
  captureHistoryRef: React.MutableRefObject<() => EditorSnapshot>
  syncHistFlags: () => void
  lengthUnit: LengthUnit
  scaleUnit: ScaleDimUnit
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
    enterGroupIsolation,
    exitGroupIsolation,
    applyLayOnFace,
    setPlateSettingsOpen,
    setContextMenu,
    setMarqueeBox,
    customRefModel,
    scaleRefModel,
    commitObjects,
    historyRef,
    captureHistoryRef,
    syncHistFlags,
    lengthUnit,
    scaleUnit,
  } = props

  const mountRef = React.useRef<HTMLDivElement>(null)
  const lengthUnitRef = React.useRef(lengthUnit)
  const scaleUnitRef = React.useRef(scaleUnit)
  const publishCalloutRef = React.useRef<(() => void) | null>(null)
  lengthUnitRef.current = lengthUnit
  scaleUnitRef.current = scaleUnit
  const cornerUiRef = React.useRef({
    hoverId: null as string | null,
    pinnedId: null as string | null,
    editing: null as DimAxis | null,
    /** Shift was held while pinning this corner. */
    proportionalPin: false,
    /** Shift was held while typing or confirming the current value. */
    proportionalEdit: false,
    /** Shift was held (at least once) during a corner scale drag. */
    proportionalDrag: false,
    snapshot: null as null | { id: string; length: Partial<Record<DimAxis, number>> },
    draggingMoveAxis: false,
    draggingScaleGizmo: false,
    draggingRigScale: false,
    moveAxisSession: null as null | {
      ids: string[]
      startTransforms: Record<
        string,
        {
          pos: { x: number; y: number; z: number }
          rot: { x: number; y: number; z: number }
          scale: { sx: number; sy: number; sz: number }
          quat: THREE.Quaternion
        }
      >
      moveAxis: THREE.Vector3
    },
    scaleGizmoSession: null as null | {
      ids: string[]
      handleId: string
      sign: THREE.Vector3
      symmetric: boolean
    },
  })
  const calloutGeomRef = React.useRef<DimCalloutView | null>(null)
  const [cornerCallout, setCornerCallout] = React.useState<DimCalloutView | null>(null)
  const [dimDraft, setDimDraft] = React.useState<Partial<Record<DimAxis, string>>>({})
  const dimDraftRef = React.useRef(dimDraft)
  dimDraftRef.current = dimDraft
  const cornerCalloutIdRef = React.useRef<string | null>(null)
  cornerCalloutIdRef.current = cornerCallout?.id ?? null
  const transformLabelInputRef = React.useRef<HTMLInputElement | null>(null)
  const cornerDimInputRefs = React.useRef<Partial<Record<DimAxis, HTMLInputElement | null>>>({})
  const activeDragRef = React.useRef<{
    scaleDrag?: { handleId: string; sign: THREE.Vector3; kind: string } | null
  } | null>(null)
  const clearAxisDraft = (axis: DimAxis) => {
    setDimDraft((draft) => {
      if (draft[axis] === undefined) return draft
      const next = { ...draft }
      delete next[axis]
      return next
    })
  }
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
      snapshot: EditorSnapshot
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
      scaleDrag: null | {
        kind: "corner" | "face" | "center"
        handleId: string
        sign: THREE.Vector3
        center: THREE.Vector3
        quat: THREE.Quaternion
        hx: number
        hy: number
        hz: number
        pullLocal?: THREE.Vector3
        /** Full-span edge lengths in cm at pointer-down (corner uniform / callout). */
        baseLengths?: Partial<Record<DimAxis, number>>
      }
      moveAxis: THREE.Vector3 | null
      rotBasis: null | { axis: THREE.Vector3; xDir: THREE.Vector3; yDir: THREE.Vector3 }
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
      const objs = sceneRef.current?.latestObjects || []
      const euler = new THREE.Euler(0, 0, 0, "ZYX")
      for (const id of ids) {
        const o = objs.find((item) => item.id === id)
        if (!o || !meshMap.get(id)) continue
        euler.set(
          THREE.MathUtils.degToRad(o.rot.x),
          THREE.MathUtils.degToRad(o.rot.y),
          THREE.MathUtils.degToRad(o.rot.z)
        )
        map[id] = {
          pos: { x: o.pos.x, y: o.pos.y, z: o.pos.z },
          rot: { x: o.rot.x, y: o.rot.y, z: o.rot.z },
          scale: { sx: o.scale.sx, sy: o.scale.sy, sz: o.scale.sz },
          quat: new THREE.Quaternion().setFromEuler(euler),
        }
      }
      return map
    }

    const captureDragSnapshot = () => captureHistoryRef.current()

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

    const onDoubleClick = (e: MouseEvent) => {
      if (sceneRef.current?.layOnFaceMode || sceneRef.current?.isEditingGroup) return
      updateRay(e as unknown as PointerEvent)
      const mHits = raycaster.intersectObjects(getInteractiveMeshes(), false)
      if (mHits.length === 0) return
      const clickedId = mHits[0].object.userData?.objId as string
      if (!clickedId) return
      const obj = (sceneRef.current?.latestObjects || []).find((o) => o.id === clickedId)
      if (!obj || (obj.groupChildren?.length || 0) <= 1) return
      e.preventDefault()
      e.stopPropagation()
      sceneRef.current?.enterGroupIsolation(clickedId, 0)
    }

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

      const planeAlong = (origin: THREE.Vector3, dir: THREE.Vector3) => {
        const toCam = activeCam.position.clone().sub(origin)
        const planeN = toCam.clone().addScaledVector(dir, -toCam.dot(dir))
        if (planeN.lengthSq() < 1e-6) {
          const fallback =
            Math.abs(dir.z) < 0.85 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
          planeN.crossVectors(dir, fallback)
        }
        if (planeN.lengthSq() < 1e-6) planeN.set(0, 1, 0)
        return planeN.normalize()
      }

      const basisOf = (quat: THREE.Quaternion) => {
        const axisOf = (x: number, y: number, z: number) =>
          new THREE.Vector3(x, y, z).applyQuaternion(quat).normalize()
        const xAxis = axisOf(1, 0, 0)
        const yAxis = axisOf(0, 1, 0)
        const zAxis = axisOf(0, 0, 1)
        return { xAxis, yAxis, zAxis }
      }

      const startAxisDrag = (
        axis: string,
        pivot: THREE.Vector3,
        id: string,
        opts?: {
          planeNormal?: THREE.Vector3
          scaleDrag?: NonNullable<typeof activeDrag>["scaleDrag"]
          rotBasis?: NonNullable<typeof activeDrag>["rotBasis"]
          moveAxis?: THREE.Vector3
        }
      ) => {
        if (!meshMap.get(id)) return false
        controls.enabled = false
        setIsTurntable(false)
        const normal =
          opts?.planeNormal ??
          (axis === "rx"
            ? new THREE.Vector3(1, 0, 0)
            : axis === "ry"
              ? new THREE.Vector3(0, 1, 0)
              : new THREE.Vector3(0, 0, 1))
        dragPlane.setFromNormalAndCoplanarPoint(normal, pivot)
        raycaster.ray.intersectPlane(dragPlane, hitPt)
        const basis = opts?.rotBasis
        const startAngle = basis
          ? Math.atan2(
              hitPt.clone().sub(pivot).dot(basis.yDir),
              hitPt.clone().sub(pivot).dot(basis.xDir)
            )
          : axis === "rx"
            ? Math.atan2(hitPt.z - pivot.z, hitPt.y - pivot.y)
            : axis === "ry"
              ? Math.atan2(hitPt.x - pivot.x, hitPt.z - pivot.z)
              : Math.atan2(hitPt.y - pivot.y, hitPt.x - pivot.x)
        const startTransforms = captureStartTransforms(curSelIds)
        activeDrag = {
          axis,
          ids: curSelIds,
          snapshot: captureDragSnapshot(),
          pivotWorld: pivot.clone(),
          startHit: hitPt.clone(),
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          startTransforms,
          startAngle,
          scaleDrag: opts?.scaleDrag ?? null,
          moveAxis: opts?.moveAxis?.clone() ?? null,
          rotBasis: basis ?? null,
        }
        if (
          (axis === "mx" || axis === "my" || axis === "mz") &&
          opts?.moveAxis
        ) {
          const pin = MOVE_GIZMO_TO_PIN[axis]
          cornerUiRef.current.pinnedId = pin
          cornerUiRef.current.editing = null
          cornerUiRef.current.draggingMoveAxis = true
          const pinAxis = MOVE_PIN_TO_AXIS[pin]
          clearAxisDraft(pinAxis)
          cornerUiRef.current.moveAxisSession = {
            ids: [...curSelIds],
            startTransforms,
            moveAxis: opts.moveAxis.clone(),
          }
        }
        if (
          opts?.scaleDrag &&
          axis !== "sx" &&
          axis !== "sy" &&
          axis !== "sz"
        ) {
          cornerUiRef.current.draggingRigScale = true
          cornerUiRef.current.pinnedId = opts.scaleDrag.handleId
        }
        if (
          opts?.scaleDrag &&
          (axis === "sx" || axis === "sy" || axis === "sz")
        ) {
          const pin = SCALE_GIZMO_TO_PIN[axis]
          cornerUiRef.current.pinnedId = pin
          cornerUiRef.current.draggingScaleGizmo = true
          cornerUiRef.current.scaleGizmoSession = {
            ids: [...curSelIds],
            handleId: axis,
            sign: opts.scaleDrag.sign.clone(),
            symmetric: false,
          }
          clearAxisDraft(SCALE_PIN_TO_AXIS[pin])
        }
        activeDragRef.current = activeDrag
        return true
      }

      if (
        sceneRef.current?.toolMode === "transform" &&
        transformRig.root.visible &&
        primaryId
      ) {
        const gHits = raycaster.intersectObjects(transformRig.getHitTargets(), false)
        const axisHit = gHits.find((h) => h.object.userData?.gizmoAxis)
        if (axisHit) {
          const ud = axisHit.object.userData
          const axis = ud.gizmoAxis as string
          const handleId = ud.handleId as string | undefined
          const nextPin = handleId && showsDimensionCallout(ud) ? handleId : null
          if (nextPin) {
            if (nextPin !== cornerUiRef.current.pinnedId) {
              cornerUiRef.current.proportionalPin = e.shiftKey
              cornerUiRef.current.proportionalEdit = false
              cornerUiRef.current.proportionalDrag = false
              cornerUiRef.current.snapshot = null
            } else if (e.shiftKey) {
              cornerUiRef.current.proportionalPin = true
            }
          } else {
            cornerUiRef.current.proportionalPin = false
            cornerUiRef.current.proportionalEdit = false
            cornerUiRef.current.proportionalDrag = false
            cornerUiRef.current.snapshot = null
          }
          cornerUiRef.current.pinnedId = nextPin
          if (ud.signX !== undefined) {
            const kind = ud.handleKind === "face" ? "face" : "corner"
            const sign = { x: ud.signX as number, y: ud.signY as number, z: ud.signZ as number }
            const frame = transformRig.getFrame()
            const dir =
              kind === "corner" && sign.z > 0
                ? new THREE.Vector3(sign.x * frame.hx, sign.y * frame.hy, frame.hz)
                : new THREE.Vector3(sign.x, sign.y, kind === "corner" ? 0 : sign.z)
            if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1)
            else dir.normalize()
            dir.transformDirection(transformRig.root.matrixWorld)
            const toCam = activeCam.position.clone().sub(frame.center)
            const planeN = toCam.addScaledVector(dir, -toCam.dot(dir))
            if (planeN.lengthSq() < 1e-8) planeN.set(0, 0, 1)
            else planeN.normalize()
            const cmSpan = 0.2
            if (
              startAxisDrag(axis, frame.center, primaryId, {
                planeNormal: planeN,
                scaleDrag: {
                  kind,
                  handleId: ud.handleId as string,
                  sign: new THREE.Vector3(sign.x, sign.y, sign.z),
                  center: frame.center.clone(),
                  quat: frame.quaternion,
                  hx: frame.hx,
                  hy: frame.hy,
                  hz: frame.hz,
                  baseLengths:
                    kind === "corner"
                      ? {
                          x: frame.hx * cmSpan,
                          y: frame.hy * cmSpan,
                          z: frame.hz * cmSpan,
                        }
                      : undefined,
                },
              })
            ) {
              return
            }
          } else if (axis === "rx" || axis === "ry" || axis === "rz") {
            const frame = transformRig.getFrame()
            const localAxis = (x: number, y: number, z: number) =>
              new THREE.Vector3(x, y, z).applyQuaternion(frame.quaternion)
            const xAxis = localAxis(1, 0, 0)
            const yAxis = localAxis(0, 1, 0)
            const zAxis = localAxis(0, 0, 1)
            const basis =
              axis === "rx"
                ? { axis: xAxis, xDir: yAxis, yDir: zAxis }
                : axis === "ry"
                  ? { axis: yAxis, xDir: zAxis, yDir: xAxis }
                  : { axis: zAxis, xDir: xAxis, yDir: yAxis }
            if (
              startAxisDrag(axis, frame.center, primaryId, {
                planeNormal: basis.axis.clone(),
                rotBasis: basis,
              })
            ) {
              return
            }
          } else if (axis === "mz") {
            const frame = transformRig.getFrame()
            transformRig.root.updateMatrixWorld(true)
            const camLocal = transformRig.root.worldToLocal(activeCam.position.clone())
            const signZ = camLocal.z >= 0 ? 1 : -1
            const moveAxis = new THREE.Vector3(0, 0, signZ)
              .applyQuaternion(frame.quaternion)
              .normalize()
            if (
              startAxisDrag(axis, frame.center, primaryId, {
                planeNormal: planeAlong(frame.center, moveAxis),
                moveAxis,
              })
            ) {
              return
            }
          }
        }
      }

      if (gizmoCtrl.root.visible && primaryId) {
        const mode = sceneRef.current?.toolMode || "move"
        const gHits = raycaster.intersectObjects(
          gizmoCtrl.getActiveHitTargets(mode),
          true
        )
        const axisHit = gHits.find((h) => h.object.userData?.gizmoAxis)
        if (axisHit) {
          const axis = axisHit.object.userData.gizmoAxis as string
          const frame = transformRig.getFrame()
          const { xAxis, yAxis, zAxis } = basisOf(frame.quaternion)
          if (mode === "scale") {
            const sign =
              axis === "sx"
                ? { x: 1, y: 0, z: 0 }
                : axis === "sy"
                  ? { x: 0, y: 1, z: 0 }
                  : axis === "sz"
                    ? { x: 0, y: 0, z: 1 }
                    : { x: 0, y: 0, z: 0 }
            const handleDir =
              axis === "sx" ? xAxis : axis === "sy" ? yAxis : axis === "sz" ? zAxis : null
            let pullLocal: THREE.Vector3 | undefined
            let planeN: THREE.Vector3
            if (!handleDir) {
              planeN = activeCam.position.clone().sub(frame.center)
              if (planeN.lengthSq() < 1e-8) planeN.set(0, 0, 1)
              else planeN.normalize()
              const right = new THREE.Vector3(1, 0, 0).applyQuaternion(activeCam.quaternion)
              const up = new THREE.Vector3(0, 1, 0).applyQuaternion(activeCam.quaternion)
              pullLocal = right
                .add(up)
                .normalize()
                .applyQuaternion(frame.quaternion.clone().invert())
              if (pullLocal.lengthSq() < 1e-8) pullLocal.set(0, 0, 1)
              else pullLocal.normalize()
            } else {
              planeN = planeAlong(frame.center, handleDir)
            }
            if (
              startAxisDrag(axis, frame.center, primaryId, {
                planeNormal: planeN,
                scaleDrag: {
                  kind: handleDir ? "face" : "center",
                  handleId: axis,
                  sign: new THREE.Vector3(sign.x, sign.y, sign.z),
                  center: frame.center.clone(),
                  quat: frame.quaternion.clone(),
                  hx: frame.hx,
                  hy: frame.hy,
                  hz: frame.hz,
                  pullLocal,
                },
              })
            ) {
              return
            }
          } else if (axis === "rx" || axis === "ry" || axis === "rz") {
            const basis =
              axis === "rx"
                ? { axis: xAxis, xDir: yAxis, yDir: zAxis }
                : axis === "ry"
                  ? { axis: yAxis, xDir: zAxis, yDir: xAxis }
                  : { axis: zAxis, xDir: xAxis, yDir: yAxis }
            if (
              startAxisDrag(axis, frame.center, primaryId, {
                planeNormal: basis.axis.clone(),
                rotBasis: basis,
              })
            ) {
              return
            }
          } else if (axis === "mx" || axis === "my" || axis === "mz") {
            const moveAxis = axis === "mx" ? xAxis : axis === "my" ? yAxis : zAxis
            if (
              startAxisDrag(axis, frame.center, primaryId, {
                planeNormal: planeAlong(frame.center, moveAxis),
                moveAxis,
              })
            ) {
              return
            }
          }
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
              snapshot: captureDragSnapshot(),
              pivotWorld: gizmoCtrl.root.position.clone(),
              startHit: hitPt.clone(),
              startScreenX: e.clientX,
              startScreenY: e.clientY,
              startTransforms: captureStartTransforms(nextSel),
              startAngle: 0,
              scaleDrag: null,
              moveAxis: null,
              rotBasis: null,
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
          const hitUd = gHits.find((h) => h.object.userData?.handleId)?.object.userData
          hov = hitUd?.handleId || null
          if (
            hov &&
            (hov === "move-z" || showsDimensionCallout(hitUd)) // rig move-z handle
          ) {
            cornerUiRef.current.hoverId = hov
          } else if (!hov && nearCallout(e.clientX, e.clientY)) {
            /* Keep the hovered corner while the pointer moves onto its inputs. */
          } else cornerUiRef.current.hoverId = null
          transformRig.setHovered(hov)
          gizmoCtrl.setHovered(null)
        } else {
          cornerUiRef.current.hoverId = null
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

      activeDragRef.current = activeDrag
      const {
        axis,
        pivotWorld,
        startHit,
        startTransforms,
        startAngle,
      } = activeDrag
      const moveDamping = 0.72
      const doCommit = commitRef.current
      const snap = gizmoSnapEnabled(e)

      if (activeDrag.scaleDrag) {
        if (cornerUiRef.current.editing) return
        const { kind, sign, center, quat, hx, hy, hz, pullLocal } = activeDrag.scaleDrag
        if (!raycaster.ray.intersectPlane(dragPlane, hitPt)) return
        const localDelta = hitPt.clone().sub(startHit).applyQuaternion(quat.clone().invert())
        const onScaleGizmo =
          activeDrag.scaleDrag.handleId === "sx" ||
          activeDrag.scaleDrag.handleId === "sy" ||
          activeDrag.scaleDrag.handleId === "sz" ||
          activeDrag.scaleDrag.handleId === "sall"
        const symmetric = onScaleGizmo || e.ctrlKey || e.altKey || e.metaKey
        const scaled =
          kind === "center"
            ? rigScaleFactors(
                "face",
                { x: 1, y: 0, z: 0 },
                {
                  x: Math.max(hx, hy, hz),
                  y: Math.max(hx, hy, hz),
                  z: Math.max(hx, hy, hz),
                },
                new THREE.Vector3(localDelta.dot(pullLocal ?? new THREE.Vector3(0, 0, 1)), 0, 0),
                true,
                true
              )
            : rigScaleFactors(
                kind,
                sign,
                { x: hx, y: hy, z: hz },
                localDelta,
                e.shiftKey,
                symmetric
              )
        const { fx, fy, fz } = scaled
        const anchorWorld = scaled.anchor.clone().applyQuaternion(quat).add(center)
        if (cornerUiRef.current.scaleGizmoSession) {
          cornerUiRef.current.scaleGizmoSession.symmetric = symmetric
        }
        if (kind === "corner" && activeDrag.scaleDrag.baseLengths) {
          const base = activeDrag.scaleDrag.baseLengths
          if (e.shiftKey) {
            cornerUiRef.current.proportionalDrag = true
            const k = fx
            const su = scaleUnitRef.current
            setDimDraft({
              x: fmt(scaleSizeToDisplay(base.x! * k, base.x!, su)),
              y: fmt(scaleSizeToDisplay(base.y! * k, base.y!, su)),
              z: fmt(scaleSizeToDisplay(base.z! * k, base.z!, su)),
            })
          } else {
            setDimDraft((draft) => {
              const next = { ...draft }
              let changed = false
              for (const key of ["x", "y", "z"] as const) {
                if (next[key] !== undefined) {
                  delete next[key]
                  changed = true
                }
              }
              return changed ? next : draft
            })
          }
        }
        doCommit(
          (prev) =>
            prev.map((o) => {
              const st = startTransforms[o.id]
              if (!st) return o
              return scaleObjectAboutAnchor(
                { ...o, pos: st.pos, rot: st.rot, scale: { ...st.scale } },
                fx,
                fy,
                fz,
                anchorWorld,
                quat,
                snap
              )
            }),
          false
        )
        return
      }

      if (activeDrag.moveAxis) {
        cornerUiRef.current.draggingMoveAxis =
          activeDrag.axis === "mx" ||
          activeDrag.axis === "my" ||
          activeDrag.axis === "mz"
        const movePin = MOVE_GIZMO_TO_PIN[activeDrag.axis]
        if (movePin) {
          const editAxis = MOVE_PIN_TO_AXIS[movePin]
          if (cornerUiRef.current.editing === editAxis) {
            return
          }
        }
        if (!raycaster.ray.intersectPlane(dragPlane, hitPt)) return
        const alongCm =
          (hitPt.clone().sub(startHit).dot(activeDrag.moveAxis) / 10) * moveDamping
        const delta = activeDrag.moveAxis.clone().multiplyScalar(alongCm)
        doCommit(
          (prev) =>
            prev.map((o) => {
              const st = startTransforms[o.id]
              if (!st) return o
              return {
                ...o,
                pos: {
                  x: snapDragPositionCm(st.pos.x, delta.x, snap),
                  y: snapDragPositionCm(st.pos.y, delta.y, snap),
                  z: snapDragPositionCm(st.pos.z, delta.z, snap),
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
                      x: snapDragPositionCm(
                        startTransforms[o.id].pos.x,
                        dx,
                        snap
                      ),
                      y: snapDragPositionCm(
                        startTransforms[o.id].pos.y,
                        dy,
                        snap
                      ),
                    },
                  }
                : o
            ),
          false
        )
      } else if (axis === "rx" || axis === "ry" || axis === "rz") {
        const basis = activeDrag.rotBasis
        const offset = hitPt.clone().sub(pivotWorld)
        const curAngle = basis
          ? Math.atan2(offset.dot(basis.yDir), offset.dot(basis.xDir))
          : axis === "rx"
            ? Math.atan2(hitPt.z - pivotWorld.z, hitPt.y - pivotWorld.y)
            : axis === "ry"
              ? Math.atan2(hitPt.x - pivotWorld.x, hitPt.z - pivotWorld.z)
              : Math.atan2(hitPt.y - pivotWorld.y, hitPt.x - pivotWorld.x)
        const rawDeltaDeg = THREE.MathUtils.radToDeg(curAngle - startAngle)
        const deltaDeg = snapRotationDeltaDeg(rawDeltaDeg, snap)
        const deltaRad = THREE.MathUtils.degToRad(deltaDeg)
        const rotAxisVec = basis
          ? basis.axis
          : axis === "rx"
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
              const px = (pivotWorld.x + offsetMm.x) / 10
              const py = (pivotWorld.y + offsetMm.y) / 10
              const pz = (pivotWorld.z + offsetMm.z) / 10
              return {
                ...o,
                pos: {
                  x: snap ? snapCm(px) : px,
                  y: snap ? snapCm(py) : py,
                  z: snap ? snapCm(pz) : pz,
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
        if (moved) {
          historyRef.current.past.push(activeDrag.snapshot)
          if (historyRef.current.past.length > 40) historyRef.current.past.shift()
          historyRef.current.future = []
          syncHistFlags()
        }
        if (cornerUiRef.current.proportionalDrag) {
          cornerUiRef.current.proportionalPin = true
          cornerUiRef.current.proportionalDrag = false
        }
        cornerUiRef.current.draggingMoveAxis = false
        cornerUiRef.current.draggingScaleGizmo = false
        cornerUiRef.current.draggingRigScale = false
        activeDrag = null
        activeDragRef.current = null
      }
    }

    const dom = renderer.domElement
    dom.addEventListener("contextmenu", onContextMenu)
    dom.addEventListener("dblclick", onDoubleClick)
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

    const ndc = new THREE.Vector3()
    let calloutSig = ""

    function nearCallout(clientX: number, clientY: number) {
      const geom = calloutGeomRef.current
      const host = container?.parentElement
      if (!geom || !container || !host) return false
      const rect = host.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      if (geom.labelOnly && geom.labelX !== undefined && geom.labelY !== undefined) {
        return Math.hypot(x - geom.labelX, y - geom.labelY) < 56
      }
      return geom.edges.some((edge) => {
        if (distToSegment(x, y, edge.x1, edge.y1, edge.x2, edge.y2) < 36) return true
        if (distToSegment(x, y, edge.ex1, edge.ey1, edge.x1, edge.y1) < 18) return true
        if (distToSegment(x, y, edge.ex2, edge.ey2, edge.x2, edge.y2) < 18) return true
        return Math.hypot(x - edge.lx, y - edge.ly) < 72
      })
    }

    const measureMoveOffsetCm = () => {
      const sess =
        activeDrag?.moveAxis
          ? {
              ids: activeDrag.ids,
              startTransforms: activeDrag.startTransforms,
              moveAxis: activeDrag.moveAxis,
            }
          : cornerUiRef.current.moveAxisSession
      if (!sess) return 0
      const primary = sess.ids[sess.ids.length - 1]
      const st = sess.startTransforms[primary]
      const obj = (sceneRef.current?.latestObjects || []).find(
        (o) => o.id === primary
      )
      if (!st || !obj) return 0
      const sw = new THREE.Vector3(st.pos.x * 10, st.pos.y * 10, st.pos.z * 10)
      const cw = new THREE.Vector3(obj.pos.x * 10, obj.pos.y * 10, obj.pos.z * 10)
      const deltaCm = cw.sub(sw).dot(sess.moveAxis) / 10
      return snapCm(deltaCm)
    }

    const measureGizmoScaleSizeCm = (axis: DimAxis) => {
      const frame = transformRig.getFrame()
      const span = { x: frame.hx * 2, y: frame.hy * 2, z: frame.hz * 2 }
      return snapCm(span[axis])
    }

    const publishCornerCallout = () => {
      const ui = cornerUiRef.current
      const mode = sceneRef.current?.toolMode
      const dragScaleId = activeDrag?.scaleDrag?.handleId ?? null
      const dragMovePin =
        activeDrag?.moveAxis && MOVE_GIZMO_TO_PIN[activeDrag.axis]
          ? MOVE_GIZMO_TO_PIN[activeDrag.axis]
          : null
      const dragScaleGizmoPin =
        activeDrag?.scaleDrag?.handleId &&
        SCALE_GIZMO_TO_PIN[activeDrag.scaleDrag.handleId]
          ? SCALE_GIZMO_TO_PIN[activeDrag.scaleDrag.handleId]
          : null
      const hoverDim = dimensionHandleActive(ui.hoverId)
      const activeId =
        dragMovePin ??
        dragScaleGizmoPin ??
        dragScaleId ??
        (hoverDim
          ? ui.hoverId
          : isMovePin(ui.pinnedId) ||
              isScaleGizmoPin(ui.pinnedId) ||
              dimensionHandleActive(ui.pinnedId)
            ? ui.pinnedId
            : null)
      const hide = () => {
        calloutGeomRef.current = null
        if (calloutSig !== "") {
          calloutSig = ""
          setCornerCallout(null)
        }
      }
      const host = container?.parentElement
      const projectLabel = (
        tipWorld: THREE.Vector3,
        axisDir: THREE.Vector3
      ): { labelX: number; labelY: number } | null => {
        if (!container || !host) return null
        const dir = axisDir.clone()
        if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1)
        else dir.normalize()
        const tailWorld = tipWorld.clone().add(dir.clone().multiplyScalar(-22))
        activeCam.updateMatrixWorld()
        const hostRect = host.getBoundingClientRect()
        const canvasRect = renderer.domElement.getBoundingClientRect()
        const originX = canvasRect.left - hostRect.left
        const originY = canvasRect.top - hostRect.top
        const project = (point: THREE.Vector3) => {
          ndc.copy(point).project(activeCam)
          return {
            x: originX + (ndc.x + 1) * 0.5 * canvasRect.width,
            y: originY + (-ndc.y + 1) * 0.5 * canvasRect.height,
            behind: ndc.z > 1 || !Number.isFinite(ndc.x) || !Number.isFinite(ndc.y),
          }
        }
        const tipPt = project(tipWorld)
        const tailPt = project(tailWorld)
        if (tailPt.behind && tipPt.behind) return null
        const dx = tipPt.x - tailPt.x
        const dy = tipPt.y - tailPt.y
        const dLen = Math.hypot(dx, dy) || 1
        return {
          labelX: tipPt.x + (dx / dLen) * 36,
          labelY: tipPt.y + (dy / dLen) * 36,
        }
      }

      if (isMovePin(activeId)) {
        if (!transformRig.hasTargets() && !gizmoCtrl.root.visible) {
          hide()
          return
        }
        const axis = MOVE_PIN_TO_AXIS[activeId]
        const gizmoAxis = MOVE_PIN_TO_GIZMO[activeId]
        const offsetCm = measureMoveOffsetCm()
        if (!host || !container) {
          hide()
          return
        }
        const tipWorld =
          activeId === "move-z" &&
          sceneRef.current?.toolMode === "transform" &&
          transformRig.root.visible
            ? transformRig.getMoveZTipWorld() ??
              gizmoCtrl.getMoveAxisTipWorld("mz")
            : gizmoCtrl.getMoveAxisTipWorld(gizmoAxis) ??
              (activeId === "move-z" ? transformRig.getMoveZTipWorld() : null)
        if (!tipWorld) {
          hide()
          return
        }
        const moveDir =
          cornerUiRef.current.moveAxisSession?.moveAxis?.clone() ??
          new THREE.Vector3(
            axis === "x" ? 1 : 0,
            axis === "y" ? 1 : 0,
            axis === "z" ? 1 : 0
          )
        const labelPt = projectLabel(tipWorld, moveDir)
        if (!labelPt) {
          hide()
          return
        }
        const { labelX, labelY } = labelPt
        const display = lengthToDisplay(offsetCm, lengthUnitRef.current)
        const view: DimCalloutView = {
          id: activeId,
          labelOnly: true,
          labelAxis: axis,
          moveDeltaCm: offsetCm,
          labelX,
          labelY,
          edges: [
            {
              axis,
              length: display,
              color: TRANSFORM_AXIS_CSS[axis],
              ex1: 0,
              ey1: 0,
              ex2: 0,
              ey2: 0,
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 0,
              lx: labelX,
              ly: labelY,
            },
          ],
        }
        calloutGeomRef.current = view
        const sig = `${activeId}|${formatOffsetDisplay(offsetCm, lengthUnitRef.current)}|${labelX.toFixed(0)},${labelY.toFixed(0)}`
        const typing =
          cornerUiRef.current.editing === axis &&
          cornerUiRef.current.pinnedId === activeId
        if (sig !== calloutSig) {
          calloutSig = sig
          setCornerCallout((prev) =>
            typing && prev?.id === activeId
              ? {
                  ...prev,
                  moveDeltaCm: offsetCm,
                  labelX,
                  labelY,
                  edges: view.edges,
                }
              : view
          )
        }
        return
      }

      if (isScaleGizmoPin(activeId)) {
        if (!gizmoCtrl.root.visible || !transformRig.hasTargets()) {
          hide()
          return
        }
        const axis = SCALE_PIN_TO_AXIS[activeId]
        const gizmoAxis = SCALE_PIN_TO_GIZMO[activeId]
        const valueCm = measureGizmoScaleSizeCm(axis)
        if (!host || !container) {
          hide()
          return
        }
        const tipWorld = gizmoCtrl.getScaleAxisTipWorld(gizmoAxis)
        if (!tipWorld) {
          hide()
          return
        }
        const frame = transformRig.getFrame()
        const axisDir = new THREE.Vector3(
          axis === "x" ? 1 : 0,
          axis === "y" ? 1 : 0,
          axis === "z" ? 1 : 0
        ).applyQuaternion(frame.quaternion)
        const labelPt = projectLabel(tipWorld, axisDir)
        if (!labelPt) {
          hide()
          return
        }
        const { labelX, labelY } = labelPt
        const display = lengthToDisplay(valueCm, lengthUnitRef.current)
        const view: DimCalloutView = {
          id: activeId,
          labelOnly: true,
          labelAxis: axis,
          valueCm,
          labelX,
          labelY,
          edges: [
            {
              axis,
              length: display,
              color: TRANSFORM_AXIS_CSS[axis],
              ex1: 0,
              ey1: 0,
              ex2: 0,
              ey2: 0,
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 0,
              lx: labelX,
              ly: labelY,
            },
          ],
        }
        calloutGeomRef.current = view
        const sig = `${activeId}|${formatOffsetDisplay(valueCm, lengthUnitRef.current)}|${labelX.toFixed(0)},${labelY.toFixed(0)}`
        const typing =
          cornerUiRef.current.editing === axis &&
          cornerUiRef.current.pinnedId === activeId
        if (sig !== calloutSig) {
          calloutSig = sig
          setCornerCallout((prev) =>
            typing && prev?.id === activeId
              ? { ...prev, valueCm, labelX, labelY, edges: view.edges }
              : view
          )
        }
        return
      }
      if (
        mode !== "transform" ||
        !transformRig.root.visible ||
        !activeId ||
        !dimensionHandleActive(activeId)
      ) {
        hide()
        return
      }
      const data = activeId.startsWith("height-z")
        ? transformRig.getHeightCallout(activeId)
        : activeId.startsWith("side-x") || activeId.startsWith("side-y")
          ? transformRig.getPlanarFaceCallout(activeId)
          : transformRig.getCornerCallout(activeId)
      if (!data || !container || !host) {
        hide()
        return
      }
      const measured = "edges" in data ? data.edges : [data.edge]
      transformRig.root.updateMatrixWorld(true)
      activeCam.updateMatrixWorld()
      const hostRect = host.getBoundingClientRect()
      const canvasRect = renderer.domElement.getBoundingClientRect()
      const originX = canvasRect.left - hostRect.left
      const originY = canvasRect.top - hostRect.top
      const project = (point: THREE.Vector3) => {
        ndc.copy(point).project(activeCam)
        return {
          x: originX + (ndc.x + 1) * 0.5 * canvasRect.width,
          y: originY + (-ndc.y + 1) * 0.5 * canvasRect.height,
          behind: ndc.z > 1 || !Number.isFinite(ndc.x) || !Number.isFinite(ndc.y),
        }
      }
      const edges: DimEdgeView[] = []
      for (const edge of measured) {
        const boxStart = project(edge.boxStart)
        const boxEnd = project(edge.boxEnd)
        const start = project(edge.start)
        const end = project(edge.end)
        const mid = project(edge.mid)
        if (start.behind || end.behind || mid.behind) continue
        edges.push({
          axis: edge.axis,
          length: lengthToDisplay(edge.length, lengthUnitRef.current),
          color: TRANSFORM_AXIS_CSS[edge.axis],
          ex1: boxStart.x,
          ey1: boxStart.y,
          ex2: boxEnd.x,
          ey2: boxEnd.y,
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          lx: mid.x,
          ly: mid.y,
        })
      }
      if (edges.length === 0) {
        hide()
        return
      }
      const view: DimCalloutView = { id: data.id, edges }
      calloutGeomRef.current = view
      const sig = `${view.id}|${edges
        .map(
          (edge) =>
            `${edge.axis}:${edge.x1.toFixed(0)},${edge.y1.toFixed(0)},${edge.x2.toFixed(0)},${edge.y2.toFixed(0)},${edge.length.toFixed(2)}`
        )
        .join(";")}`
      if (sig !== calloutSig) {
        calloutSig = sig
        setCornerCallout(view)
      }
    }

    publishCalloutRef.current = publishCornerCallout
    controls.addEventListener("change", publishCornerCallout)

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      controls.autoRotate = Boolean(sceneRef.current?.isTurntable)
      controls.autoRotateSpeed = 2.2
      controls.update()
      transformRig.update(activeCam)
      publishCornerCallout()
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
      enterGroupIsolation: () => {},
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
      publishCalloutRef.current = null
      cancelAnimationFrame(raf)
      controls.removeEventListener("change", publishCornerCallout)
      transformRig.dispose()
      ro.disconnect()
      dom.removeEventListener("contextmenu", onContextMenu)
      dom.removeEventListener("dblclick", onDoubleClick)
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
    st.enterGroupIsolation = enterGroupIsolation
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
    enterGroupIsolation,
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
        mesh.renderOrder = 1
      } else if (obj.isHole) {
        mat.color.set("#F87171")
        mat.transparent = true
        mat.opacity = 0.44
        mat.depthWrite = false
        mesh.renderOrder = 2
      } else {
        mat.color.set(hasVertexColors ? "#FFFFFF" : obj.color)
        mat.transparent = userOpacity < 0.99
        mat.opacity = userOpacity
        mat.depthWrite = userOpacity >= 0.99
        mesh.renderOrder = userOpacity < 0.99 ? 2 : 0
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
      if (isSel && obj.visible && toolMode !== "transform") {
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
              transparent: false,
              opacity: 1,
              depthTest: true,
              depthWrite: false,
              polygonOffset: true,
              polygonOffsetFactor: -2,
              polygonOffsetUnits: -2,
            })
          )
          brackets.name = "sel_brackets"
          brackets.renderOrder = 1002
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
      const primaryId = selectedIds[selectedIds.length - 1]
      let primaryMesh: THREE.Object3D | null = null
      let hasValid = false
      for (const item of activeSelected) {
        const m = st.meshMap.get(item.id)
        if (m) {
          m.updateMatrixWorld(true)
          combinedBox.expandByObject(m)
          if (item.id === primaryId) primaryMesh = m
          else selectedMeshes.push(m)
          hasValid = true
        }
      }
      if (primaryMesh) selectedMeshes.push(primaryMesh)
      st.transformRig.setTargets(selectedMeshes)
      if (hasValid && !combinedBox.isEmpty()) {
        const showTransform = st.toolMode === "transform"
        const frame = st.transformRig.getFrame()
        st.gizmoCtrl.root.position.copy(frame.center)
        st.gizmoCtrl.root.quaternion.copy(frame.quaternion)
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
  }, [objects, selectedIds, showWireframe, showEdgeHighlight, accent, accentBorder, toolMode])

  const selectionKey = selectedIds.join("\0")
  React.useEffect(() => {
    cornerUiRef.current.pinnedId = null
    cornerUiRef.current.hoverId = null
    cornerUiRef.current.editing = null
    cornerUiRef.current.proportionalPin = false
    cornerUiRef.current.proportionalEdit = false
    cornerUiRef.current.proportionalDrag = false
    cornerUiRef.current.snapshot = null
    cornerUiRef.current.draggingMoveAxis = false
    cornerUiRef.current.draggingScaleGizmo = false
    cornerUiRef.current.draggingRigScale = false
    cornerUiRef.current.moveAxisSession = null
    cornerUiRef.current.scaleGizmoSession = null
    calloutGeomRef.current = null
    setCornerCallout(null)
    setDimDraft((draft) => (Object.keys(draft).length ? {} : draft))
  }, [selectionKey, toolMode])

  React.useEffect(() => {
    if (!cornerCallout) return
    setDimDraft((draft) => {
      const editing = cornerUiRef.current.editing
      let changed = false
      const next = { ...draft }
      for (const edge of cornerCallout.edges) {
        if (edge.axis === editing) continue
        const shown = next[edge.axis]
        if (shown === undefined) continue
        const n = parseFloat(shown)
        if (!Number.isFinite(n)) continue
        if (Math.abs(edge.length - n) <= Math.max(0.02, Math.abs(n) * 0.002)) {
          delete next[edge.axis]
          changed = true
        }
      }
      return changed ? next : draft
    })
  }, [cornerCallout])

  React.useEffect(() => {
    publishCalloutRef.current?.()
  }, [lengthUnit, scaleUnit])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (!cornerUiRef.current.pinnedId) return
      cornerUiRef.current.pinnedId = null
      cornerUiRef.current.editing = null
      cornerUiRef.current.proportionalPin = false
      cornerUiRef.current.proportionalEdit = false
      cornerUiRef.current.proportionalDrag = false
      cornerUiRef.current.snapshot = null
      if (!cornerUiRef.current.hoverId) {
        calloutGeomRef.current = null
        setCornerCallout(null)
      }
      setDimDraft((draft) => (Object.keys(draft).length ? {} : draft))
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const applyMoveAxisDimension = (raw: string, recordHistory = true) => {
    const sess = cornerUiRef.current.moveAxisSession
    if (!sess) return
    const nextDisplay = parseFloat(raw.replace(/,/g, ".").trim())
    if (!Number.isFinite(nextDisplay)) return
    const offsetCm = snapCm(lengthFromDisplay(nextDisplay, lengthUnit))
    const moveAxis = sess.moveAxis
    const idSet = new Set(sess.ids)
    commitRef.current(
      (prev) =>
        prev.map((o) => {
          if (!idSet.has(o.id)) return o
          const st = sess.startTransforms[o.id]
          if (!st) return o
          const sw = new THREE.Vector3(st.pos.x * 10, st.pos.y * 10, st.pos.z * 10)
          const nextWorld = sw
            .clone()
            .add(moveAxis.clone().multiplyScalar(offsetCm * 10))
          return {
            ...o,
            pos: {
              x: Number((nextWorld.x / 10).toFixed(2)),
              y: Number((nextWorld.y / 10).toFixed(2)),
              z: Number((nextWorld.z / 10).toFixed(2)),
            },
          }
        }),
      recordHistory
    )
  }

  const applyScaleGizmoDimension = (raw: string, recordHistory = true) => {
    const sess = cornerUiRef.current.scaleGizmoSession
    const api = sceneRef.current as
      | (SceneControllerHandle & { transformRig: TransformBoxRig })
      | null
    const rig = api?.transformRig
    if (!sess || !rig || !api?.selectedIds.length) return
    const pin = SCALE_GIZMO_TO_PIN[sess.handleId]
    if (!pin) return
    const axis = SCALE_PIN_TO_AXIS[pin]
    const nextDisplay = parseFloat(raw.replace(/,/g, ".").trim())
    if (!Number.isFinite(nextDisplay) || nextDisplay <= 0) return
    const nextCm = snapCm(lengthFromDisplay(nextDisplay, lengthUnit))
    const frame = rig.getFrame()
    const half = { x: frame.hx, y: frame.hy, z: frame.hz }
    const prevCm = half[axis] * 2
    if (!(prevCm > 0)) return
    if (Math.abs(nextCm - prevCm) < 1e-4) return
    const scaled = dimensionEditScale(
      "face",
      sess.sign,
      half,
      axis,
      prevCm,
      nextCm,
      false,
      sess.symmetric
    )
    if (!scaled) return
    const { fx, fy, fz, anchor } = scaled
    if (
      Math.abs(fx - 1) < 1e-6 &&
      Math.abs(fy - 1) < 1e-6 &&
      Math.abs(fz - 1) < 1e-6
    ) {
      return
    }
    const quat = frame.quaternion
    const anchorWorld = anchor.clone().applyQuaternion(quat).add(frame.center)
    const ids = new Set(sess.ids)
    commitRef.current(
      (prev) =>
        prev.map((obj) =>
          ids.has(obj.id)
            ? scaleObjectAboutAnchor(obj, fx, fy, fz, anchorWorld, quat, false)
            : obj
        ),
      recordHistory
    )
  }

  const transformLabelKeyboardTarget = (): {
    kind: "move" | "scaleGizmo" | "rigScale"
    axis: DimAxis
    pinId: string
  } | null => {
    const ui = cornerUiRef.current
    if (isMovePin(ui.pinnedId) && ui.moveAxisSession) {
      return {
        kind: "move",
        axis: MOVE_PIN_TO_AXIS[ui.pinnedId],
        pinId: ui.pinnedId,
      }
    }
    if (isScaleGizmoPin(ui.pinnedId) && ui.scaleGizmoSession) {
      return {
        kind: "scaleGizmo",
        axis: SCALE_PIN_TO_AXIS[ui.pinnedId],
        pinId: ui.pinnedId,
      }
    }
    if (
      ui.pinnedId &&
      dimensionHandleActive(ui.pinnedId) &&
      !isMovePin(ui.pinnedId) &&
      !isScaleGizmoPin(ui.pinnedId)
    ) {
      const drag = activeDragRef.current?.scaleDrag
      let axis: DimAxis | null = ui.editing
      if (!axis && drag) {
        if (drag.handleId.startsWith("side-x")) axis = "x"
        else if (drag.handleId.startsWith("side-y")) axis = "y"
        else if (drag.handleId.startsWith("height-z")) axis = "z"
        else if (Math.abs(drag.sign.x) > 0 && Math.abs(drag.sign.y) === 0)
          axis = "x"
        else if (Math.abs(drag.sign.y) > 0 && Math.abs(drag.sign.x) === 0)
          axis = "y"
        else if (Math.abs(drag.sign.z) > 0) axis = "z"
      }
      if (axis) {
        return { kind: "rigScale", axis, pinId: ui.pinnedId }
      }
    }
    return null
  }

  const applyCornerDimension = (
    handleId: string,
    axis: DimAxis,
    raw: string,
    uniform: boolean,
    symmetric: boolean
  ) => {
    if (isMovePin(handleId)) {
      applyMoveAxisDimension(raw)
      return
    }
    if (isScaleGizmoPin(handleId)) {
      applyScaleGizmoDimension(raw)
      return
    }
    const api = sceneRef.current as
      | (SceneControllerHandle & { transformRig: TransformBoxRig })
      | null
    const rig = api?.transformRig
    if (!rig || api.selectedIds.length === 0) return
    const height = handleId.startsWith("height-z") ? rig.getHeightCallout(handleId) : null
    const planar =
      handleId.startsWith("side-x") || handleId.startsWith("side-y")
        ? rig.getPlanarFaceCallout(handleId)
        : null
    const corner = height || planar ? null : rig.getCornerCallout(handleId)
    const sign = height?.sign ?? planar?.sign ?? corner?.sign
    const edge =
      height?.edge ??
      planar?.edge ??
      corner?.edges.find((item) => item.axis === axis)
    if (!sign || !edge || edge.length < 1e-6) return
    const nextDisplay = parseFloat(raw.replace(",", "."))
    if (!Number.isFinite(nextDisplay) || nextDisplay <= 0) return
    const ui = cornerUiRef.current
    const isProportional =
      uniform || ui.proportionalPin || ui.proportionalEdit || ui.proportionalDrag
    /** Snapshot and rig edges are in centimetres; inputs use {@link lengthUnit}. */
    const lengths: Partial<Record<DimAxis, number>> = {
      ...(ui.snapshot?.id === handleId ? ui.snapshot.length : {}),
    }
    if (corner) {
      for (const item of corner.edges) lengths[item.axis] = lengths[item.axis] ?? item.length
    } else if (height) {
      lengths.z = lengths.z ?? height.edge.length
    } else if (planar) {
      lengths[planar.edge.axis] = lengths[planar.edge.axis] ?? planar.edge.length
    }
    const prevCm = lengths[axis] ?? edge.length
    const nextCm = lengthFromDisplay(nextDisplay, lengthUnit)
    if (!(prevCm > 0)) return
    if (Math.abs(nextCm - prevCm) < 1e-4) return
    const frame = rig.getFrame()
    const half = { x: frame.hx, y: frame.hy, z: frame.hz }
    const kind = height || planar ? "face" : "corner"
    const scaled = dimensionEditScale(
      kind,
      sign,
      half,
      axis,
      prevCm,
      nextCm,
      isProportional,
      symmetric
    )
    if (!scaled) return
    const { fx, fy, fz, anchor, factor } = scaled
    if (
      Math.abs(fx - 1) < 1e-6 &&
      Math.abs(fy - 1) < 1e-6 &&
      Math.abs(fz - 1) < 1e-6
    ) {
      return
    }
    if (isProportional) {
      setDimDraft((draft) => {
        const next = { ...draft }
        delete next[axis]
        for (const key of ["x", "y", "z"] as const) {
          if (key === axis) continue
          const prev = lengths[key]
          if (prev && prev > 0)
            next[key] = fmt(lengthToDisplay(prev * factor, lengthUnit))
        }
        return next
      })
    }
    const quat = frame.quaternion
    const anchorWorld = anchor.clone().applyQuaternion(quat).add(frame.center)
    const ids = new Set(api.selectedIds)
    commitRef.current((prev) =>
      prev.map((obj) =>
        ids.has(obj.id)
          ? scaleObjectAboutAnchor(obj, fx, fy, fz, anchorWorld, quat, false)
          : obj
      )
    )
  }

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const targetInfo = transformLabelKeyboardTarget()
      if (!targetInfo) return
      const { axis, pinId, kind } = targetInfo
      const labelInput = transformLabelInputRef.current
      const cornerInput = cornerDimInputRefs.current[axis]
      const activeInputs = [labelInput, cornerInput].filter(Boolean) as HTMLInputElement[]
      const target = e.target as HTMLElement | null
      if (activeInputs.some((el) => document.activeElement === el)) return
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          (target.tagName === "INPUT" &&
            !activeInputs.some((el) => el === target)))
      ) {
        return
      }
      const draftVal = dimDraftRef.current[axis]
      const commitLabel = () => {
        const raw = draftVal ?? labelInput?.value
        if (raw === undefined || raw === "") return
        if (kind === "move") applyMoveAxisDimension(raw, true)
        else if (kind === "scaleGizmo") applyScaleGizmoDimension(raw, true)
        else if (cornerCalloutIdRef.current) {
          applyCornerDimension(
            cornerCalloutIdRef.current,
            axis,
            raw,
            false,
            false
          )
        }
        cornerUiRef.current.editing = null
        clearAxisDraft(axis)
      }
      if (e.key === "Enter") {
        e.preventDefault()
        commitLabel()
        return
      }
      if (e.key === "Escape") {
        cornerUiRef.current.editing = null
        clearAxisDraft(axis)
        return
      }
      if (
        e.key === "Backspace" &&
        (draftVal !== undefined || cornerUiRef.current.editing === axis)
      ) {
        e.preventDefault()
        cornerUiRef.current.pinnedId = pinId
        cornerUiRef.current.editing = axis
        const next = (draftVal ?? "").slice(0, -1)
        setDimDraft((draft) => ({ ...draft, [axis]: next }))
        return
      }
      if (e.key.length === 1 && /[0-9.,\-]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        cornerUiRef.current.pinnedId = pinId
        cornerUiRef.current.editing = axis
        const fresh = draftVal === undefined
        const cur = fresh ? "" : draftVal!
        const next = fresh ? e.key : cur + e.key
        setDimDraft((draft) => ({ ...draft, [axis]: next }))
        ;(labelInput ?? cornerInput)?.focus()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [lengthUnit])

  const labelCallout =
    cornerCallout?.labelOnly &&
    cornerCallout.labelAxis &&
    (isMovePin(cornerCallout.id) || isScaleGizmoPin(cornerCallout.id))
      ? cornerCallout
      : null

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      {labelCallout ? (
        <TransformAxisValueLabel
          inputRef={transformLabelInputRef}
          callout={labelCallout}
          lengthUnit={lengthUnit}
          mode={isMovePin(labelCallout.id) ? "offset" : "size"}
          draft={
            labelCallout.labelAxis
              ? dimDraft[labelCallout.labelAxis]
              : undefined
          }
          onDraft={(value) =>
            setDimDraft((draft) => ({
              ...draft,
              [labelCallout.labelAxis!]: value,
            }))
          }
          onFocus={() => {
            const axis = labelCallout.labelAxis!
            cornerUiRef.current.editing = axis
            cornerUiRef.current.pinnedId = labelCallout.id
          }}
          onCommit={(raw) => {
            const axis = labelCallout.labelAxis!
            applyCornerDimension(labelCallout.id, axis, raw, false, false)
            cornerUiRef.current.editing = null
            clearAxisDraft(axis)
          }}
          onCancel={() => {
            const axis = labelCallout.labelAxis!
            cornerUiRef.current.editing = null
            clearAxisDraft(axis)
          }}
        />
      ) : (
        cornerCallout &&
        !cornerCallout.labelOnly && (
          <CornerDimensionCallout
            callout={cornerCallout}
            lengthUnit={lengthUnit}
            drafts={dimDraft}
            inputRefs={cornerDimInputRefs}
            onDraft={(axis, value) =>
              setDimDraft((draft) => ({ ...draft, [axis]: value }))
            }
            onFocusAxis={(axis, handleId) => {
              cornerUiRef.current.editing = axis
              cornerUiRef.current.pinnedId = handleId
              cornerUiRef.current.proportionalEdit = false
              if (cornerCallout && cornerCallout.id === handleId) {
                const length: Partial<Record<DimAxis, number>> = {}
                for (const edge of cornerCallout.edges) {
                  length[edge.axis] = lengthFromDisplay(edge.length, lengthUnit)
                }
                cornerUiRef.current.snapshot = { id: handleId, length }
              }
            }}
            onCommit={applyCornerDimension}
            onShiftProportional={() => {
              cornerUiRef.current.proportionalEdit = true
            }}
            onCancel={(axis) => {
              cornerUiRef.current.editing = null
              cornerUiRef.current.proportionalEdit = false
              clearAxisDraft(axis)
            }}
          />
        )
      )}
    </div>
  )
}

function scaleObjectAboutAnchor(
  obj: SceneObject,
  fx: number,
  fy: number,
  fz: number,
  anchorWorld: THREE.Vector3,
  quat: THREE.Quaternion,
  snap: boolean
): SceneObject {
  const bd = obj.baseDim
  let sfx = fx
  let sfy = fy
  let sfz = fz
  if (snap && bd) {
    const sx0 = bd.x * obj.scale.sx
    const sy0 = bd.y * obj.scale.sy
    const sz0 = bd.z * obj.scale.sz
    if (sx0 > 1e-6) sfx = snapDragSizeCm(sx0, fx, true) / sx0
    if (sy0 > 1e-6) sfy = snapDragSizeCm(sy0, fy, true) / sy0
    if (sz0 > 1e-6) sfz = snapDragSizeCm(sz0, fz, true) / sz0
  }
  const rel = new THREE.Vector3(obj.pos.x * 10, obj.pos.y * 10, obj.pos.z * 10).sub(
    anchorWorld
  )
  rel.applyQuaternion(quat.clone().invert())
  rel.x *= sfx
  rel.y *= sfy
  rel.z *= sfz
  rel.applyQuaternion(quat)
  const next = anchorWorld.clone().add(rel)
  return {
    ...obj,
    pos: {
      x: next.x / 10,
      y: next.y / 10,
      z: next.z / 10,
    },
    scale: {
      sx: obj.scale.sx * sfx,
      sy: obj.scale.sy * sfy,
      sz: obj.scale.sz * sfz,
    },
  }
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  const t =
    len2 < 1e-6
      ? 0
      : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2))
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t))
}

function dimensionArrow(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  atStart: boolean
) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const px = -uy * 3.25
  const py = ux * 3.25
  const tipX = atStart ? x1 : x2
  const tipY = atStart ? y1 : y2
  const sign = atStart ? 1 : -1
  const baseX = tipX + sign * ux * 8
  const baseY = tipY + sign * uy * 8
  return `M ${tipX} ${tipY} L ${baseX + px} ${baseY + py} L ${baseX - px} ${baseY - py} Z`
}

function blockOverlayEvent(e: React.SyntheticEvent) {
  e.stopPropagation()
}

/** Let an in-progress corner drag keep receiving pointermove. */
function blockIdlePointer(e: React.PointerEvent) {
  if (e.buttons === 0) e.stopPropagation()
}

function TransformAxisValueLabel({
  inputRef,
  callout,
  lengthUnit,
  mode,
  draft,
  onDraft,
  onFocus,
  onCommit,
  onCancel,
}: {
  inputRef: React.RefObject<HTMLInputElement>
  callout: DimCalloutView
  lengthUnit: LengthUnit
  mode: "offset" | "size"
  draft?: string
  onDraft: (value: string) => void
  onFocus: () => void
  onCommit: (raw: string) => void
  onCancel: () => void
}) {
  const axis = callout.labelAxis ?? callout.edges[0]?.axis ?? "z"
  const valueCm =
    mode === "offset"
      ? (callout.moveDeltaCm ?? 0)
      : (callout.valueCm ?? 0)
  const shown = formatOffsetDisplay(valueCm, lengthUnit)
  const color = TRANSFORM_AXIS_CSS[axis]
  const lx = callout.labelX ?? callout.edges[0]?.lx ?? 0
  const ly = callout.labelY ?? callout.edges[0]?.ly ?? 0

  const bump = (dir: 1 | -1) => {
    const stepCm = lengthUnit === "mm" ? 0.1 : 0.1
    const curDisplay = parseFloat((draft ?? shown).replace(/,/g, "."))
    const curCm = Number.isFinite(curDisplay)
      ? lengthFromDisplay(curDisplay, lengthUnit)
      : valueCm
    const nextCm = snapCm(curCm + dir * stepCm)
    const text = formatOffsetDisplay(nextCm, lengthUnit)
    onDraft(text)
  }

  return (
    <label
      style={{
        position: "absolute",
        left: lx,
        top: ly,
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
        pointerEvents: "auto",
        zIndex: 6,
      }}
      onPointerDown={blockOverlayEvent}
      onPointerMove={blockIdlePointer}
      onPointerUp={blockOverlayEvent}
      onClick={blockOverlayEvent}
    >
      <input
        ref={inputRef}
        className="adivi-num-input"
        type="text"
        inputMode="decimal"
        aria-label={
          mode === "offset"
            ? `${axis.toUpperCase()} move offset (${lengthUnit})`
            : `${axis.toUpperCase()} size (${lengthUnit})`
        }
        value={draft !== undefined ? draft : shown}
        onFocus={(e) => {
          onFocus()
          requestAnimationFrame(() => e.currentTarget.select())
        }}
        onMouseDown={(e) => {
          e.stopPropagation()
          onFocus()
        }}
        onChange={(e) => {
          if (draft === undefined) {
            onFocus()
            onDraft(e.target.value)
            return
          }
          onDraft(e.target.value)
        }}
        onBlur={() => onCancel()}
        onPointerDown={blockOverlayEvent}
        onPointerMove={blockIdlePointer}
        onPointerUp={blockOverlayEvent}
        onClick={blockOverlayEvent}
        onKeyUp={blockOverlayEvent}
        onKeyDown={(e) => {
          e.stopPropagation()
          const isPrintable =
            e.key.length === 1 &&
            /[0-9.,\-]/.test(e.key) &&
            !e.ctrlKey &&
            !e.metaKey
          if (isPrintable && draft === undefined) {
            e.preventDefault()
            onFocus()
            onDraft(e.key)
            return
          }
          if (e.key === "ArrowUp") {
            e.preventDefault()
            bump(1)
          } else if (e.key === "ArrowDown") {
            e.preventDefault()
            bump(-1)
          } else if (e.key === "Enter") {
            e.preventDefault()
            onCommit(e.currentTarget.value)
            e.currentTarget.blur()
          } else if (e.key === "Escape") {
            e.preventDefault()
            onCancel()
            e.currentTarget.blur()
          }
        }}
        style={{
          width: 72,
          height: 24,
          borderRadius: 5,
          border: `1px solid ${color}`,
          backgroundColor: "rgba(15, 23, 42, 0.94)",
          color: "#F8FAFC",
          padding: "0 6px",
          fontSize: 12,
          fontWeight: 700,
          textAlign: "center",
          outline: "none",
          boxSizing: "border-box",
          userSelect: "text",
          boxShadow: `0 0 0 1px ${color}, 0 4px 14px rgba(0,0,0,0.4)`,
        }}
      />
    </label>
  )
}

function CornerDimensionCallout({
  callout,
  lengthUnit,
  drafts,
  inputRefs,
  onDraft,
  onFocusAxis,
  onShiftProportional,
  onCommit,
  onCancel,
}: {
  callout: DimCalloutView
  lengthUnit: LengthUnit
  drafts: Partial<Record<DimAxis, string>>
  inputRefs: React.MutableRefObject<
    Partial<Record<DimAxis, HTMLInputElement | null>>
  >
  onDraft: (axis: DimAxis, value: string) => void
  onFocusAxis: (axis: DimAxis, handleId: string) => void
  onShiftProportional: () => void
  onCommit: (
    handleId: string,
    axis: DimAxis,
    raw: string,
    uniform: boolean,
    symmetric: boolean
  ) => void
  onCancel: (axis: DimAxis) => void
}) {
  return (
    <>
      <svg
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          inset: 0,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        {callout.edges.map((edge) => (
          <g key={edge.axis}>
            <line
              x1={edge.ex1}
              y1={edge.ey1}
              x2={edge.x1}
              y2={edge.y1}
              stroke={edge.color}
              strokeWidth={1}
              opacity={0.85}
            />
            <line
              x1={edge.ex2}
              y1={edge.ey2}
              x2={edge.x2}
              y2={edge.y2}
              stroke={edge.color}
              strokeWidth={1}
              opacity={0.85}
            />
            <line
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              stroke={edge.color}
              strokeWidth={1.5}
            />
            <path
              d={dimensionArrow(edge.x1, edge.y1, edge.x2, edge.y2, true)}
              fill={edge.color}
            />
            <path
              d={dimensionArrow(edge.x1, edge.y1, edge.x2, edge.y2, false)}
              fill={edge.color}
            />
          </g>
        ))}
      </svg>
      {callout.edges.map((edge) => (
        <label
          key={edge.axis}
          style={{
            position: "absolute",
            left: edge.lx,
            top: edge.ly,
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            pointerEvents: "auto",
            zIndex: 5,
          }}
          onPointerDown={blockOverlayEvent}
          onPointerMove={blockIdlePointer}
          onPointerUp={blockOverlayEvent}
          onClick={blockOverlayEvent}
          onKeyDown={blockOverlayEvent}
          onKeyUp={blockOverlayEvent}
        >
          <input
            ref={(el) => {
              inputRefs.current[edge.axis] = el
            }}
            className="adivi-num-input"
            type="text"
            inputMode="decimal"
            aria-label={`${edge.axis.toUpperCase()} dimension in ${lengthUnit}`}
            value={
              drafts[edge.axis] !== undefined
                ? drafts[edge.axis]
                : fmt(edge.length)
            }
            onFocus={(e) => {
              onFocusAxis(edge.axis, callout.id)
              requestAnimationFrame(() => e.currentTarget.select())
            }}
            onChange={(e) => {
              if (drafts[edge.axis] === undefined) {
                onFocusAxis(edge.axis, callout.id)
                onDraft(edge.axis, e.target.value)
                return
              }
              onDraft(edge.axis, e.target.value)
            }}
            onBlur={() => onCancel(edge.axis)}
            onPointerDown={blockOverlayEvent}
            onPointerMove={blockIdlePointer}
            onPointerUp={blockOverlayEvent}
            onClick={blockOverlayEvent}
            onKeyUp={blockOverlayEvent}
            onKeyDown={(e) => {
              e.stopPropagation()
              const isPrintable =
                e.key.length === 1 &&
                /[0-9.,\-]/.test(e.key) &&
                !e.ctrlKey &&
                !e.metaKey
              if (isPrintable && drafts[edge.axis] === undefined) {
                e.preventDefault()
                onFocusAxis(edge.axis, callout.id)
                onDraft(edge.axis, e.key)
                return
              }
              if (e.shiftKey && e.key !== "Escape") onShiftProportional()
              if (e.key === "Enter") {
                e.preventDefault()
                onCommit(
                  callout.id,
                  edge.axis,
                  e.currentTarget.value,
                  e.shiftKey,
                  e.ctrlKey || e.altKey || e.metaKey
                )
                e.currentTarget.blur()
              } else if (e.key === "Escape") {
                e.preventDefault()
                onCancel(edge.axis)
                e.currentTarget.blur()
              }
            }}
            style={{
              width: 68,
              height: 22,
              borderRadius: 5,
              border: `1px solid ${edge.color}`,
              backgroundColor: "rgba(15, 23, 42, 0.92)",
              color: "#F8FAFC",
              padding: "0 4px",
              fontSize: 12,
              fontWeight: 700,
              textAlign: "center",
              outline: "none",
              boxSizing: "border-box",
              userSelect: "text",
              boxShadow: `0 0 0 1px ${edge.color}, 0 4px 14px rgba(0,0,0,0.35)`,
            }}
          />
        </label>
      ))}
    </>
  )
}
