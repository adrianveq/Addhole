import * as THREE from "three"
import * as React from "react"

export type ToolMode = "transform" | "move" | "rotate" | "scale"
export type LengthUnit = "cm" | "mm"
export type ScaleDimUnit = LengthUnit | "%"
/** Scale can use %; position and mesh size use {@link LengthUnit}. */
export type DimUnit = ScaleDimUnit
export type BevelMode = "fillet" | "chamfer"
export type SnapAction = "clipboard" | "file"

export type PrimitiveKind =
  | "box"
  | "roundedBox"
  | "cylinder"
  | "sphere"
  | "hemisphere"
  | "cone"
  | "pyramid"
  | "prism"
  | "torus"
  | "tube"
  | "wedge"
  | "arch"

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Scale3 {
  sx: number
  sy: number
  sz: number
}

/** Reset targets after “accept as default”; defaults to identity when unset. */
export interface TransformHome {
  scale: Scale3
  pos: Vec3
  rot: Vec3
}

export interface GroupChild {
  name: string
  color: string
  opacity?: number
  isHole: boolean
  visible?: boolean
  geometry: THREE.BufferGeometry
}

export interface SceneObject {
  id: string
  name: string
  color: string
  opacity?: number
  isHole: boolean
  partCount: number
  visible: boolean
  geometry: THREE.BufferGeometry
  baseDim: Vec3
  scale: Scale3
  pos: Vec3
  rot: Vec3
  transformHome?: TransformHome
  isGroupMember?: boolean
  isGhostContext?: boolean
  groupChildren?: GroupChild[]
  groupOriginWorld?: { cx: number; cy: number; minZ: number }
}

export interface EditingGroupState {
  groupId: string
  groupName: string
  children: SceneObject[]
  otherObjects: SceneObject[]
}

/** One undo step: objects plus whether a group is open for editing. */
export interface EditorSnapshot {
  objects: SceneObject[]
  editingGroup: EditingGroupState | null
  selectedIds: string[]
}

export interface SvgLayerInfo {
  id: string
  name: string
  color: string
  isBg: boolean
  included: boolean
  contours: THREE.Vector2[][]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
}

export interface SvgAnalysis {
  fileName: string
  vb: string
  layers: SvgLayerInfo[]
  getBounds: (active: SvgLayerInfo[]) => {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }
  spanX: number
  spanY: number
}

export interface SvgModalState {
  an: SvgAnalysis
  dimX: string
  dimY: string
  dimZ: string
  lockXY: boolean
  splitByColor: boolean
  layers: SvgLayerInfo[]
}

export interface ConfirmDialogState {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
}

export interface AdiviEditorProps {
  colors?: {
    accentColor?: string
    accentBorder?: string
    bgColor?: string
    modelColor?: string
    borderRadius?: number
  }
  initialModel?: {
    file?: string
    name?: string
  }
  scaleRefModel?: {
    file?: string
    name?: string
  }
  svgDefaults?: {
    longestSideCm?: number
    heightCm?: number
  }
  viewerDefaults?: {
    gridSizeCm?: number
    bananaLengthCm?: number
    showGrid?: boolean
    showBanana?: boolean
    autoRotate?: boolean
  }
  texts?: {
    importButtonLabel?: string
    exportButtonLabel?: string
    emptyTitle?: string
  }
  embedded?: boolean
  style?: React.CSSProperties
}

export interface SceneControllerHandle {
  scene: THREE.Scene
  renderer: THREE.WebGLRenderer
  meshMap: Map<string, THREE.Mesh>
  selectedIds: string[]
  toolMode: ToolMode
  latestObjects: SceneObject[]
  isTurntable: boolean
  showScaleRef?: boolean
  layOnFaceMode: boolean
  marqueeSelectMode: boolean
  isEditingGroup: boolean
  enterGroupIsolation: (groupId: string, initialChildIndex?: number) => void
  exitGroupIsolation: () => void
  applyLayOnFace: (id: string, normal: THREE.Vector3) => void
  captureCustomSnapshot: (opts: {
    includeModel: boolean
    includePlate: boolean
    includeBg: boolean
  }) => Promise<Blob | null>
  setOrthoMode: (ortho: boolean) => void
  focusObject: (id: string | null) => void
  setViewPreset: (x: number, y: number, z: number) => void
}
