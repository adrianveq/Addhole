import * as React from "react"
import { DimUnit, SceneObject } from "../types/editor"
import { fmt } from "../utils/format"
import {
  SNAP_CM_STEP,
  SNAP_ROTATION_DEG_STEP,
  snapCm,
  snapRotationDeg,
} from "../utils/transformSnap"
import { inp, lbl, neutralChipBtn } from "../styles/uiStyles"
import { getTransformHome } from "../utils/transformHome"
import { Icon } from "./Icon"

const axisInk = (ax: "x" | "y" | "z") =>
  ax === "x" ? "#EB9090" : ax === "y" ? "#78D896" : "#84B4F8"

const RESET_ORANGE = "#F6C09A"
const ACCEPT_GREEN = "#9DD9B4"

const sectionHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  height: 16,
  minHeight: 16,
}

const sectionTitle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: "#94A3B8",
  lineHeight: "16px",
}

/** Same height as the section title so these controls never grow the panel. */
const miniChip = (active = false): React.CSSProperties => ({
  ...neutralChipBtn(active),
  height: 16,
  minWidth: 16,
  padding: 0,
  borderRadius: 4,
  flexShrink: 0,
})

function TransformSectionActions({
  modified,
  acceptTitle,
  onAccept,
  resetTitle,
  onReset,
  children,
}: {
  modified: boolean
  acceptTitle: string
  onAccept: () => void
  resetTitle: string
  onReset: () => void
  children?: React.ReactNode
}) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {modified && (
        <>
          <button
            type="button"
            title={acceptTitle}
            onClick={onAccept}
            style={{ ...miniChip(false), color: ACCEPT_GREEN }}
          >
            <Icon name="check" size={10} />
          </button>
          <button
            type="button"
            title={resetTitle}
            onClick={onReset}
            style={{ ...miniChip(false), color: RESET_ORANGE }}
          >
            <Icon name="reset" size={10} />
          </button>
        </>
      )}
      {children}
    </div>
  )
}

