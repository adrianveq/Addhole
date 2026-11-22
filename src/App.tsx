import * as React from "react"
import * as THREE from "three"
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js"
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js"
import {
  AdiviEditorProps,
  BevelMode,
  ConfirmDialogState,
  DimUnit,
  EditingGroupState,
  PrimitiveKind,
  SceneControllerHandle,
  SceneObject,
  SnapAction,
  SvgModalState,
  ToolMode,
} from "./types/editor"
import { downloadBlob, fmt, uid } from "./utils/format"
import { snapCm, snapRotationDeg } from "./utils/transformSnap"
import {
  acceptPosAsHome,
  acceptRotAsHome,
  acceptScaleAsHome,
  isPosAwayFromHome,
  isRotAwayFromHome,
  isScaleAwayFromHome,
} from "./utils/transformHome"
import {
  deserializeProjectPayload,
  loadAutosaveFromIdb,
  saveAutosaveToIdb,
  serializeProjectPayload,
} from "./utils/projectStorage"
import {
  analyzeSvg,
  buildGeometryFromContours,
  parse3mfToGeometry,
  parseStepToGeometry,
} from "./utils/fileLoaders"
import {
  createPrimitiveGeometry,
  evaluateCsgGroup,
  findConnectedComponents,
  getTriangleCount,
  mergeBakedGeometries,
  normalizeBottomCenter,
  simplifyBufferGeometry,
  splitGeometryIntoParts,
} from "./three/geometryOps"
import { createThemeHelpers } from "./styles/uiStyles"
import { Icon } from "./components/Icon"
import { ViewportCanvas } from "./components/ViewportCanvas"
import { ContextMenu } from "./components/ContextMenu"
import { TopToolbar } from "./components/TopToolbar"
import { TransformBar } from "./components/TransformBar"
import { InspectorPanel } from "./components/InspectorPanel"
import { BottomBar } from "./components/BottomBar"
import { EditorModals } from "./components/Modals"

