import * as React from "react"
import { APP_VERSION } from "../constants/editorConfig"
import {
  BevelMode,
  ConfirmDialogState,
  PrimitiveKind,
  SnapAction,
  SvgModalState,
} from "../types/editor"
import { fmt } from "../utils/format"
import { iconBtn, inp, lbl, modalBackdrop, neutralChipBtn } from "../styles/uiStyles"
import { Icon } from "./Icon"
import { RoundedBox3DPreview } from "./RoundedBox3DPreview"

export function EditorModals({
  glass,
  radius,
  rSm,
  accent,
  accentBorder,
  aboutModalOpen,
  setAboutModalOpen,
  addMenuOpen,
  setAddMenuOpen,
  handleAddPrimitive,
  onTriggerSvgInput,
  roundedBoxModalOpen,
  setRoundedBoxModalOpen,
  rbDimCm,
  setRbDimCm,
  rbLockProp,
  setRbLockProp,
  bevelRadiusMm,
  setBevelRadiusMm,
  bevelMode,
  setBevelMode,
  confirmAddRoundedBox,
  snapshotModalOpen,
  setSnapshotModalOpen,
  snapIncludeModel,
  setSnapIncludeModel,
  snapIncludePlate,
  setSnapIncludePlate,
  snapIncludeBg,
  setSnapIncludeBg,
  snapAction,
  setSnapAction,
  plateSettingsOpen,
  setPlateSettingsOpen,
  plateSizeText,
  setPlateSizeText,
  plateStepText,
  setPlateStepText,
  applyPlateSettings,
  confirmDialog,
  setConfirmDialog,
  svgModal,
  setSvgModal,
  confirmSvgImport,
}: {
  glass: React.CSSProperties
  radius: number
  rSm: number
  accent: string
  accentBorder: string
  aboutModalOpen: boolean
  setAboutModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  addMenuOpen: boolean
  setAddMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  handleAddPrimitive: (kind: PrimitiveKind, label: string) => void
  onTriggerSvgInput: () => void
  roundedBoxModalOpen: boolean
  setRoundedBoxModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  rbDimCm: { x: string; y: string; z: string }
  setRbDimCm: React.Dispatch<React.SetStateAction<{ x: string; y: string; z: string }>>
  rbLockProp: boolean
  setRbLockProp: React.Dispatch<React.SetStateAction<boolean>>
  bevelRadiusMm: number
  setBevelRadiusMm: React.Dispatch<React.SetStateAction<number>>
  bevelMode: BevelMode
  setBevelMode: React.Dispatch<React.SetStateAction<BevelMode>>
  confirmAddRoundedBox: () => void
  snapshotModalOpen: boolean
  setSnapshotModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  snapIncludeModel: boolean
  setSnapIncludeModel: React.Dispatch<React.SetStateAction<boolean>>
  snapIncludePlate: boolean
  setSnapIncludePlate: React.Dispatch<React.SetStateAction<boolean>>
  snapIncludeBg: boolean
  setSnapIncludeBg: React.Dispatch<React.SetStateAction<boolean>>
  snapAction: SnapAction
  setSnapAction: React.Dispatch<React.SetStateAction<SnapAction>>
  plateSettingsOpen: boolean
  setPlateSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>
  plateSizeText: string
  setPlateSizeText: React.Dispatch<React.SetStateAction<string>>
  plateStepText: string
  setPlateStepText: React.Dispatch<React.SetStateAction<string>>
  applyPlateSettings: () => void
  confirmDialog: ConfirmDialogState | null
  setConfirmDialog: React.Dispatch<React.SetStateAction<ConfirmDialogState | null>>
  svgModal: SvgModalState | null
  setSvgModal: React.Dispatch<React.SetStateAction<SvgModalState | null>>
  confirmSvgImport: () => void
}) {
  return (
    <>
      {/* ABOUT MODAL */}
      {aboutModalOpen && (
        <div onClick={() => setAboutModalOpen(false)} style={modalBackdrop}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...glass,
              width: "100%",
              maxWidth: 360,
              borderRadius: radius,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: rSm,
                    backgroundColor: "rgba(13,148,136,0.2)",
                    border: `1px solid ${accentBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="brand" size={20} accent={accentBorder} />
                </div>
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 800 }}>
                    ADIVI 3D Studio
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: accentBorder,
                      fontWeight: 700,
                    }}
                  >
                    {APP_VERSION}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAboutModalOpen(false)}
                style={iconBtn("#94A3B8")}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#CBD5E1",
                lineHeight: 1.55,
              }}
            >
              Lightweight browser CAD &amp; 3D print preparation studio with
              boolean CSG operations, multi-color SVG extrusion, and binary STL
              export.
            </p>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: rSm,
                backgroundColor: "rgba(2,6,23,0.55)",
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 12.5,
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              <div style={{ color: "#94A3B8", fontSize: 11.5 }}>Created by</div>
              <div style={{ fontWeight: 700, color: "#F8FAFC" }}>
                Adrian Fałkowski — ADIVI Studio
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setAboutModalOpen(false)}
                style={{
                  height: 32,
                  padding: "0 16px",
                  borderRadius: rSm,
                  border: "none",
                  background: accent,
                  color: "#FFF",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SHAPE & SVG MODAL */}
      {addMenuOpen && (
        <div onClick={() => setAddMenuOpen(false)} style={modalBackdrop}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...glass,
              width: "100%",
              maxWidth: 430,
              borderRadius: radius,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ fontSize: 15.5 }}>Add Shape or SVG</strong>
              <button
                type="button"
                onClick={() => setAddMenuOpen(false)}
                style={iconBtn("#94A3B8")}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
              }}
            >
              {[
                { k: "box" as const, l: "Box" },
                { k: "cylinder" as const, l: "Cylinder" },
                { k: "sphere" as const, l: "Sphere" },
                { k: "hemisphere" as const, l: "Dome" },
                { k: "cone" as const, l: "Cone" },
                { k: "pyramid" as const, l: "Pyramid" },
                { k: "prism" as const, l: "Hex Prism" },
                { k: "torus" as const, l: "Torus" },
                { k: "tube" as const, l: "Tube" },
                { k: "wedge" as const, l: "Wedge" },
                { k: "arch" as const, l: "Arch" },
              ].map((p) => (
                <button
                  key={p.k}
                  type="button"
                  onClick={() => handleAddPrimitive(p.k, p.l)}
                  style={{
                    height: 58,
                    borderRadius: rSm,
                    border: "1px solid rgba(255,255,255,0.14)",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    color: "#F8FAFC",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Icon name={p.k} size={17} />
                  <span>{p.l}</span>
                </button>
              ))}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                paddingTop: 2,
              }}
            >
              <button
                type="button"
                onClick={() => handleAddPrimitive("roundedBox", "Rounded Box")}
                style={{
                  height: 52,
                  borderRadius: rSm,
                  border: "1px solid rgba(255,255,255,0.18)",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  color: "#F8FAFC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Icon name="roundedBox" size={18} />
                <span>Rounded Box</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddMenuOpen(false)
                  onTriggerSvgInput()
                }}
                style={{
                  height: 52,
                  borderRadius: rSm,
                  border: "1px solid rgba(255,255,255,0.18)",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  color: "#F8FAFC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Icon name="svgFile" size={18} />
                <span>Import SVG</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURE ROUNDED BOX MODAL */}
      {roundedBoxModalOpen && (
        <div onClick={() => setRoundedBoxModalOpen(false)} style={modalBackdrop}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...glass,
              width: "100%",
              maxWidth: 440,
              borderRadius: radius,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ fontSize: 15.5 }}>Configure Rounded Box</strong>
              <button
                type="button"
                onClick={() => setRoundedBoxModalOpen(false)}
                style={iconBtn("#94A3B8")}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "150px 1fr",
                gap: 14,
                alignItems: "center",
              }}
            >
              <RoundedBox3DPreview
                dimCm={{
                  x: Math.max(0.1, parseFloat(rbDimCm.x) || 2),
                  y: Math.max(0.1, parseFloat(rbDimCm.y) || 2),
                  z: Math.max(0.1, parseFloat(rbDimCm.z) || 2),
                }}
                bevelMm={bevelRadiusMm}
                mode={bevelMode}
                accentBorder={accentBorder}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "#CBD5E1",
                      fontWeight: 700,
                    }}
                  >
                    Dimensions (cm)
                  </span>
                  <button
                    type="button"
                    title="Lock Proportions"
                    onClick={() => setRbLockProp((v) => !v)}
                    style={neutralChipBtn(rbLockProp)}
                  >
                    <Icon name={rbLockProp ? "lock" : "unlock"} size={13} />
                  </button>
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
                      <span>{ax.toUpperCase()} (cm)</span>
                      <input
                        className="adivi-num-input"
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={rbDimCm[ax]}
                        onChange={(e) => {
                          const raw = e.target.value
                          const num = parseFloat(raw)
                          if (!rbLockProp || isNaN(num) || num <= 0) {
                            setRbDimCm((p) => ({ ...p, [ax]: raw }))
                          } else {
                            const ratio =
                              num / Math.max(0.1, parseFloat(rbDimCm[ax]) || 2)
                            setRbDimCm({
                              x:
                                ax === "x"
                                  ? raw
                                  : fmt((parseFloat(rbDimCm.x) || 2) * ratio),
                              y:
                                ax === "y"
                                  ? raw
                                  : fmt((parseFloat(rbDimCm.y) || 2) * ratio),
                              z:
                                ax === "z"
                                  ? raw
                                  : fmt((parseFloat(rbDimCm.z) || 2) * ratio),
                            })
                          }
                        }}
                        style={inp}
                      />
                    </label>
                  ))}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                  }}
                >
                  {(["fillet", "chamfer"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBevelMode(m)}
                      style={{
                        height: 28,
                        borderRadius: rSm,
                        border: `1px solid ${bevelMode === m ? accentBorder : "rgba(255,255,255,0.14)"}`,
                        backgroundColor:
                          bevelMode === m ? accent : "rgba(255,255,255,0.06)",
                        color: "#FFF",
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: "capitalize",
                        cursor: "pointer",
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <label style={{ ...lbl, textAlign: "left", gap: 4 }}>
                  <span>
                    {bevelMode === "chamfer"
                      ? "Chamfer Bevel (mm)"
                      : "Fillet Radius (mm)"}
                  </span>
                  <input
                    className="adivi-num-input"
                    type="number"
                    min={0.1}
                    max={25}
                    step={0.1}
                    value={bevelRadiusMm}
                    onChange={(e) =>
                      setBevelRadiusMm(
                        Math.max(
                          0.1,
                          Math.min(25, parseFloat(e.target.value) || 2)
                        )
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmAddRoundedBox()
                    }}
                    style={inp}
                  />
                </label>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setRoundedBoxModalOpen(false)}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: rSm,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#CBD5E1",
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAddRoundedBox}
                style={{
                  height: 32,
                  padding: "0 16px",
                  borderRadius: rSm,
                  border: "none",
                  background: accent,
                  color: "#FFF",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Add to Plate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SNAPSHOT SETTINGS MODAL */}
      {snapshotModalOpen && (
        <div onClick={() => setSnapshotModalOpen(false)} style={modalBackdrop}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...glass,
              width: "100%",
              maxWidth: 330,
              borderRadius: radius,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ fontSize: 15 }}>Snapshot Settings</strong>
              <button
                type="button"
                onClick={() => setSnapshotModalOpen(false)}
                style={iconBtn("#94A3B8")}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span
                style={{
                  fontSize: 11.5,
                  color: "#94A3B8",
                  fontWeight: 700,
                }}
              >
                Include in Render:
              </span>
              {[
                {
                  label: "Model",
                  val: snapIncludeModel,
                  set: setSnapIncludeModel,
                },
                {
                  label: "Build Plate",
                  val: snapIncludePlate,
                  set: setSnapIncludePlate,
                },
                {
                  label: "Background",
                  val: snapIncludeBg,
                  set: setSnapIncludeBg,
                },
              ].map((item) => (
                <label
                  key={item.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: rSm,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.val}
                    onChange={(e) => item.set(e.target.checked)}
                    style={{
                      accentColor: accent,
                      width: 15,
                      height: 15,
                      cursor: "pointer",
                    }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontSize: 11.5,
                  color: "#94A3B8",
                  fontWeight: 700,
                }}
              >
                Default Snapshot Action:
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                }}
              >
                {(["clipboard", "file"] as const).map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setSnapAction(act)}
                    style={{
                      height: 30,
                      borderRadius: rSm,
                      border: `1px solid ${snapAction === act ? accentBorder : "rgba(255,255,255,0.14)"}`,
                      backgroundColor:
                        snapAction === act ? accent : "rgba(255,255,255,0.06)",
                      color: "#FFF",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {act === "clipboard" ? "Copy to Clipboard" : "Save PNG File"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setSnapshotModalOpen(false)}
                style={{
                  height: 32,
                  padding: "0 14px",
                  borderRadius: rSm,
                  border: "none",
                  background: accent,
                  color: "#FFF",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUILD PLATE SETTINGS MODAL */}
      {plateSettingsOpen && (
        <div onClick={() => setPlateSettingsOpen(false)} style={modalBackdrop}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...glass,
              width: "100%",
              maxWidth: 320,
              borderRadius: radius,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ fontSize: 15 }}>Build Plate Settings</strong>
              <button
                type="button"
                onClick={() => setPlateSettingsOpen(false)}
                style={iconBtn("#94A3B8")}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <label style={lbl}>
                <span>Plate Size (cm)</span>
                <input
                  className="adivi-num-input"
                  type="number"
                  min={5}
                  max={100}
                  value={plateSizeText}
                  onChange={(e) => setPlateSizeText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyPlateSettings()
                  }}
                  style={inp}
                />
              </label>
              <label style={lbl}>
                <span>Major Grid (cm)</span>
                <input
                  className="adivi-num-input"
                  type="number"
                  min={1}
                  max={25}
                  value={plateStepText}
                  onChange={(e) => setPlateStepText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyPlateSettings()
                  }}
                  style={inp}
                />
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setPlateSettingsOpen(false)}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: rSm,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#CBD5E1",
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyPlateSettings}
                style={{
                  height: 32,
                  padding: "0 14px",
                  borderRadius: rSm,
                  border: "none",
                  background: accent,
                  color: "#FFF",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {confirmDialog && (
        <div onClick={() => setConfirmDialog(null)} style={modalBackdrop}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...glass,
              width: "100%",
              maxWidth: 340,
              borderRadius: radius,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <strong style={{ fontSize: 15 }}>{confirmDialog.title}</strong>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#CBD5E1",
                lineHeight: 1.5,
              }}
            >
              {confirmDialog.message}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: rSm,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#CBD5E1",
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                style={{
                  height: 32,
                  padding: "0 14px",
                  borderRadius: rSm,
                  border: "none",
                  background: "#DC2626",
                  color: "#FFF",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SVG EXTRUSION MODAL */}
      {svgModal && (
        <div onClick={() => setSvgModal(null)} style={modalBackdrop}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...glass,
              width: "100%",
              maxWidth: 440,
              maxHeight: "88%",
              borderRadius: radius,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ fontSize: 15.5 }}>
                SVG Extrude: {svgModal.an.fileName}
              </strong>
              <button
                type="button"
                onClick={() => setSvgModal(null)}
                style={iconBtn("#94A3B8")}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{ fontSize: 12.5, color: "#94A3B8", fontWeight: 700 }}
              >
                Dimensions (cm)
              </span>
              <button
                type="button"
                title="Lock XY Aspect"
                onClick={() =>
                  setSvgModal((s) => (s ? { ...s, lockXY: !s.lockXY } : null))
                }
                style={neutralChipBtn(svgModal.lockXY)}
              >
                <Icon
                  name={svgModal.lockXY ? "lock" : "unlock"}
                  size={13}
                />
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
              }}
            >
              {(["dimX", "dimY", "dimZ"] as const).map((k, idx) => (
                <label key={k} style={lbl}>
                  <span>{["Width X", "Depth Y", "Height Z"][idx]}</span>
                  <input
                    className="adivi-num-input"
                    type="number"
                    step="0.1"
                    value={svgModal[k]}
                    onChange={(e) => {
                      const raw = e.target.value
                      const num = parseFloat(raw)
                      const asp = svgModal.an.spanY / svgModal.an.spanX
                      setSvgModal((s) => {
                        if (!s) return null
                        if (!s.lockXY || isNaN(num) || num <= 0 || k === "dimZ") {
                          return { ...s, [k]: raw }
                        }
                        return k === "dimX"
                          ? { ...s, dimX: raw, dimY: fmt(num * asp) }
                          : { ...s, dimY: raw, dimX: fmt(num / asp) }
                      })
                    }}
                    style={inp}
                  />
                </label>
              ))}
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                color: "#CBD5E1",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={svgModal.splitByColor}
                onChange={(e) =>
                  setSvgModal((s) =>
                    s ? { ...s, splitByColor: e.target.checked } : null
                  )
                }
                style={{ accentColor: accent, width: 15, height: 15 }}
              />
              <span>Import each SVG color as an editable group part</span>
            </label>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 5,
                maxHeight: 165,
                overflowY: "auto",
              }}
            >
              {svgModal.layers.map((l, idx) => (
                <label
                  key={l.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: Math.min(5, rSm),
                    backgroundColor: "rgba(255,255,255,0.06)",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={l.included}
                    onChange={(e) =>
                      setSvgModal((s) =>
                        s
                          ? {
                              ...s,
                              layers: s.layers.map((it, i) =>
                                i === idx
                                  ? { ...it, included: e.target.checked }
                                  : it
                              ),
                            }
                          : null
                      )
                    }
                    style={{ accentColor: accent, width: 15, height: 15 }}
                  />
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: 99,
                      backgroundColor: l.color,
                      border: "1px solid rgba(255,255,255,0.5)",
                    }}
                  />
                  <span>{l.name}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setSvgModal(null)}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: rSm,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#CBD5E1",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSvgImport}
                style={{
                  height: 34,
                  padding: "0 16px",
                  borderRadius: rSm,
                  border: "none",
                  background: accent,
                  color: "#FFF",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Extrude to 3D
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