export function InspectorPanel({
  topOffset,
  glass,
  radius,
  rSm,
  accent,
  accentBorder,
  selectedObj,
  selectedIds,
  selectedTriCount,
  inspectorCollapsed,
  setInspectorCollapsed,
  handleAlignSelected,
  isScaleModified,
  isPosModified,
  isRotModified,
  onAcceptScale,
  onAcceptPos,
  onAcceptRot,
  dimUnit,
  setDimUnit,
  lockProp,
  setLockProp,
  dimInputs,
  setDimInputs,
  posInputs,
  setPosInputs,
  rotInputs,
  setRotInputs,
  patchObject,
  showWireframe,
  setShowWireframe,
  simplifyOpen,
  setSimplifyOpen,
  simplifyPercent,
  setSimplifyPercent,
  handleSimplifySelected,
}: {
  topOffset: number
  glass: React.CSSProperties
  radius: number
  rSm: number
  accent: string
  accentBorder: string
  selectedObj: SceneObject
  selectedIds: string[]
  selectedTriCount: number
  inspectorCollapsed: boolean
  setInspectorCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  handleAlignSelected: (axis: "x" | "y" | "z", mode: "min" | "center" | "max") => void
  isScaleModified: boolean
  isPosModified: boolean
  isRotModified: boolean
  onAcceptScale: () => void
  onAcceptPos: () => void
  onAcceptRot: () => void
  dimUnit: DimUnit
  setDimUnit: React.Dispatch<React.SetStateAction<DimUnit>>
  lockProp: boolean
  setLockProp: React.Dispatch<React.SetStateAction<boolean>>
  dimInputs: { x: string; y: string; z: string }
  setDimInputs: React.Dispatch<React.SetStateAction<{ x: string; y: string; z: string }>>
  posInputs: { x: string; y: string; z: string }
  setPosInputs: React.Dispatch<React.SetStateAction<{ x: string; y: string; z: string }>>
  rotInputs: { x: string; y: string; z: string }
  setRotInputs: React.Dispatch<React.SetStateAction<{ x: string; y: string; z: string }>>
  patchObject: (id: string, fn: (o: SceneObject) => SceneObject, recordHistory?: boolean) => void
  showWireframe: boolean
  setShowWireframe: React.Dispatch<React.SetStateAction<boolean>>
  simplifyOpen: boolean
  setSimplifyOpen: React.Dispatch<React.SetStateAction<boolean>>
  simplifyPercent: number
  setSimplifyPercent: React.Dispatch<React.SetStateAction<number>>
  handleSimplifySelected: () => void
}) {
  const commitScaleAxis = (
    ax: "x" | "y" | "z",
    raw: string,
    fine: boolean
  ) => {
    const num = parseFloat(raw.replace(",", "."))
    if (!Number.isFinite(num) || num <= 0) return
    const k = `s${ax}` as "sx" | "sy" | "sz"
    const sizeCm =
      dimUnit === "%"
        ? (num / 100) * selectedObj.baseDim[ax]
        : num
    const snappedCm = fine ? sizeCm : snapCm(sizeCm)
    const s = snappedCm / selectedObj.baseDim[ax]
    if (lockProp) {
      setDimInputs(
        dimUnit === "%"
          ? { x: fmt(s * 100), y: fmt(s * 100), z: fmt(s * 100) }
          : {
              x: fmt(selectedObj.baseDim.x * s),
              y: fmt(selectedObj.baseDim.y * s),
              z: fmt(selectedObj.baseDim.z * s),
            }
      )
      patchObject(selectedObj.id, (o) => ({
        ...o,
        scale: { sx: s, sy: s, sz: s },
      }))
    } else {
      setDimInputs((p) => ({
        ...p,
        [ax]:
          dimUnit === "%"
            ? fmt(s * 100)
            : fmt(selectedObj.baseDim[ax] * s),
      }))
      patchObject(selectedObj.id, (o) => ({
        ...o,
        scale: { ...o.scale, [k]: s },
      }))
    }
  }

  const commitPosAxis = (ax: "x" | "y" | "z", raw: string, fine: boolean) => {
    const num = parseFloat(raw.replace(",", "."))
    if (!Number.isFinite(num)) return
    const v = fine ? num : snapCm(num)
    setPosInputs((p) => ({ ...p, [ax]: fmt(v) }))
    patchObject(selectedObj.id, (o) => ({
      ...o,
      pos: { ...o.pos, [ax]: v },
    }))
  }

  const commitRotAxis = (ax: "x" | "y" | "z", raw: string, fine: boolean) => {
    const num = parseFloat(raw.replace(",", "."))
    if (!Number.isFinite(num)) return
    const v = fine ? num : snapRotationDeg(num)
    setRotInputs((p) => ({ ...p, [ax]: fmt(v) }))
    patchObject(selectedObj.id, (o) => ({
      ...o,
      rot: { ...o.rot, [ax]: v },
    }))
  }

  return (
    <div
      style={{
        ...glass,
        position: "absolute",
        top: topOffset,
        right: 14,
        width: 256,
        maxWidth: "calc(100vw - 28px)",
        borderRadius: radius,
        padding: 11,
        display: "flex",
        flexDirection: "column",
        gap: inspectorCollapsed ? 0 : 10,
        zIndex: 13,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => setInspectorCollapsed((v) => !v)}
          style={{
            background: "none",
            border: "none",
            color: "#CBD5E1",
            fontSize: 12.5,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: 0,
            cursor: "pointer",
          }}
        >
          <Icon
            name={inspectorCollapsed ? "chevron-right" : "chevron-down"}
            size={14}
          />
          <span>
            {selectedIds.length > 1
              ? `Align & Transform (${selectedIds.length})`
              : "Mesh"}
          </span>
        </button>
        {!inspectorCollapsed && (
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            <button
              type="button"
              title="Switch cm / %"
              onClick={() => setDimUnit((u) => (u === "cm" ? "%" : "cm"))}
              style={{
                ...miniChip(false),
                width: 22,
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {dimUnit}
            </button>
            <button
              type="button"
              title="Lock Proportions"
              onClick={() => setLockProp((v) => !v)}
              style={miniChip(lockProp)}
            >
              <Icon name={lockProp ? "lock" : "unlock"} size={10} />
            </button>
          </div>
        )}
      </div>

      {!inspectorCollapsed && (
        <>
          {selectedIds.length >= 2 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                paddingBottom: 10,
                borderBottom: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#94A3B8" }}>
                Align Selection
              </span>
              {(["x", "y", "z"] as const).map((ax) => (
                <div
                  key={ax}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px repeat(3, 1fr)",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: axisInk(ax),
                      textTransform: "uppercase",
                    }}
                  >
                    {ax}
                  </span>
                  {(["min", "center", "max"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      title={`Align ${ax.toUpperCase()} ${mode}`}
                      onClick={() => handleAlignSelected(ax, mode)}
                      style={{
                        height: 26,
                        borderRadius: Math.min(4, rSm),
                        border: "1px solid rgba(255,255,255,0.14)",
                        backgroundColor: "rgba(255,255,255,0.06)",
                        color: "#E2E8F0",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <Icon
                        name={`align-${ax}-${mode}`}
                        size={16}
                        accent={accentBorder}
                      />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* SCALE SECTION */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={sectionHead}>
              <span style={sectionTitle}>Scale</span>
              <TransformSectionActions
                modified={isScaleModified}
                acceptTitle="Accept scale as default"
                onAccept={onAcceptScale}
                resetTitle="Reset Scale"
                onReset={() =>
                  patchObject(selectedObj.id, (o) => {
                    const home = getTransformHome(o).scale
                    return { ...o, scale: { ...home } }
                  })
                }
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
              }}
            >
              {(["x", "y", "z"] as const).map((ax) => (
                <label key={ax} style={lbl}>
                  <span>
                    <span style={{ color: axisInk(ax) }}>{ax.toUpperCase()}</span> ({dimUnit})
                  </span>
                  <input
                    className="adivi-num-input"
                    type="number"
                    step={dimUnit === "%" ? "0.5" : SNAP_CM_STEP}
                    value={dimInputs[ax]}
                    onChange={(e) => {
                      const raw = e.target.value
                      const num = parseFloat(raw)
                      if (!lockProp || isNaN(num) || num <= 0) {
                        setDimInputs((p) => ({ ...p, [ax]: raw }))
                        if (!isNaN(num) && num > 0) {
                          const k = `s${ax}` as "sx" | "sy" | "sz"
                          const s =
                            dimUnit === "%"
                              ? num / 100
                              : num / selectedObj.baseDim[ax]
                          patchObject(
                            selectedObj.id,
                            (o) => ({
                              ...o,
                              scale: { ...o.scale, [k]: s },
                            }),
                            false
                          )
                        }
                      } else {
                        const s =
                          dimUnit === "%"
                            ? num / 100
                            : num / selectedObj.baseDim[ax]
                        setDimInputs(
                          dimUnit === "%"
                            ? {
                                x: ax === "x" ? raw : fmt(s * 100),
                                y: ax === "y" ? raw : fmt(s * 100),
                                z: ax === "z" ? raw : fmt(s * 100),
                              }
                            : {
                                x:
                                  ax === "x"
                                    ? raw
                                    : fmt(selectedObj.baseDim.x * s),
                                y:
                                  ax === "y"
                                    ? raw
                                    : fmt(selectedObj.baseDim.y * s),
                                z:
                                  ax === "z"
                                    ? raw
                                    : fmt(selectedObj.baseDim.z * s),
                              }
                        )
                        patchObject(
                          selectedObj.id,
                          (o) => ({
                            ...o,
                            scale: { sx: s, sy: s, sz: s },
                          }),
                          false
                        )
                      }
                    }}
                    onBlur={(e) => commitScaleAxis(ax, e.currentTarget.value, false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        commitScaleAxis(
                          ax,
                          e.currentTarget.value,
                          e.altKey || e.ctrlKey
                        )
                        e.currentTarget.blur()
                      }
                    }}
                    style={inp}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* POSITION SECTION */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div style={sectionHead}>
              <span style={sectionTitle}>Position</span>
              <TransformSectionActions
                modified={isPosModified}
                acceptTitle="Accept position as default"
                onAccept={onAcceptPos}
                resetTitle="Reset Position"
                onReset={() =>
                  patchObject(selectedObj.id, (o) => ({
                    ...o,
                    pos: { ...getTransformHome(o).pos },
                  }))
                }
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
              }}
            >
              {(["x", "y", "z"] as const).map((ax) => (
                <label key={ax} style={lbl}>
                  <span>
                    <span style={{ color: axisInk(ax) }}>{ax.toUpperCase()}</span> (cm)
                  </span>
                  <input
                    className="adivi-num-input"
                    type="number"
                    step={SNAP_CM_STEP}
                    value={posInputs[ax]}
                    onChange={(e) => {
                      const raw = e.target.value
                      const num = parseFloat(raw)
                      setPosInputs((p) => ({ ...p, [ax]: raw }))
                      if (!isNaN(num)) {
                        patchObject(
                          selectedObj.id,
                          (o) => ({
                            ...o,
                            pos: { ...o.pos, [ax]: num },
                          }),
                          false
                        )
                      }
                    }}
                    onBlur={(e) => commitPosAxis(ax, e.currentTarget.value, false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        commitPosAxis(
                          ax,
                          e.currentTarget.value,
                          e.altKey || e.ctrlKey
                        )
                        e.currentTarget.blur()
                      }
                    }}
                    style={inp}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* ROTATION SECTION */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div style={sectionHead}>
              <span style={sectionTitle}>Rotation</span>
              <TransformSectionActions
                modified={isRotModified}
                acceptTitle="Accept rotation as default"
                onAccept={onAcceptRot}
                resetTitle="Reset Rotation"
                onReset={() =>
                  patchObject(selectedObj.id, (o) => ({
                    ...o,
                    rot: { ...getTransformHome(o).rot },
                  }))
                }
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
              }}
            >
              {(["x", "y", "z"] as const).map((ax) => (
                <label key={ax} style={lbl}>
                  <span>
                    <span style={{ color: axisInk(ax) }}>{ax.toUpperCase()}</span> (°)
                  </span>
                  <input
                    className="adivi-num-input"
                    type="number"
                    step={SNAP_ROTATION_DEG_STEP}
                    value={rotInputs[ax]}
                    onChange={(e) => {
                      const raw = e.target.value
                      const num = parseFloat(raw)
                      setRotInputs((p) => ({ ...p, [ax]: raw }))
                      if (!isNaN(num)) {
                        patchObject(
                          selectedObj.id,
                          (o) => ({
                            ...o,
                            rot: { ...o.rot, [ax]: num },
                          }),
                          false
                        )
                      }
                    }}
                    onBlur={(e) => commitRotAxis(ax, e.currentTarget.value, false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        commitRotAxis(
                          ax,
                          e.currentTarget.value,
                          e.altKey || e.ctrlKey
                        )
                        e.currentTarget.blur()
                      }
                    }}
                    style={inp}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* WIREFRAME & SIMPLIFY MESH TOOLS */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "26px 1fr 1fr",
                gap: 6,
                alignItems: "stretch",
              }}
            >
              <button
                type="button"
                title="Show mesh wireframe overlay on the selected object"
                onClick={() => setShowWireframe((v) => !v)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: Math.min(5, rSm),
                  border: `1px solid ${showWireframe ? accentBorder : "rgba(255,255,255,0.14)"}`,
                  backgroundColor: showWireframe
                    ? accent
                    : "rgba(255,255,255,0.06)",
                  color: "#FFF",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <Icon name="wireframe" size={12} />
              </button>
              <button
                type="button"
                onClick={() => setSimplifyOpen((v) => !v)}
                style={{
                  height: 26,
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  borderRadius: Math.min(5, rSm),
                  border: `1px solid ${simplifyOpen ? accentBorder : "rgba(255,255,255,0.14)"}`,
                  backgroundColor: simplifyOpen
                    ? accent
                    : "rgba(255,255,255,0.06)",
                  color: "#FFF",
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  cursor: "pointer",
                }}
              >
                <Icon name="simplify" size={13} />
                <span>Simplify</span>
              </button>
              <span
                title={`${selectedTriCount.toLocaleString()} triangles — finer detail and larger files when this count is higher`}
                style={{
                  height: 26,
                  minWidth: 0,
                  boxSizing: "border-box",
                  borderRadius: Math.min(5, rSm),
                  border: "1px solid rgba(255,255,255,0.14)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  fontSize: 11.5,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: accentBorder,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  cursor: "help",
                }}
              >
                {selectedTriCount.toLocaleString()}
              </span>
            </div>

            {simplifyOpen && (
              <div
                style={{
                  padding: 8,
                  borderRadius: Math.min(5, rSm),
                  backgroundColor: "rgba(2, 6, 23, 0.55)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11.5,
                    color: "#CBD5E1",
                  }}
                >
                  <span>Reduce Triangles</span>
                  <strong style={{ color: accentBorder }}>{simplifyPercent}%</strong>
                </div>
                <input
                  type="range"
                  min={10}
                  max={85}
                  step={5}
                  value={simplifyPercent}
                  onChange={(e) => setSimplifyPercent(Number(e.target.value))}
                  style={{ width: "100%", accentColor: accent, cursor: "pointer" }}
                />
                <button
                  type="button"
                  onClick={handleSimplifySelected}
                  style={{
                    height: 26,
                    borderRadius: 4,
                    border: "none",
                    backgroundColor: accent,
                    color: "#FFF",
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Apply Decimation
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