export function Adivi3DModelViewer(props: AdiviEditorProps) {
  const {
    colors,
    svgDefaults,
    viewerDefaults,
    scaleRefModel,
    texts,
    initialModel,
    embedded = false,
    style,
  } = props

  const accent = colors?.accentColor || "#0D9488"
  const accentBorder = colors?.accentBorder || "#14B8A6"
  const bgHex = colors?.bgColor || "#0F172A"
  const defaultModelHex = colors?.modelColor || "#E2E8F0"
  const radius = Math.max(0, Number(colors?.borderRadius ?? 8))

  const {
    rSm,
    glass,
    sqToolBtn,
    subtleSqBtn,
    contextualBtnStyle,
    ctxMenuItemStyle,
  } = React.useMemo(
    () => createThemeHelpers(accent, accentBorder, radius),
    [accent, accentBorder, radius]
  )

  const svgLongCm = Math.max(1, Number(svgDefaults?.longestSideCm ?? 10))
  const svgHeightCm = Math.max(0.1, Number(svgDefaults?.heightCm ?? 1))
  const bananaCm = Math.max(4, Number(viewerDefaults?.bananaLengthCm ?? 18))

  const [gridSizeCm, setGridSizeCm] = React.useState<number>(
    Math.max(5, Number(viewerDefaults?.gridSizeCm ?? 25))
  )
  const [gridStepCm, setGridStepCm] = React.useState<number>(5)
  const [plateSizeText, setPlateSizeText] = React.useState<string>(
    String(Math.max(5, Number(viewerDefaults?.gridSizeCm ?? 25)))
  )
  const [plateStepText, setPlateStepText] = React.useState<string>("5")
  const [plateSettingsOpen, setPlateSettingsOpen] = React.useState(false)

  // Custom Scale Reference Model
  const [customRefModel, setCustomRefModel] = React.useState<{
    name: string
    geometry: THREE.BufferGeometry
  } | null>(null)
  const refModelInputRef = React.useRef<HTMLInputElement>(null)

  // Modals & Popovers
  const [aboutModalOpen, setAboutModalOpen] = React.useState(false)
  const [addMenuOpen, setAddMenuOpen] = React.useState(false)
  const [roundedBoxModalOpen, setRoundedBoxModalOpen] = React.useState(false)
  const [rbDimCm, setRbDimCm] = React.useState({ x: "2", y: "2", z: "2" })
  const [rbLockProp, setRbLockProp] = React.useState(false)
  const [bevelRadiusMm, setBevelRadiusMm] = React.useState<number>(2.5)
  const [bevelMode, setBevelMode] = React.useState<BevelMode>("fillet")
  const [layOnFaceMode, setLayOnFaceMode] = React.useState(false)
  const [contextMenu, setContextMenu] = React.useState<null | {
    x: number
    y: number
  }>(null)

  // Touch / Marquee multi-select toggle
  const [marqueeSelectMode, setMarqueeSelectMode] = React.useState(false)

  // Responsive collapsible panels
  const isMobileInit =
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  const [objectsCollapsed, setObjectsCollapsed] =
    React.useState<boolean>(isMobileInit)
  const [inspectorCollapsed, setInspectorCollapsed] =
    React.useState<boolean>(isMobileInit)
  const [objectsListHeight, setObjectsListHeight] = React.useState<number>(235)
  const [collapsedGroups, setCollapsedGroups] = React.useState<
    Record<string, boolean>
  >({})
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [renameText, setRenameText] = React.useState<string>("")

  // Mesh Simplify, Wireframe & Optional Edge Highlight
  const [simplifyOpen, setSimplifyOpen] = React.useState(false)
  const [simplifyPercent, setSimplifyPercent] = React.useState<number>(40)
  const [showWireframe, setShowWireframe] = React.useState(false)
  const [showEdgeHighlight, setShowEdgeHighlight] = React.useState(false)

  // Snapshot settings
  const [snapshotModalOpen, setSnapshotModalOpen] = React.useState(false)
  const [snapIncludeModel, setSnapIncludeModel] = React.useState(true)
  const [snapIncludePlate, setSnapIncludePlate] = React.useState(true)
  const [snapIncludeBg, setSnapIncludeBg] = React.useState(true)
  const [snapAction, setSnapAction] = React.useState<SnapAction>("clipboard")

  // Group Isolate Editing State
  const [editingGroupState, setEditingGroupState] =
    React.useState<EditingGroupState | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const svgInputRef = React.useRef<HTMLInputElement>(null)
  const sceneRef = React.useRef<SceneControllerHandle | null>(null)
  const clipboardRef = React.useRef<SceneObject[]>([])
  const hydratedRef = React.useRef(false)

  const [objects, setObjects] = React.useState<SceneObject[]>([])
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [toolMode, setToolMode] = React.useState<ToolMode>("move")
  const [isOrtho, setIsOrtho] = React.useState(false)
  const [colorPopoverId, setColorPopoverId] = React.useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] =
    React.useState<ConfirmDialogState | null>(null)
  const [marqueeBox, setMarqueeBox] = React.useState<null | {
    x: number
    y: number
    w: number
    h: number
  }>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [loadingText, setLoadingText] = React.useState("")
  const [svgModal, setSvgModal] = React.useState<SvgModalState | null>(null)
  const [savedBadge, setSavedBadge] = React.useState(false)

  const [showGrid, setShowGrid] = React.useState(
    viewerDefaults?.showGrid ?? true
  )
  const [showScaleRef, setShowScaleRef] = React.useState(
    viewerDefaults?.showBanana ?? false
  )
  const [isTurntable, setIsTurntable] = React.useState(
    viewerDefaults?.autoRotate ?? false
  )
  const [lengthUnit, setLengthUnit] = React.useState<"cm" | "mm">("cm")
  const [scaleUnit, setScaleUnit] = React.useState<DimUnit>("cm")
  const [lockProp, setLockProp] = React.useState(true)
  const [copiedShot, setCopiedShot] = React.useState(false)

  // Restore autosaved project from IndexedDB
  React.useEffect(() => {
    if (hydratedRef.current || initialModel?.file) return
    hydratedRef.current = true
    ;(async () => {
      const saved = await loadAutosaveFromIdb()
      if (saved?.objects?.length) {
        try {
          const restored = deserializeProjectPayload(saved)
          setGridSizeCm(restored.gridSizeCm)
          setGridStepCm(restored.gridStepCm)
          setPlateSizeText(String(restored.gridSizeCm))
          setPlateStepText(String(restored.gridStepCm))
          setObjects(restored.objects)
          if (restored.objects[0]) setSelectedIds([restored.objects[0].id])
        } catch {
          // Ignore corrupted autosave
        }
      }
    })()
  }, [initialModel?.file])

  // Debounced autosave
  React.useEffect(() => {
    if (editingGroupState) return
    const timer = setTimeout(
      () =>
        saveAutosaveToIdb(
          serializeProjectPayload(objects, gridSizeCm, gridStepCm)
        ),
      650
    )
    return () => clearTimeout(timer)
  }, [objects, gridSizeCm, gridStepCm, editingGroupState])

  // Undo / Redo history
  const historyRef = React.useRef<{
    past: SceneObject[][]
    future: SceneObject[][]
  }>({
    past: [],
    future: [],
  })
  const [histFlags, setHistFlags] = React.useState({
    canUndo: false,
    canRedo: false,
  })
  const syncHistFlags = React.useCallback(
    () =>
      setHistFlags({
        canUndo: historyRef.current.past.length > 0,
        canRedo: historyRef.current.future.length > 0,
      }),
    []
  )

  const commitObjects = React.useCallback(
    (updater: (prev: SceneObject[]) => SceneObject[], recordHistory = true) => {
      setObjects((prev) => {
        const next = updater(prev)
        if (recordHistory) {
          historyRef.current.past.push(
            prev.map((o) => ({
              ...o,
              scale: { ...o.scale },
              pos: { ...o.pos },
              rot: { ...o.rot },
              groupChildren: o.groupChildren
                ? o.groupChildren.map((c) => ({
                    ...c,
                    geometry: c.geometry.clone(),
                  }))
                : undefined,
            }))
          )
          if (historyRef.current.past.length > 40) historyRef.current.past.shift()
          historyRef.current.future = []
          setTimeout(syncHistFlags, 0)
        }
        return next
      })
    },
    [syncHistFlags]
  )

  const handleUndo = React.useCallback(() => {
    if (!historyRef.current.past.length) return
    setObjects((cur) => {
      const previous = historyRef.current.past.pop()!
      historyRef.current.future.push(cur)
      setTimeout(syncHistFlags, 0)
      return previous
    })
  }, [syncHistFlags])

  const handleRedo = React.useCallback(() => {
    if (!historyRef.current.future.length) return
    setObjects((cur) => {
      const next = historyRef.current.future.pop()!
      historyRef.current.past.push(cur)
      setTimeout(syncHistFlags, 0)
      return next
    })
  }, [syncHistFlags])

  // ========================================================================
  // GROUP ISOLATE MODE (NEVER TOUCHES CAMERA)
  // ========================================================================
  const enterGroupIsolation = React.useCallback(
    (groupId: string, initialChildIndex?: number) => {
      if (editingGroupState) return
      const grp = objects.find((o) => o.id === groupId)
      const mesh = sceneRef.current?.meshMap.get(groupId)
      if (!grp?.groupChildren?.length || !mesh) return

      mesh.updateMatrixWorld(true)
      const { cx, cy, minZ } = grp.groupOriginWorld || { cx: 0, cy: 0, minZ: 0 }
      const toGroupLocal = new THREE.Matrix4().makeTranslation(-cx, -cy, -minZ)
      const fullDelta = mesh.matrixWorld.clone().multiply(toGroupLocal)

      const editableChildren: SceneObject[] = grp.groupChildren.map((c, idx) => {
        const g = c.geometry.clone()
        g.applyMatrix4(fullDelta)
        g.computeBoundingBox()
        const bb = g.boundingBox!
        const pcx = (bb.min.x + bb.max.x) / 2
        const pcy = (bb.min.y + bb.max.y) / 2
        const pminZ = bb.min.z
        g.translate(-pcx, -pcy, -pminZ)
        g.computeBoundingBox()
        const b2 = g.boundingBox!
        return {
          id: uid(`gchild_${idx}`),
          name: c.name,
          color: c.color,
          opacity: c.opacity ?? 1,
          isHole: Boolean(c.isHole),
          partCount: findConnectedComponents(g).length,
          visible: c.visible !== false,
          isGroupMember: true,
          geometry: g,
          baseDim: {
            x: Math.max(0.01, (b2.max.x - b2.min.x) / 10),
            y: Math.max(0.01, (b2.max.y - b2.min.y) / 10),
            z: Math.max(0.01, (b2.max.z - b2.min.z) / 10),
          },
          scale: { sx: 1, sy: 1, sz: 1 },
          pos: {
            x: Number((pcx / 10).toFixed(2)),
            y: Number((pcy / 10).toFixed(2)),
            z: Number((pminZ / 10).toFixed(2)),
          },
          rot: { x: 0, y: 0, z: 0 },
        }
      })

      const others = objects.filter((o) => o.id !== groupId)
      setEditingGroupState({
        groupId: grp.id,
        groupName: grp.name,
        children: editableChildren,
        otherObjects: others,
      })

      setObjects([
        ...editableChildren,
        ...others.map((o) => ({ ...o, isGhostContext: true })),
      ])
      const targetChild =
        editableChildren[initialChildIndex ?? 0] || editableChildren[0]
      setSelectedIds(targetChild ? [targetChild.id] : [])
    },
    [editingGroupState, objects]
  )

  const exitGroupIsolation = React.useCallback(
    async (nextSelectedIdsAfterExit?: string[]) => {
      if (!editingGroupState || !sceneRef.current) return
      const { groupId, groupName, otherObjects } = editingGroupState
      const currentMembers = objects.filter((o) => o.isGroupMember)
      const activeMembers = currentMembers.filter((o) => o.visible)
      const solids = activeMembers.filter((t) => !t.isHole)

      const getBakedWorldGeom = (o: SceneObject) => {
        const mesh = sceneRef.current?.meshMap.get(o.id)
        if (mesh) {
          mesh.updateMatrixWorld(true)
          const g = o.geometry.clone()
          g.applyMatrix4(mesh.matrixWorld)
          return g
        }
        const g = o.geometry.clone()
        g.scale(o.scale.sx, o.scale.sy, o.scale.sz)
        g.applyQuaternion(
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(
              THREE.MathUtils.degToRad(o.rot.x),
              THREE.MathUtils.degToRad(o.rot.y),
              THREE.MathUtils.degToRad(o.rot.z),
              "ZYX"
            )
          )
        )
        g.translate(o.pos.x * 10, o.pos.y * 10, o.pos.z * 10)
        return g
      }

      const allBakedChildren = currentMembers.map((m) => ({
        name: m.name,
        color: m.color,
        opacity: m.opacity ?? 1,
        isHole: Boolean(m.isHole),
        visible: m.visible,
        geometry: getBakedWorldGeom(m),
      }))

      if (!solids.length) {
        setEditingGroupState(null)
        commitObjects(() => otherObjects)
        setSelectedIds(
          nextSelectedIdsAfterExit ||
            (otherObjects[0] ? [otherObjects[0].id] : [])
        )
        return
      }

      setLoadingText("Updating group...")
      await new Promise((r) => setTimeout(r, 20))
      try {
        const bakedSolids = allBakedChildren.filter((c) => c.visible && !c.isHole)
        const bakedHoles = allBakedChildren.filter((c) => c.visible && c.isHole)
        const resultGeom = evaluateCsgGroup(bakedSolids, bakedHoles)
        resultGeom.computeBoundingBox()
        const bb = resultGeom.boundingBox!
        if (!isFinite(bb.min.x)) throw new Error("Empty boolean result")

        const cx = (bb.min.x + bb.max.x) / 2
        const cy = (bb.min.y + bb.max.y) / 2
        const minZ = bb.min.z
        resultGeom.translate(-cx, -cy, -minZ)
        resultGeom.computeBoundingBox()
        const b2 = resultGeom.boundingBox!

        const updatedGroup: SceneObject = {
          id: groupId,
          name: groupName,
          color: bakedSolids[0].color,
          opacity: bakedSolids[0].opacity ?? 1,
          isHole: false,
          partCount: findConnectedComponents(resultGeom).length,
          groupChildren: allBakedChildren,
          groupOriginWorld: { cx, cy, minZ },
          visible: true,
          geometry: resultGeom,
          baseDim: {
            x: Math.max(0.01, (b2.max.x - b2.min.x) / 10),
            y: Math.max(0.01, (b2.max.y - b2.min.y) / 10),
            z: Math.max(0.01, (b2.max.z - b2.min.z) / 10),
          },
          scale: { sx: 1, sy: 1, sz: 1 },
          pos: {
            x: Number((cx / 10).toFixed(2)),
            y: Number((cy / 10).toFixed(2)),
            z: Number((minZ / 10).toFixed(2)),
          },
          rot: { x: 0, y: 0, z: 0 },
        }

        setEditingGroupState(null)
        commitObjects(() => [...otherObjects, updatedGroup])
        setSelectedIds(nextSelectedIdsAfterExit || [groupId])
      } catch (err) {
        console.error(err)
        alert(
          "Boolean update failed — ensure solid and hole parts overlap properly."
        )
      } finally {
        setLoadingText("")
      }
    },
    [editingGroupState, objects, commitObjects]
  )

  const primarySelectedId = selectedIds[selectedIds.length - 1] || null
  const selectedObj = React.useMemo(
    () => objects.find((o) => o.id === primarySelectedId) || null,
    [objects, primarySelectedId]
  )
  const selectedTriCount = React.useMemo(() => {
    if (!selectedIds.length) return 0
    const set = new Set(selectedIds)
    return objects.reduce(
      (sum, o) =>
        set.has(o.id) && !o.isGhostContext
          ? sum + getTriangleCount(o.geometry)
          : sum,
      0
    )
  }, [objects, selectedIds])

  const getWorldMinZMm = React.useCallback((o: SceneObject) => {
    const mesh = sceneRef.current?.meshMap.get(o.id)
    if (mesh) {
      mesh.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(mesh)
      if (isFinite(box.min.z)) return box.min.z
    }
    return o.pos.z * 10
  }, [])

  const isAnySelectedOffPlate = React.useMemo(() => {
    if (!selectedIds.length) return false
    return objects.some(
      (o) =>
        selectedIds.includes(o.id) &&
        !o.isGhostContext &&
        Math.abs(getWorldMinZMm(o)) > 0.15
    )
  }, [objects, selectedIds, getWorldMinZMm])

  const handleDropToPlate = React.useCallback(() => {
    if (!selectedIds.length) return
    const set = new Set(selectedIds)
    commitObjects(
      (prev) =>
        prev.map((o) => {
          if (!set.has(o.id) || o.isGhostContext) return o
          const curMinZMm = getWorldMinZMm(o)
          const nextZCm = Number((o.pos.z - curMinZMm / 10).toFixed(2))
          return { ...o, pos: { ...o.pos, z: nextZCm } }
        }),
      !editingGroupState
    )
  }, [selectedIds, commitObjects, getWorldMinZMm, editingGroupState])

  const isScaleModified = Boolean(selectedObj && isScaleAwayFromHome(selectedObj))
  const isPosModified = Boolean(selectedObj && isPosAwayFromHome(selectedObj))
  const isRotModified = Boolean(selectedObj && isRotAwayFromHome(selectedObj))
  const canUngroupSelected = Boolean(
    !editingGroupState &&
      selectedIds.length === 1 &&
      (selectedObj?.groupChildren?.length || 0) > 1
  )
  const canSplitSelected = Boolean(
    !editingGroupState &&
      selectedIds.length === 1 &&
      (selectedObj?.partCount || 1) > 1
  )
  const showDropButton = Boolean(
    toolMode === "move" && selectedObj && isAnySelectedOffPlate
  )

  const [dimInputs, setDimInputs] = React.useState({ x: "0", y: "0", z: "0" })
  const [posInputs, setPosInputs] = React.useState({ x: "0", y: "0", z: "0" })
  const [rotInputs, setRotInputs] = React.useState({ x: "0", y: "0", z: "0" })

  React.useEffect(() => {
    if (!selectedObj) return
    const { baseDim, scale, pos, rot } = selectedObj
    const sizeX = snapCm(baseDim.x * scale.sx)
    const sizeY = snapCm(baseDim.y * scale.sy)
    const sizeZ = snapCm(baseDim.z * scale.sz)
    setDimInputs({
      x: fmt(
        scaleUnit === "%"
          ? (sizeX / baseDim.x) * 100
          : scaleUnit === "mm"
            ? sizeX * 10
            : sizeX
      ),
      y: fmt(
        scaleUnit === "%"
          ? (sizeY / baseDim.y) * 100
          : scaleUnit === "mm"
            ? sizeY * 10
            : sizeY
      ),
      z: fmt(
        scaleUnit === "%"
          ? (sizeZ / baseDim.z) * 100
          : scaleUnit === "mm"
            ? sizeZ * 10
            : sizeZ
      ),
    })
    setPosInputs({
      x: fmt(lengthUnit === "mm" ? snapCm(pos.x) * 10 : snapCm(pos.x)),
      y: fmt(lengthUnit === "mm" ? snapCm(pos.y) * 10 : snapCm(pos.y)),
      z: fmt(lengthUnit === "mm" ? snapCm(pos.z) * 10 : snapCm(pos.z)),
    })
    setRotInputs({
      x: fmt(snapRotationDeg(rot.x)),
      y: fmt(snapRotationDeg(rot.y)),
      z: fmt(snapRotationDeg(rot.z)),
    })
  }, [selectedObj, scaleUnit, lengthUnit])

  React.useEffect(() => {
    if (toolMode !== "rotate" && layOnFaceMode) setLayOnFaceMode(false)
  }, [toolMode, layOnFaceMode])

  const patchObject = React.useCallback(
    (
      id: string,
      fn: (o: SceneObject) => SceneObject,
      recordHistory = true
    ) => {
      commitObjects(
        (prev) => prev.map((o) => (o.id === id ? fn(o) : o)),
        recordHistory && !editingGroupState
      )
    },
    [commitObjects, editingGroupState]
  )

  const handleAcceptScale = React.useCallback(() => {
    if (!selectedObj) return
    patchObject(selectedObj.id, acceptScaleAsHome)
  }, [selectedObj, patchObject])

  const handleAcceptPos = React.useCallback(() => {
    if (!selectedObj) return
    patchObject(selectedObj.id, acceptPosAsHome)
  }, [selectedObj, patchObject])

  const handleAcceptRot = React.useCallback(() => {
    if (!selectedObj) return
    patchObject(selectedObj.id, acceptRotAsHome)
  }, [selectedObj, patchObject])

  const patchSelected = React.useCallback(
    (fn: (o: SceneObject) => SceneObject, recordHistory = true) => {
      if (!selectedIds.length) return
      const set = new Set(selectedIds)
      commitObjects(
        (prev) => prev.map((o) => (set.has(o.id) ? fn(o) : o)),
        recordHistory && !editingGroupState
      )
    },
    [selectedIds, commitObjects, editingGroupState]
  )

  const moveObjectInList = (id: string, direction: -1 | 1) => {
    commitObjects((prev) => {
      const idx = prev.findIndex((o) => o.id === id)
      if (idx < 0) return prev
      const targetIdx = idx + direction
      if (targetIdx < 0 || targetIdx >= prev.length) return prev
      if (editingGroupState && !prev[targetIdx]?.isGroupMember) return prev
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      copy.splice(targetIdx, 0, item)
      return copy
    }, !editingGroupState)
  }

  const handleSimplifySelected = async () => {
    if (!selectedObj) return
    setLoadingText(`Simplifying mesh (${simplifyPercent}%)...`)
    await new Promise((r) => setTimeout(r, 20))
    try {
      const ratio = THREE.MathUtils.clamp(simplifyPercent / 100, 0.05, 0.9)
      const simplifiedGeom = simplifyBufferGeometry(selectedObj.geometry, ratio)
      patchObject(selectedObj.id, (o) => ({
        ...o,
        geometry: simplifiedGeom,
        partCount: findConnectedComponents(simplifiedGeom).length,
      }))
      setSimplifyOpen(false)
    } catch (err) {
      console.error(err)
      alert("Mesh simplification failed on this geometry.")
    } finally {
      setLoadingText("")
    }
  }

  const requestDeleteObjects = React.useCallback(
    (idsToDelete: string[]) => {
      if (!idsToDelete.length) return
      const targets = objects.filter(
        (o) => idsToDelete.includes(o.id) && !o.isGhostContext
      )
      if (!targets.length) return
      const label =
        targets.length === 1
          ? `"${targets[0].name}"`
          : `${targets.length} objects`
      setConfirmDialog({
        title: "Delete Object",
        message: `Are you sure you want to delete ${label}?`,
        confirmLabel: "Delete",
        onConfirm: () => {
          const delSet = new Set(idsToDelete)
          commitObjects((prev) => {
            const next = prev.filter((o) => !delSet.has(o.id))
            setSelectedIds((cur) => {
              const rem = cur.filter((id) => !delSet.has(id))
              const validNext = next.filter((o) => !o.isGhostContext)
              return rem.length
                ? rem
                : validNext[validNext.length - 1]?.id
                  ? [validNext[validNext.length - 1].id]
                  : []
            })
            return next
          }, !editingGroupState)
          setConfirmDialog(null)
        },
      })
    },
    [objects, commitObjects, editingGroupState]
  )

  const duplicateSelected = React.useCallback(() => {
    if (!selectedIds.length || editingGroupState) return
    const clones = objects
      .filter((o) => selectedIds.includes(o.id))
      .map((o, i) => ({
        ...o,
        id: uid(`dup_${i}`),
        name: `${o.name} (Copy)`,
        geometry: o.geometry.clone(),
        scale: { ...o.scale },
        pos: { ...o.pos, x: Number((o.pos.x + 1.5).toFixed(2)) },
        rot: { ...o.rot },
      }))
    commitObjects((prev) => [...prev, ...clones])
    setSelectedIds(clones.map((c) => c.id))
  }, [selectedIds, editingGroupState, objects, commitObjects])

  const handleCenterOnPlate = () => {
    if (!selectedIds.length || !sceneRef.current) return
    const box = new THREE.Box3()
    let count = 0
    for (const id of selectedIds) {
      const m = sceneRef.current.meshMap.get(id)
      if (!m) continue
      m.updateMatrixWorld(true)
      box.expandByObject(m)
      count++
    }
    if (!count) return
    const cx = (box.min.x + box.max.x) / 20
    const cy = (box.min.y + box.max.y) / 20
    patchSelected((o) => ({
      ...o,
      pos: {
        ...o.pos,
        x: Number((o.pos.x - cx).toFixed(2)),
        y: Number((o.pos.y - cy).toFixed(2)),
      },
    }))
  }

  const applyLayOnFace = React.useCallback(
    (objId: string, worldFaceNormal: THREE.Vector3) => {
      const mesh = sceneRef.current?.meshMap.get(objId)
      const obj = (sceneRef.current?.latestObjects || []).find(
        (o) => o.id === objId
      )
      if (!mesh || !obj) return

      mesh.updateMatrixWorld(true)
      const n = worldFaceNormal.clone().normalize()
      const targetDown = new THREE.Vector3(0, 0, -1)
      const qAlign =
        n.dot(targetDown) < -0.9999
          ? new THREE.Quaternion().setFromAxisAngle(
              new THREE.Vector3(1, 0, 0),
              Math.PI
            )
          : new THREE.Quaternion().setFromUnitVectors(n, targetDown)

      const nextQuat = qAlign.multiply(mesh.quaternion.clone()).normalize()
      const euler = new THREE.Euler().setFromQuaternion(nextQuat, "ZYX")
      const rx = Number(THREE.MathUtils.radToDeg(euler.x).toFixed(2))
      const ry = Number(THREE.MathUtils.radToDeg(euler.y).toFixed(2))
      const rz = Number(THREE.MathUtils.radToDeg(euler.z).toFixed(2))

      const rotMat = new THREE.Matrix4().makeRotationFromEuler(
        new THREE.Euler(
          THREE.MathUtils.degToRad(rx),
          THREE.MathUtils.degToRad(ry),
          THREE.MathUtils.degToRad(rz),
          "ZYX"
        )
      )
      const combined = rotMat.multiply(
        new THREE.Matrix4().makeScale(obj.scale.sx, obj.scale.sy, obj.scale.sz)
      )
      const posAttr = obj.geometry.attributes.position
      const v = new THREE.Vector3()
      let minZMm = Infinity
      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i).applyMatrix4(combined)
        if (v.z < minZMm) minZMm = v.z
      }
      const nextPosZCm = isFinite(minZMm) ? Number((-minZMm / 10).toFixed(2)) : 0

      patchObject(objId, (o) => ({
        ...o,
        rot: { x: rx, y: ry, z: rz },
        pos: { ...o.pos, z: nextPosZCm },
      }))
      setLayOnFaceMode(false)
    },
    [patchObject]
  )

  const handleAlignSelected = (
    axis: "x" | "y" | "z",
    mode: "min" | "center" | "max"
  ) => {
    if (selectedIds.length < 2 || !sceneRef.current) return
    const entries: Array<{ id: string; box: THREE.Box3 }> = []
    const globalBox = new THREE.Box3()
    for (const id of selectedIds) {
      const mesh = sceneRef.current.meshMap.get(id)
      if (!mesh) continue
      mesh.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(mesh)
      entries.push({ id, box })
      globalBox.union(box)
    }
    if (entries.length < 2) return

    const targetVal =
      mode === "min"
        ? globalBox.min[axis]
        : mode === "max"
          ? globalBox.max[axis]
          : (globalBox.min[axis] + globalBox.max[axis]) / 2

    const deltaMap = new Map<string, number>()
    for (const { id, box } of entries) {
      const curVal =
        mode === "min"
          ? box.min[axis]
          : mode === "max"
            ? box.max[axis]
            : (box.min[axis] + box.max[axis]) / 2
      deltaMap.set(id, (targetVal - curVal) / 10)
    }

    commitObjects(
      (prev) =>
        prev.map((o) => {
          const d = deltaMap.get(o.id)
          return d === undefined
            ? o
            : {
                ...o,
                pos: {
                  ...o.pos,
                  [axis]: Number((o.pos[axis] + d).toFixed(2)),
                },
              }
        }),
      !editingGroupState
    )
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        svgModal ||
        confirmDialog ||
        plateSettingsOpen ||
        roundedBoxModalOpen ||
        snapshotModalOpen ||
        aboutModalOpen
      ) {
        return
      }

      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (key === "escape") {
        if (contextMenu) setContextMenu(null)
        else if (layOnFaceMode) setLayOnFaceMode(false)
        else if (addMenuOpen) setAddMenuOpen(false)
        else if (marqueeSelectMode) setMarqueeSelectMode(false)
        else if (editingGroupState) exitGroupIsolation()
        return
      }
      if (ctrl && key === "a") {
        e.preventDefault()
        setSelectedIds(
          objects.filter((o) => !o.isGhostContext).map((o) => o.id)
        )
        return
      }
      if (
        ctrl &&
        key === "c" &&
        selectedIds.length > 0 &&
        !editingGroupState
      ) {
        e.preventDefault()
        clipboardRef.current = objects
          .filter((o) => selectedIds.includes(o.id))
          .map((o) => ({
            ...o,
            geometry: o.geometry.clone(),
            scale: { ...o.scale },
            pos: { ...o.pos },
            rot: { ...o.rot },
            groupChildren: o.groupChildren
              ? o.groupChildren.map((c) => ({
                  ...c,
                  geometry: c.geometry.clone(),
                }))
              : undefined,
          }))
        return
      }
      if (
        ctrl &&
        key === "v" &&
        clipboardRef.current.length > 0 &&
        !editingGroupState
      ) {
        e.preventDefault()
        const pasted = clipboardRef.current.map((o, i) => ({
          ...o,
          id: uid(`paste_${i}`),
          name: `${o.name.replace(/ \(Copy\)$/, "")} (Copy)`,
          geometry: o.geometry.clone(),
          scale: { ...o.scale },
          pos: {
            ...o.pos,
            x: Number((o.pos.x + 1.5).toFixed(2)),
            y: Number((o.pos.y - 1.5).toFixed(2)),
          },
          rot: { ...o.rot },
        }))
        clipboardRef.current = clipboardRef.current.map((o) => ({
          ...o,
          pos: { ...o.pos, x: o.pos.x + 1.5, y: o.pos.y - 1.5 },
        }))
        commitObjects((prev) => [...prev, ...pasted])
        setSelectedIds(pasted.map((c) => c.id))
        return
      }
      if (ctrl && key === "z" && !e.shiftKey && !editingGroupState) {
        e.preventDefault()
        handleUndo()
        return
      }
      if (
        ((ctrl && key === "y") || (ctrl && e.shiftKey && key === "z")) &&
        !editingGroupState
      ) {
        e.preventDefault()
        handleRedo()
        return
      }
      if (!ctrl && key === "m" && selectedIds.length > 0) {
        setToolMode("move")
        return
      }
      if (!ctrl && key === "r" && selectedIds.length > 0) {
        setToolMode("rotate")
        return
      }
      if (!ctrl && key === "s" && selectedIds.length > 0) {
        setToolMode("scale")
        return
      }
      if (
        ctrl &&
        key === "d" &&
        selectedIds.length > 0 &&
        !editingGroupState
      ) {
        e.preventDefault()
        duplicateSelected()
        return
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        e.preventDefault()
        requestDeleteObjects(selectedIds)
        return
      }
      if (key === "d" && !ctrl && selectedIds.length > 0) {
        e.preventDefault()
        handleDropToPlate()
        return
      }
      if (key === "f" && !ctrl) {
        e.preventDefault()
        sceneRef.current?.focusObject(primarySelectedId)
        return
      }
      if (key === "h" && !ctrl && selectedIds.length > 0) {
        e.preventDefault()
        patchSelected((o) => ({ ...o, visible: !o.visible }))
        return
      }
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key) &&
        selectedIds.length > 0
      ) {
        e.preventDefault()
        const step = e.shiftKey ? 0.5 : 0.1
        const dx =
          key === "arrowleft" ? -step : key === "arrowright" ? step : 0
        const dy = key === "arrowup" ? step : key === "arrowdown" ? -step : 0
        if (ctrl && (key === "arrowup" || key === "arrowdown")) {
          patchSelected((o) => ({
            ...o,
            pos: {
              ...o.pos,
              z: Number(
                (o.pos.z + (key === "arrowup" ? step : -step)).toFixed(2)
              ),
            },
          }))
        } else {
          patchSelected((o) => ({
            ...o,
            pos: {
              ...o.pos,
              x: Number((o.pos.x + dx).toFixed(2)),
              y: Number((o.pos.y + dy).toFixed(2)),
            },
          }))
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    objects,
    selectedIds,
    primarySelectedId,
    svgModal,
    confirmDialog,
    plateSettingsOpen,
    roundedBoxModalOpen,
    snapshotModalOpen,
    aboutModalOpen,
    addMenuOpen,
    layOnFaceMode,
    marqueeSelectMode,
    contextMenu,
    editingGroupState,
    exitGroupIsolation,
    handleUndo,
    handleRedo,
    commitObjects,
    patchSelected,
    requestDeleteObjects,
    duplicateSelected,
    handleDropToPlate,
  ])

  const handleImportRefModel = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    if (!["stl", "3mf", "step", "stp"].includes(ext)) {
      alert("Supported scale reference formats: STL, 3MF, STEP")
      return
    }
    setLoadingText(`Loading reference ${file.name}...`)
    try {
      const buf = await file.arrayBuffer()
      const geom =
        ext === "step" || ext === "stp"
          ? await parseStepToGeometry(buf)
          : ext === "3mf"
            ? await parse3mfToGeometry(buf)
            : new STLLoader().parse(buf)
      geom.computeBoundingBox()
      const bb = geom.boundingBox!
      geom.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -bb.min.z)
      geom.computeVertexNormals()
      setCustomRefModel({ name: file.name, geometry: geom })
      setShowScaleRef(true)
    } catch (err: any) {
      alert(err?.message || "Failed to import scale reference")
    } finally {
      setLoadingText("")
    }
  }

  const addSceneObject = React.useCallback(
    (
      rawGeom: THREE.BufferGeometry,
      name: string,
      colorHex = defaultModelHex,
      pos = { x: 0, y: 0, z: 0 }
    ) => {
      normalizeBottomCenter(rawGeom)
      rawGeom.computeBoundingBox()
      const b2 = rawGeom.boundingBox!
      const item: SceneObject = {
        id: uid(),
        name,
        color: colorHex,
        opacity: 1,
        isHole: false,
        isGroupMember: Boolean(editingGroupState),
        partCount: findConnectedComponents(rawGeom).length,
        visible: true,
        geometry: rawGeom,
        baseDim: {
          x: Math.max(0.01, (b2.max.x - b2.min.x) / 10),
          y: Math.max(0.01, (b2.max.y - b2.min.y) / 10),
          z: Math.max(0.01, (b2.max.z - b2.min.z) / 10),
        },
        scale: { sx: 1, sy: 1, sz: 1 },
        pos,
        rot: { x: 0, y: 0, z: 0 },
      }
      commitObjects((prev) => [...prev, item], !editingGroupState)
      setSelectedIds([item.id])
    },
    [defaultModelHex, commitObjects, editingGroupState]
  )

  const handleGroupSelected = async () => {
    if (selectedIds.length < 2 || !sceneRef.current || editingGroupState) return
    const targets = objects.filter((o) => selectedIds.includes(o.id))
    const solids = targets.filter((t) => !t.isHole)
    const holes = targets.filter((t) => t.isHole)
    if (!solids.length) {
      alert(
        "Select at least one solid (+) object together with a Hole (−) object."
      )
      return
    }

    setLoadingText("Grouping & boolean cutting...")
    await new Promise((r) => setTimeout(r, 25))
    try {
      const getBakedWorldGeom = (o: SceneObject) => {
        const mesh = sceneRef.current!.meshMap.get(o.id)!
        mesh.updateMatrixWorld(true)
        const g = o.geometry.clone()
        g.applyMatrix4(mesh.matrixWorld)
        return g
      }
      const bakedSolids = solids.map((s) => ({
        name: s.name,
        color: s.color,
        opacity: s.opacity ?? 1,
        isHole: false,
        visible: true,
        geometry: getBakedWorldGeom(s),
      }))
      const bakedHoles = holes.map((h) => ({
        name: h.name,
        color: h.color,
        opacity: h.opacity ?? 1,
        isHole: true,
        visible: true,
        geometry: getBakedWorldGeom(h),
      }))
      const resultGeom = evaluateCsgGroup(bakedSolids, bakedHoles)
      resultGeom.computeBoundingBox()
      const bb = resultGeom.boundingBox!
      if (!isFinite(bb.min.x)) throw new Error("Empty boolean result")

      const cx = (bb.min.x + bb.max.x) / 2
      const cy = (bb.min.y + bb.max.y) / 2
      const minZ = bb.min.z
      resultGeom.translate(-cx, -cy, -minZ)
      resultGeom.computeBoundingBox()
      const b2 = resultGeom.boundingBox!

      const groupedObj: SceneObject = {
        id: uid("grp"),
        name: solids[0].name.replace(/\.[^/.]+$/, ""),
        color: solids[0].color,
        opacity: solids[0].opacity ?? 1,
        isHole: false,
        partCount: findConnectedComponents(resultGeom).length,
        groupChildren: [...bakedSolids, ...bakedHoles],
        groupOriginWorld: { cx, cy, minZ },
        visible: true,
        geometry: resultGeom,
        baseDim: {
          x: Math.max(0.01, (b2.max.x - b2.min.x) / 10),
          y: Math.max(0.01, (b2.max.y - b2.min.y) / 10),
          z: Math.max(0.01, (b2.max.z - b2.min.z) / 10),
        },
        scale: { sx: 1, sy: 1, sz: 1 },
        pos: {
          x: Number((cx / 10).toFixed(2)),
          y: Number((cy / 10).toFixed(2)),
          z: Number((minZ / 10).toFixed(2)),
        },
        rot: { x: 0, y: 0, z: 0 },
      }

      const selSet = new Set(selectedIds)
      commitObjects((prev) => [
        ...prev.filter((o) => !selSet.has(o.id)),
        groupedObj,
      ])
      setSelectedIds([groupedObj.id])
    } catch (err) {
      console.error(err)
      alert(
        "Boolean operation failed — ensure both meshes overlap and are watertight."
      )
    } finally {
      setLoadingText("")
    }
  }

  const handleUngroupSelected = () => {
    if (!selectedObj?.groupChildren?.length || !sceneRef.current) return
    const mesh = sceneRef.current.meshMap.get(selectedObj.id)
    if (!mesh) return
    mesh.updateMatrixWorld(true)
    const { cx, cy, minZ } = selectedObj.groupOriginWorld || {
      cx: 0,
      cy: 0,
      minZ: 0,
    }
    const fullDelta = mesh.matrixWorld
      .clone()
      .multiply(new THREE.Matrix4().makeTranslation(-cx, -cy, -minZ))

    const restored: SceneObject[] = selectedObj.groupChildren.map((c, idx) => {
      const g = c.geometry.clone()
      g.applyMatrix4(fullDelta)
      g.computeBoundingBox()
      const bb = g.boundingBox!
      const pcx = (bb.min.x + bb.max.x) / 2
      const pcy = (bb.min.y + bb.max.y) / 2
      const pminZ = bb.min.z
      g.translate(-pcx, -pcy, -pminZ)
      g.computeBoundingBox()
      const b2 = g.boundingBox!
      return {
        id: uid(`ungrp_${idx}`),
        name: c.name,
        color: c.color,
        opacity: c.opacity ?? 1,
        isHole: c.isHole,
        partCount: findConnectedComponents(g).length,
        visible: c.visible !== false,
        geometry: g,
        baseDim: {
          x: Math.max(0.01, (b2.max.x - b2.min.x) / 10),
          y: Math.max(0.01, (b2.max.y - b2.min.y) / 10),
          z: Math.max(0.01, (b2.max.z - b2.min.z) / 10),
        },
        scale: { sx: 1, sy: 1, sz: 1 },
        pos: {
          x: Number((pcx / 10).toFixed(2)),
          y: Number((pcy / 10).toFixed(2)),
          z: Number((pminZ / 10).toFixed(2)),
        },
        rot: { x: 0, y: 0, z: 0 },
      }
    })

    commitObjects((prev) => [
      ...prev.filter((o) => o.id !== selectedObj.id),
      ...restored,
    ])
    setSelectedIds(restored.map((r) => r.id))
  }

  const handleSplitSelected = () => {
    if (!selectedObj || !sceneRef.current) return
    const mesh = sceneRef.current.meshMap.get(selectedObj.id)
    if (!mesh) return
    mesh.updateMatrixWorld(true)
    const baked = selectedObj.geometry.clone()
    baked.applyMatrix4(mesh.matrixWorld)
    const parts = splitGeometryIntoParts(baked)
    if (parts.length <= 1) return

    const newItems: SceneObject[] = parts.map((partGeom, idx) => {
      partGeom.computeBoundingBox()
      const bb = partGeom.boundingBox!
      const cx = (bb.min.x + bb.max.x) / 2
      const cy = (bb.min.y + bb.max.y) / 2
      const minZ = bb.min.z
      partGeom.translate(-cx, -cy, -minZ)
      partGeom.computeBoundingBox()
      const b2 = partGeom.boundingBox!
      return {
        id: uid(`split_${idx}`),
        name: `${selectedObj.name.replace(/\.[^/.]+$/, "")} #${idx + 1}`,
        color: selectedObj.color,
        opacity: selectedObj.opacity ?? 1,
        isHole: selectedObj.isHole,
        partCount: 1,
        visible: true,
        geometry: partGeom,
        baseDim: {
          x: Math.max(0.01, (b2.max.x - b2.min.x) / 10),
          y: Math.max(0.01, (b2.max.y - b2.min.y) / 10),
          z: Math.max(0.01, (b2.max.z - b2.min.z) / 10),
        },
        scale: { sx: 1, sy: 1, sz: 1 },
        pos: {
          x: Number((cx / 10).toFixed(2)),
          y: Number((cy / 10).toFixed(2)),
          z: Number((minZ / 10).toFixed(2)),
        },
        rot: { x: 0, y: 0, z: 0 },
      }
    })

    commitObjects((prev) => [
      ...prev.filter((o) => o.id !== selectedObj.id),
      ...newItems,
    ])
    setSelectedIds(newItems.map((n) => n.id))
  }

  const handleMirrorAxis = (axis: "x" | "y" | "z") => {
    patchSelected((o) => {
      const base = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone()
      const pos = base.attributes.position
      const sx = axis === "x" ? -1 : 1
      const sy = axis === "y" ? -1 : 1
      const sz = axis === "z" ? -1 : 1
      for (let i = 0; i < pos.count; i += 3) {
        const x0 = pos.getX(i) * sx
        const y0 = pos.getY(i) * sy
        const z0 = pos.getZ(i) * sz
        const x1 = pos.getX(i + 1) * sx
        const y1 = pos.getY(i + 1) * sy
        const z1 = pos.getZ(i + 1) * sz
        const x2 = pos.getX(i + 2) * sx
        const y2 = pos.getY(i + 2) * sy
        const z2 = pos.getZ(i + 2) * sz
        pos.setXYZ(i, x0, y0, z0)
        pos.setXYZ(i + 1, x2, y2, z2)
        pos.setXYZ(i + 2, x1, y1, z1)
      }
      pos.needsUpdate = true
      normalizeBottomCenter(base)
      return { ...o, geometry: base }
    })
  }

  const handleAddPrimitive = (kind: PrimitiveKind, label: string) => {
    if (kind === "roundedBox") {
      setAddMenuOpen(false)
      setRoundedBoxModalOpen(true)
      return
    }
    addSceneObject(createPrimitiveGeometry(kind), label, defaultModelHex, {
      x: (objects.length % 5) * 1.2,
      y: 0,
      z: 0,
    })
    setAddMenuOpen(false)
  }

  const confirmAddRoundedBox = () => {
    const label = bevelMode === "chamfer" ? "Chamfer Box" : "Fillet Box"
    const dimMm = {
      x: Math.max(1, (parseFloat(rbDimCm.x) || 2) * 10),
      y: Math.max(1, (parseFloat(rbDimCm.y) || 2) * 10),
      z: Math.max(1, (parseFloat(rbDimCm.z) || 2) * 10),
    }
    addSceneObject(
      createPrimitiveGeometry("roundedBox", {
        dimMm,
        sizeMm: bevelRadiusMm,
        mode: bevelMode,
      }),
      label,
      defaultModelHex,
      { x: (objects.length % 5) * 1.2, y: 0, z: 0 }
    )
    setRoundedBoxModalOpen(false)
  }

  const handleSaveProjectFile = () => {
    downloadBlob(
      new Blob(
        [JSON.stringify(serializeProjectPayload(objects, gridSizeCm, gridStepCm))],
        { type: "application/json" }
      ),
      `adivi_project_${new Date().toISOString().slice(0, 10)}.adiv`
    )
    setSavedBadge(true)
    setTimeout(() => setSavedBadge(false), 1600)
  }

  // Load initialModel URL if provided
  React.useEffect(() => {
    const url = initialModel?.file
    if (!url) return
    let dead = false
    ;(async () => {
      try {
        const res = await fetch(url)
        if (!res.ok || dead) return
        const buf = await res.arrayBuffer()
        const name =
          initialModel?.name ||
          url.split("?")[0].split("/").pop() ||
          "model.stl"
        const ext = name.split(".").pop()?.toLowerCase()
        if (ext === "svg") {
          const an = analyzeSvg(new TextDecoder().decode(buf), name)
          const asp = an.spanY / an.spanX
          const active = an.layers.filter((l) => l.included)
          const b = an.getBounds(active)
          const geom = buildGeometryFromContours(
            active.flatMap((l) => l.contours),
            b.minX,
            b.minY,
            ((asp <= 1 ? svgLongCm : svgLongCm / asp) * 10) / (b.maxX - b.minX),
            ((asp <= 1 ? svgLongCm * asp : svgLongCm) * 10) / (b.maxY - b.minY),
            svgHeightCm * 10
          )
          if (!dead) addSceneObject(geom, name)
        } else {
          const geom =
            ext === "step" || ext === "stp"
              ? await parseStepToGeometry(buf)
              : ext === "3mf"
                ? await parse3mfToGeometry(buf)
                : new STLLoader().parse(buf)
          if (!dead) addSceneObject(geom, name)
        }
      } catch {
        // Ignore invalid initialModel URL
      }
    })()
    return () => {
      dead = true
    }
  }, [initialModel?.file, initialModel?.name, svgLongCm, svgHeightCm, addSceneObject])

  const handleFiles = async (fileList: FileList | File[]) => {
    for (const file of Array.from(fileList || [])) {
      const ext = file.name.split(".").pop()?.toLowerCase() || ""
      if (
        ![
          "stl",
          "3mf",
          "step",
          "stp",
          "svg",
          "adiv",
          "adivi",
          "json",
        ].includes(ext)
      ) {
        alert(`Unsupported format: ${file.name}`)
        continue
      }
      const buf = await file.arrayBuffer()

      if (ext === "adiv" || ext === "adivi" || ext === "json") {
        try {
          const restored = deserializeProjectPayload(
            JSON.parse(new TextDecoder().decode(buf))
          )
          setEditingGroupState(null)
          setGridSizeCm(restored.gridSizeCm)
          setGridStepCm(restored.gridStepCm)
          setPlateSizeText(String(restored.gridSizeCm))
          setPlateStepText(String(restored.gridStepCm))
          commitObjects(() => restored.objects)
          setSelectedIds(restored.objects[0] ? [restored.objects[0].id] : [])
        } catch (e: any) {
          alert(e?.message || "Failed to load .adiv project file")
        }
        continue
      }

      if (ext === "svg") {
        try {
          const an = analyzeSvg(new TextDecoder().decode(buf), file.name)
          const asp = an.spanY / an.spanX
          setSvgModal({
            an,
            dimX: fmt(asp <= 1 ? svgLongCm : svgLongCm / asp),
            dimY: fmt(asp <= 1 ? svgLongCm * asp : svgLongCm),
            dimZ: fmt(svgHeightCm),
            lockXY: true,
            splitByColor: true,
            layers: an.layers,
          })
        } catch (e: any) {
          alert(e?.message || "Failed to parse SVG")
        }
        continue
      }

      setLoadingText(`Loading ${file.name}...`)
      try {
        await new Promise((r) => setTimeout(r, 20))
        const geom =
          ext === "step" || ext === "stp"
            ? await parseStepToGeometry(buf)
            : ext === "3mf"
              ? await parse3mfToGeometry(buf)
              : new STLLoader().parse(buf)
        addSceneObject(geom, file.name)
      } catch (e: any) {
        alert(e?.message || `Error loading ${file.name}`)
      } finally {
        setLoadingText("")
      }
    }
  }

  const confirmSvgImport = () => {
    if (!svgModal) return
    const active = svgModal.layers.filter((l) => l.included)
    if (!active.length) return
    const b = svgModal.an.getBounds(active)
    const sx =
      Math.max(2, (parseFloat(svgModal.dimX) || svgLongCm) * 10) /
      Math.max(1e-3, b.maxX - b.minX)
    const sy =
      Math.max(2, (parseFloat(svgModal.dimY) || svgLongCm) * 10) /
      Math.max(1e-3, b.maxY - b.minY)
    const zMm = Math.max(0.5, (parseFloat(svgModal.dimZ) || svgHeightCm) * 10)
    const cleanSvgTitle = svgModal.an.fileName.replace(/\.svg$/i, "")

    if (!svgModal.splitByColor || active.length === 1) {
      addSceneObject(
        buildGeometryFromContours(
          active.flatMap((l) => l.contours),
          b.minX,
          b.minY,
          sx,
          sy,
          zMm
        ),
        cleanSvgTitle,
        active[0]?.color || defaultModelHex
      )
    } else {
      const children = active.map((l) => ({
        name: `${cleanSvgTitle} (${l.color})`,
        color: l.color,
        opacity: 1,
        isHole: false,
        visible: true,
        geometry: buildGeometryFromContours(
          l.contours,
          b.minX,
          b.minY,
          sx,
          sy,
          zMm
        ),
      }))
      const resultGeom = evaluateCsgGroup(children, [])
      resultGeom.computeBoundingBox()
      const bb = resultGeom.boundingBox!
      const cx = (bb.min.x + bb.max.x) / 2
      const cy = (bb.min.y + bb.max.y) / 2
      const minZ = bb.min.z
      resultGeom.translate(-cx, -cy, -minZ)
      resultGeom.computeBoundingBox()
      const b2 = resultGeom.boundingBox!

      const svgGroupObj: SceneObject = {
        id: uid("svg"),
        name: cleanSvgTitle,
        color: active[0]?.color || defaultModelHex,
        opacity: 1,
        isHole: false,
        isGroupMember: Boolean(editingGroupState),
        partCount: findConnectedComponents(resultGeom).length,
        groupChildren: children,
        groupOriginWorld: { cx, cy, minZ },
        visible: true,
        geometry: resultGeom,
        baseDim: {
          x: Math.max(0.01, (b2.max.x - b2.min.x) / 10),
          y: Math.max(0.01, (b2.max.y - b2.min.y) / 10),
          z: Math.max(0.01, (b2.max.z - b2.min.z) / 10),
        },
        scale: { sx: 1, sy: 1, sz: 1 },
        pos: { x: 0, y: 0, z: 0 },
        rot: { x: 0, y: 0, z: 0 },
      }
      commitObjects((prev) => [...prev, svgGroupObj], !editingGroupState)
      setSelectedIds([svgGroupObj.id])
    }
    setSvgModal(null)
  }

  const handleExportStl = () => {
    if (!sceneRef.current) return
    const hasSel = selectedIds.length > 0
    const pool = hasSel
      ? objects.filter((o) => selectedIds.includes(o.id) && !o.isHole)
      : objects.filter((o) => !o.isHole && o.visible && !o.isGhostContext)
    if (!pool.length) return

    if (pool.length === 1) {
      const mesh = sceneRef.current.meshMap.get(pool[0].id)
      if (!mesh) return
      mesh.updateMatrixWorld(true)
      downloadBlob(
        new Blob([new STLExporter().parse(mesh, { binary: true })], {
          type: "application/octet-stream",
        }),
        `${pool[0].name.replace(/\.[^/.]+$/, "")}.stl`
      )
    } else {
      const baked: THREE.BufferGeometry[] = []
      for (const t of pool) {
        const m = sceneRef.current.meshMap.get(t.id)
        if (!m) continue
        m.updateMatrixWorld(true)
        const g = t.geometry.clone()
        g.applyMatrix4(m.matrixWorld)
        baked.push(g)
      }
      downloadBlob(
        new Blob(
          [
            new STLExporter().parse(new THREE.Mesh(mergeBakedGeometries(baked)), {
              binary: true,
            }),
          ],
          { type: "application/octet-stream" }
        ),
        hasSel
          ? `${pool[0].name.replace(/\.[^/.]+$/, "")}_selected.stl`
          : "adivi_plate_all.stl"
      )
    }
  }

  const executeSnapshot = async () => {
    if (!sceneRef.current?.captureCustomSnapshot) return
    const blob = await sceneRef.current.captureCustomSnapshot({
      includeModel: snapIncludeModel,
      includePlate: snapIncludePlate,
      includeBg: snapIncludeBg,
    })
    setSnapshotModalOpen(false)
    if (!blob) return

    if (snapAction === "file") {
      downloadBlob(
        blob,
        `adivi_snapshot_${new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:T]/g, "-")}.png`
      )
      setCopiedShot(true)
      setTimeout(() => setCopiedShot(false), 1600)
    } else if (navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ])
      setCopiedShot(true)
      setTimeout(() => setCopiedShot(false), 1600)
    }
  }

  const applyPlateSettings = () => {
    const s = Math.max(
      5,
      Math.min(100, Math.round(parseFloat(plateSizeText) || 25))
    )
    const step = Math.max(
      1,
      Math.min(25, Math.round(parseFloat(plateStepText) || 5))
    )
    setGridSizeCm(s)
    setGridStepCm(step)
    setPlateSizeText(String(s))
    setPlateStepText(String(step))
    setPlateSettingsOpen(false)
  }

  const topOffset = 14
  const visibleListObjects = React.useMemo(
    () => objects.filter((o) => !o.isGhostContext),
    [objects]
  )
  const refTooltip = customRefModel
    ? `Scale Reference: ${customRefModel.name} (Right-click to replace)`
    : scaleRefModel?.file
      ? `Scale Reference: ${scaleRefModel.name || "Custom"} (${bananaCm} cm)`
      : `Scale Reference: Banana (${bananaCm} cm) — Right-click to import custom model`

  return (
    <div
      onClick={() => {
        setColorPopoverId(null)
        setContextMenu(null)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!isDragOver) setIsDragOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOver(false)
        if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files)
      }}
      style={{
        position: embedded ? "relative" : "fixed",
        inset: embedded ? undefined : 0,
        width: embedded ? "100%" : "100vw",
        height: embedded ? "100%" : "100dvh",
        backgroundColor: bgHex,
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#F8FAFC",
        overflow: "hidden",
        userSelect: "none",
        zIndex: embedded ? 1 : 9990,
        ...style,
      }}
    >
      <ViewportCanvas
        sceneRef={sceneRef}
        bgHex={bgHex}
        accent={accent}
        accentBorder={accentBorder}
        bananaCm={bananaCm}
        gridSizeCm={gridSizeCm}
        gridStepCm={gridStepCm}
        objects={objects}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        toolMode={toolMode}
        isOrtho={isOrtho}
        isTurntable={isTurntable}
        setIsTurntable={setIsTurntable}
        showGrid={showGrid}
        showScaleRef={showScaleRef}
        showWireframe={showWireframe}
        showEdgeHighlight={showEdgeHighlight}
        layOnFaceMode={layOnFaceMode}
        setLayOnFaceMode={setLayOnFaceMode}
        marqueeSelectMode={marqueeSelectMode}
        editingGroupState={editingGroupState}
        enterGroupIsolation={enterGroupIsolation}
        exitGroupIsolation={exitGroupIsolation}
        applyLayOnFace={applyLayOnFace}
        setPlateSettingsOpen={setPlateSettingsOpen}
        setContextMenu={setContextMenu}
        setMarqueeBox={setMarqueeBox}
        customRefModel={customRefModel}
        scaleRefModel={scaleRefModel}
        commitObjects={commitObjects}
        historyRef={historyRef}
        syncHistFlags={syncHistFlags}
        lengthUnit={lengthUnit}
        scaleUnit={scaleUnit}
      />

      {/* RIGHT-CLICK (PPM) CONTEXT MENU */}
      {contextMenu && (
        <ContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          glass={glass}
          rSm={rSm}
          accentBorder={accentBorder}
          ctxMenuItemStyle={ctxMenuItemStyle}
          editingGroupState={editingGroupState}
          selectedIds={selectedIds}
          selectedObj={selectedObj}
          canUngroupSelected={canUngroupSelected}
          canSplitSelected={canSplitSelected}
          handleGroupSelected={handleGroupSelected}
          handleUngroupSelected={handleUngroupSelected}
          handleSplitSelected={handleSplitSelected}
          duplicateSelected={duplicateSelected}
          handleDropToPlate={handleDropToPlate}
          handleCenterOnPlate={handleCenterOnPlate}
          patchSelected={patchSelected}
          requestDeleteObjects={requestDeleteObjects}
          setAddMenuOpen={setAddMenuOpen}
          onTriggerFileInput={() => fileInputRef.current?.click()}
        />
      )}

      {/* MARQUEE SELECTION RECTANGLE */}
      {marqueeBox && (marqueeBox.w > 4 || marqueeBox.h > 4) && (
        <div
          style={{
            position: "absolute",
            left: marqueeBox.x,
            top: marqueeBox.y,
            width: marqueeBox.w,
            height: marqueeBox.h,
            border: `1px solid ${accentBorder}`,
            backgroundColor: "rgba(20, 184, 166, 0.14)",
            pointerEvents: "none",
            zIndex: 20,
          }}
        />
      )}

      {/* GROUP ISOLATION BANNER */}
      {editingGroupState && (
        <div
          style={{
            ...glass,
            position: "absolute",
            bottom: 58,
            left: "50%",
            transform: "translateX(-50%)",
            borderColor: accentBorder,
            borderRadius: rSm,
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 18,
          }}
        >
          <span style={{ color: accentBorder }}>
            Editing Group: {editingGroupState.groupName}
          </span>
          <button
            type="button"
            onClick={() => exitGroupIsolation()}
            style={{
              height: 24,
              padding: "0 10px",
              borderRadius: 4,
              border: "none",
              background: accent,
              color: "#FFF",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Done (Esc)
          </button>
        </div>
      )}

      {/* LAY ON FACE PROMPT BANNER */}
      {layOnFaceMode && (
        <div
          style={{
            ...glass,
            position: "absolute",
            bottom: 58,
            left: "50%",
            transform: "translateX(-50%)",
            borderColor: accentBorder,
            borderRadius: rSm,
            padding: "7px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 18,
          }}
        >
          <span style={{ color: accentBorder }}>
            Tap or click any highlighted surface to lay it flat on the plate
          </span>
          <button
            type="button"
            onClick={() => setLayOnFaceMode(false)}
            style={{
              height: 24,
              padding: "0 9px",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "#CBD5E1",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ALL MODALS */}
      <EditorModals
        glass={glass}
        radius={radius}
        rSm={rSm}
        accent={accent}
        accentBorder={accentBorder}
        aboutModalOpen={aboutModalOpen}
        setAboutModalOpen={setAboutModalOpen}
        addMenuOpen={addMenuOpen}
        setAddMenuOpen={setAddMenuOpen}
        handleAddPrimitive={handleAddPrimitive}
        onTriggerSvgInput={() => svgInputRef.current?.click()}
        roundedBoxModalOpen={roundedBoxModalOpen}
        setRoundedBoxModalOpen={setRoundedBoxModalOpen}
        rbDimCm={rbDimCm}
        setRbDimCm={setRbDimCm}
        rbLockProp={rbLockProp}
        setRbLockProp={setRbLockProp}
        bevelRadiusMm={bevelRadiusMm}
        setBevelRadiusMm={setBevelRadiusMm}
        bevelMode={bevelMode}
        setBevelMode={setBevelMode}
        confirmAddRoundedBox={confirmAddRoundedBox}
        snapshotModalOpen={snapshotModalOpen}
        setSnapshotModalOpen={setSnapshotModalOpen}
        snapIncludeModel={snapIncludeModel}
        setSnapIncludeModel={setSnapIncludeModel}
        snapIncludePlate={snapIncludePlate}
        setSnapIncludePlate={setSnapIncludePlate}
        snapIncludeBg={snapIncludeBg}
        setSnapIncludeBg={setSnapIncludeBg}
        snapAction={snapAction}
        setSnapAction={setSnapAction}
        plateSettingsOpen={plateSettingsOpen}
        setPlateSettingsOpen={setPlateSettingsOpen}
        plateSizeText={plateSizeText}
        setPlateSizeText={setPlateSizeText}
        plateStepText={plateStepText}
        setPlateStepText={setPlateStepText}
        applyPlateSettings={applyPlateSettings}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        svgModal={svgModal}
        setSvgModal={setSvgModal}
        confirmSvgImport={confirmSvgImport}
      />

      {/* HIDDEN FILE INPUTS */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".stl,.STL,.3mf,.3MF,.step,.STEP,.stp,.STP,.svg,.SVG,.adiv,.ADIV,.adivi,.ADIVI,.json,.JSON"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files)
          e.target.value = ""
        }}
        style={{ display: "none" }}
      />
      <input
        ref={svgInputRef}
        type="file"
        accept=".svg,.SVG"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files)
          e.target.value = ""
        }}
        style={{ display: "none" }}
      />
      <input
        ref={refModelInputRef}
        type="file"
        accept=".stl,.STL,.3mf,.3MF,.step,.STEP,.stp,.STP"
        onChange={(e) => {
          if (e.target.files?.[0]) handleImportRefModel(e.target.files[0])
          e.target.value = ""
        }}
        style={{ display: "none" }}
      />

      {/* TOP CENTER: MOVE / ROTATE / SCALE + CONTEXTUAL TOOLS */}
      {selectedIds.length > 0 && (
        <TransformBar
          topOffset={topOffset}
          glass={glass}
          rSm={rSm}
          accent={accent}
          accentBorder={accentBorder}
          toolMode={toolMode}
          setToolMode={setToolMode}
          showDropButton={showDropButton}
          handleDropToPlate={handleDropToPlate}
          handleCenterOnPlate={handleCenterOnPlate}
          handleMirrorAxis={handleMirrorAxis}
          layOnFaceMode={layOnFaceMode}
          setLayOnFaceMode={setLayOnFaceMode}
          contextualBtnStyle={contextualBtnStyle}
        />
      )}

      {/* EMPTY SCENE DROP ZONE */}
      {objects.length === 0 && !loadingText && (
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            padding: "24px 30px",
            borderRadius: radius,
            border: `2px dashed ${isDragOver ? accentBorder : "rgba(255,255,255,0.28)"}`,
            backgroundColor: isDragOver
              ? "rgba(13, 148, 136, 0.24)"
              : "rgba(15, 23, 42, 0.76)",
            backdropFilter: "blur(6px)",
            textAlign: "center",
            cursor: "pointer",
            zIndex: 8,
            maxWidth: 360,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              padding: 10,
              borderRadius: rSm,
              backgroundColor: "rgba(13,148,136,0.2)",
              color: accentBorder,
              marginBottom: 8,
            }}
          >
            <Icon name="upload" size={22} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>
            {texts?.emptyTitle || "Drop 3D, SVG or .adiv project files"}
          </div>
          <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
            STL, 3MF, STEP, SVG, .adiv or click + to add shapes
          </div>
        </div>
      )}

      {isDragOver && (
        <div
          style={{
            position: "absolute",
            inset: 10,
            borderRadius: radius,
            border: `2px dashed ${accentBorder}`,
            backgroundColor: "rgba(13, 148, 136, 0.16)",
            pointerEvents: "none",
            zIndex: 35,
          }}
        />
      )}

      {/* TOP-LEFT PANEL: TOOLBAR + OBJECTS HIERARCHY */}
      <TopToolbar
        topOffset={topOffset}
        glass={glass}
        radius={radius}
        rSm={rSm}
        accent={accent}
        accentBorder={accentBorder}
        sqToolBtn={sqToolBtn}
        setAboutModalOpen={setAboutModalOpen}
        onTriggerFileInput={() => fileInputRef.current?.click()}
        importButtonLabel={texts?.importButtonLabel}
        addMenuOpen={addMenuOpen}
        setAddMenuOpen={setAddMenuOpen}
        marqueeSelectMode={marqueeSelectMode}
        setMarqueeSelectMode={setMarqueeSelectMode}
        editingGroupState={editingGroupState}
        exitGroupIsolation={exitGroupIsolation}
        histFlags={histFlags}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        visibleListObjects={visibleListObjects}
        objectsCollapsed={objectsCollapsed}
        setObjectsCollapsed={setObjectsCollapsed}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        handleGroupSelected={handleGroupSelected}
        canUngroupSelected={canUngroupSelected}
        handleUngroupSelected={handleUngroupSelected}
        canSplitSelected={canSplitSelected}
        handleSplitSelected={handleSplitSelected}
        selectedObj={selectedObj}
        objectsListHeight={objectsListHeight}
        setObjectsListHeight={setObjectsListHeight}
        collapsedGroups={collapsedGroups}
        setCollapsedGroups={setCollapsedGroups}
        enterGroupIsolation={enterGroupIsolation}
        colorPopoverId={colorPopoverId}
        setColorPopoverId={setColorPopoverId}
        renamingId={renamingId}
        setRenamingId={setRenamingId}
        renameText={renameText}
        setRenameText={setRenameText}
        patchObject={patchObject}
        moveObjectInList={moveObjectInList}
        requestDeleteObjects={requestDeleteObjects}
      />

      {/* TOP-RIGHT PANEL: ALIGN TOOL & TRANSFORM & MESH INSPECTOR */}
      {selectedObj && (
        <InspectorPanel
          topOffset={topOffset}
          glass={glass}
          radius={radius}
          rSm={rSm}
          accent={accent}
          accentBorder={accentBorder}
          selectedObj={selectedObj}
          selectedIds={selectedIds}
          selectedTriCount={selectedTriCount}
          inspectorCollapsed={inspectorCollapsed}
          setInspectorCollapsed={setInspectorCollapsed}
          handleAlignSelected={handleAlignSelected}
          isScaleModified={isScaleModified}
          isPosModified={isPosModified}
          isRotModified={isRotModified}
          onAcceptScale={handleAcceptScale}
          onAcceptPos={handleAcceptPos}
          onAcceptRot={handleAcceptRot}
          lengthUnit={lengthUnit}
          setLengthUnit={setLengthUnit}
          scaleUnit={scaleUnit}
          setScaleUnit={setScaleUnit}
          lockProp={lockProp}
          setLockProp={setLockProp}
          dimInputs={dimInputs}
          setDimInputs={setDimInputs}
          posInputs={posInputs}
          setPosInputs={setPosInputs}
          rotInputs={rotInputs}
          setRotInputs={setRotInputs}
          patchObject={patchObject}
          showWireframe={showWireframe}
          setShowWireframe={setShowWireframe}
          simplifyOpen={simplifyOpen}
          setSimplifyOpen={setSimplifyOpen}
          simplifyPercent={simplifyPercent}
          setSimplifyPercent={setSimplifyPercent}
          handleSimplifySelected={handleSimplifySelected}
        />
      )}

      {/* BOTTOM BAR */}
      <BottomBar
        glass={glass}
        rSm={rSm}
        accent={accent}
        accentBorder={accentBorder}
        subtleSqBtn={subtleSqBtn}
        isOrtho={isOrtho}
        setIsOrtho={setIsOrtho}
        showScaleRef={showScaleRef}
        setShowScaleRef={setShowScaleRef}
        refTooltip={refTooltip}
        onTriggerRefModelInput={() => refModelInputRef.current?.click()}
        showEdgeHighlight={showEdgeHighlight}
        setShowEdgeHighlight={setShowEdgeHighlight}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        sceneRef={sceneRef}
        isTurntable={isTurntable}
        setIsTurntable={setIsTurntable}
        primarySelectedId={primarySelectedId}
        snapAction={snapAction}
        executeSnapshot={executeSnapshot}
        copiedShot={copiedShot}
        setSnapshotModalOpen={setSnapshotModalOpen}
        objects={objects}
        handleSaveProjectFile={handleSaveProjectFile}
        savedBadge={savedBadge}
        handleExportStl={handleExportStl}
        selectedIds={selectedIds}
        exportButtonLabel={texts?.exportButtonLabel}
      />

      {loadingText && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(15,23,42,0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
            zIndex: 35,
          }}
        >
          {loadingText}
        </div>
      )}
    </div>
  )
}

export default Adivi3DModelViewer
