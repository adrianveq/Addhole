import * as React from "react"
import { SceneControllerHandle, SnapAction, SceneObject } from "../types/editor"
import { Icon } from "./Icon"

export function BottomBar({
  glass,
  rSm,
  accent,
  accentBorder,
  subtleSqBtn,
  isOrtho,
  setIsOrtho,
  showScaleRef,
  setShowScaleRef,
  refTooltip,
  onTriggerRefModelInput,
  showEdgeHighlight,
  setShowEdgeHighlight,
  showGrid,
  setShowGrid,
  sceneRef,
  isTurntable,
  setIsTurntable,
  primarySelectedId,
  snapAction,
  executeSnapshot,
  copiedShot,
  setSnapshotModalOpen,
  objects,
  handleSaveProjectFile,
  savedBadge,
  handleExportStl,
  selectedIds,
  exportButtonLabel,
}: {
  glass: React.CSSProperties
  rSm: number
  accent: string
  accentBorder: string
  subtleSqBtn: (active?: boolean) => React.CSSProperties
  isOrtho: boolean
  setIsOrtho: React.Dispatch<React.SetStateAction<boolean>>
  showScaleRef: boolean
  setShowScaleRef: React.Dispatch<React.SetStateAction<boolean>>
  refTooltip: string
  onTriggerRefModelInput: () => void
  showEdgeHighlight: boolean
  setShowEdgeHighlight: React.Dispatch<React.SetStateAction<boolean>>
  showGrid: boolean
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>
  sceneRef: React.MutableRefObject<SceneControllerHandle | null>
  isTurntable: boolean
  setIsTurntable: React.Dispatch<React.SetStateAction<boolean>>
  primarySelectedId: string | null
  snapAction: SnapAction
  executeSnapshot: () => void
  copiedShot: boolean
  setSnapshotModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  objects: SceneObject[]
  handleSaveProjectFile: () => void
  savedBadge: boolean
  handleExportStl: () => void
  selectedIds: string[]
  exportButtonLabel?: string
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
        left: 14,
        right: 14,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 8,
        zIndex: 12,
        pointerEvents: "none",
      }}
    >
      {/* BOTTOM-LEFT: 4 SUBTLE DISPLAY TOGGLES ABOVE CAMERA VIEWS */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 6,
          pointerEvents: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <button
            type="button"
            title={
              isOrtho
                ? "Projection: Orthographic (switch to Perspective)"
                : "Projection: Perspective (switch to Orthographic)"
            }
            onClick={() => setIsOrtho((v) => !v)}
            style={subtleSqBtn(isOrtho)}
          >
            <Icon name={isOrtho ? "ortho" : "persp"} size={14} />
          </button>

          <button
            type="button"
            title={refTooltip}
            onClick={() => setShowScaleRef((v) => !v)}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onTriggerRefModelInput()
            }}
            style={subtleSqBtn(showScaleRef)}
          >
            <Icon name="banana" size={14} />
          </button>

          <button
            type="button"
            title="Toggle Model Edge Lines"
            onClick={() => setShowEdgeHighlight((v) => !v)}
            style={subtleSqBtn(showEdgeHighlight)}
          >
            <Icon name="edgeGlow" size={14} />
          </button>

          <button
            type="button"
            title="Toggle Build Plate Grid"
            onClick={() => setShowGrid((v) => !v)}
            style={subtleSqBtn(showGrid)}
          >
            <Icon name="grid" size={14} />
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {[
            { l: "Front", p: [0, -1, 0] },
            { l: "Left", p: [-1, 0, 0] },
            { l: "Right", p: [1, 0, 0] },
            { l: "Top", p: [0, -0.001, 1] },
          ].map((v) => (
            <button
              key={v.l}
              type="button"
              onClick={() =>
                sceneRef.current?.setViewPreset(v.p[0], v.p[1], v.p[2])
              }
              style={{
                ...glass,
                height: 30,
                padding: "0 9px",
                borderRadius: rSm,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {v.l}
            </button>
          ))}

          <button
            type="button"
            title="360° Turntable"
            onClick={() => setIsTurntable((v) => !v)}
            style={{
              ...glass,
              height: 30,
              padding: "0 9px",
              borderRadius: rSm,
              backgroundColor: isTurntable
                ? "rgba(255,255,255,0.12)"
                : glass.backgroundColor,
              borderColor: isTurntable
                ? "rgba(255,255,255,0.34)"
                : "rgba(255,255,255,0.16)",
              fontSize: 12,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              cursor: "pointer",
            }}
          >
            <Icon name="turntable" size={13} />
            <span>360°</span>
          </button>

          <button
            type="button"
            title="Focus on selected object (F)"
            onClick={() => sceneRef.current?.focusObject(primarySelectedId)}
            style={{
              ...glass,
              width: 30,
              height: 30,
              padding: 0,
              borderRadius: rSm,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Icon name="focus" size={14} />
          </button>
        </div>
      </div>

      {/* BOTTOM-RIGHT: SNAPSHOT + SAVE .ADIV + EXPORT STL */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            ...glass,
            height: 32,
            borderRadius: rSm,
            display: "inline-flex",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            title={
              snapAction === "clipboard"
                ? "Snapshot to Clipboard"
                : "Save Snapshot PNG"
            }
            onClick={executeSnapshot}
            style={{
              height: "100%",
              padding: "0 10px",
              border: "none",
              background: "transparent",
              color: "#F8FAFC",
              fontSize: 12.5,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              cursor: "pointer",
            }}
          >
            <Icon name="camera" size={14} />
            <span>{copiedShot ? "Done!" : "Snapshot"}</span>
          </button>
          <button
            type="button"
            title="Snapshot Settings"
            onClick={() => setSnapshotModalOpen(true)}
            style={{
              width: 26,
              height: "100%",
              border: "none",
              borderLeft: "1px solid rgba(255,255,255,0.14)",
              background: "transparent",
              color: "#94A3B8",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <Icon name="gear" size={13} />
          </button>
        </div>

        <button
          type="button"
          title="Save editable project (.adiv)"
          disabled={objects.length === 0}
          onClick={handleSaveProjectFile}
          style={{
            ...glass,
            height: 32,
            padding: "0 11px",
            borderRadius: rSm,
            fontSize: 12.5,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            cursor: objects.length ? "pointer" : "not-allowed",
            opacity: objects.length ? 1 : 0.45,
          }}
        >
          <Icon name="save" size={14} />
          <span>{savedBadge ? "Saved!" : "Save"}</span>
        </button>

        <button
          type="button"
          title="Export binary STL"
          disabled={objects.length === 0}
          onClick={handleExportStl}
          style={{
            ...glass,
            height: 32,
            padding: "0 12px",
            borderRadius: rSm,
            backgroundColor: objects.length ? accent : glass.backgroundColor,
            borderColor: objects.length
              ? accentBorder
              : "rgba(255,255,255,0.16)",
            fontWeight: 700,
            fontSize: 12.5,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            cursor: objects.length ? "pointer" : "not-allowed",
            opacity: objects.length ? 1 : 0.45,
          }}
        >
          <Icon name="download" size={14} />
          <span>
            {selectedIds.length > 0
              ? "Export Selected STL"
              : exportButtonLabel || "Export STL"}
          </span>
        </button>
      </div>
    </div>
  )
}
