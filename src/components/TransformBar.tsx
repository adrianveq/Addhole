import * as React from "react"
import { ToolMode } from "../types/editor"
import { Icon } from "./Icon"

export function TransformBar({
  topOffset,
  glass,
  rSm,
  accent,
  accentBorder,
  toolMode,
  setToolMode,
  showDropButton,
  handleDropToPlate,
  handleCenterOnPlate,
  handleMirrorAxis,
  layOnFaceMode,
  setLayOnFaceMode,
  contextualBtnStyle,
}: {
  topOffset: number
  glass: React.CSSProperties
  rSm: number
  accent: string
  accentBorder: string
  toolMode: ToolMode
  setToolMode: React.Dispatch<React.SetStateAction<ToolMode>>
  showDropButton: boolean
  handleDropToPlate: () => void
  handleCenterOnPlate: () => void
  handleMirrorAxis: (axis: "x" | "y" | "z") => void
  layOnFaceMode: boolean
  setLayOnFaceMode: React.Dispatch<React.SetStateAction<boolean>>
  contextualBtnStyle: (active?: boolean) => React.CSSProperties
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: topOffset,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        zIndex: 14,
      }}
    >
      <div
        style={{
          ...glass,
          height: 36,
          borderRadius: rSm,
          padding: 2,
          display: "flex",
          gap: 2,
        }}
      >
        {[
          { id: "transform" as const, label: "Transform", key: "", icon: "transform" },
          { id: "move" as const, label: "Move", key: "M", icon: "move" },
          { id: "rotate" as const, label: "Rotate", key: "R", icon: "rotate" },
          { id: "scale" as const, label: "Scale", key: "S", icon: "scale" },
        ].map((t) => {
          const active = toolMode === t.id
          return (
            <button
              key={t.id}
              type="button"
              title={t.key ? `${t.label} (${t.key})` : t.label}
              onClick={() => setToolMode(t.id)}
              style={{
                height: 30,
                padding: "0 12px",
                borderRadius: Math.max(2, rSm - 2),
                border: "none",
                backgroundColor: active ? accent : "transparent",
                color: active ? "#FFFFFF" : "#CBD5E1",
                fontSize: 13,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <Icon name={t.icon} size={14} />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {toolMode === "move" && (
        <div style={{ display: "flex", gap: 5 }}>
          {showDropButton && (
            <button
              type="button"
              title="Drop selected to build plate Z=0 (D)"
              onClick={handleDropToPlate}
              style={contextualBtnStyle(false)}
            >
              <Icon name="drop" size={14} />
              <span>Drop to Plate</span>
            </button>
          )}
          <button
            type="button"
            title="Center selected on build plate (X=0, Y=0)"
            onClick={handleCenterOnPlate}
            style={contextualBtnStyle(false)}
          >
            <Icon name="center" size={14} />
            <span>Center</span>
          </button>
        </div>
      )}

      {toolMode === "rotate" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 5,
          }}
        >
          {(["x", "y", "z"] as const).map((ax) => (
            <button
              key={ax}
              type="button"
              title={`Mirror along ${ax.toUpperCase()} axis`}
              onClick={() => handleMirrorAxis(ax)}
              style={contextualBtnStyle(false)}
            >
              <Icon
                name={`mirror-${ax}`}
                size={16}
                accent={accentBorder}
              />
              <span>Mirror {ax.toUpperCase()}</span>
            </button>
          ))}
          <button
            type="button"
            title="Hover & tap/click any surface to lay it flat on the plate"
            onClick={() => setLayOnFaceMode((v) => !v)}
            style={contextualBtnStyle(layOnFaceMode)}
          >
            <Icon
              name="lay-face"
              size={15}
              accent={layOnFaceMode ? "#FFFFFF" : accentBorder}
            />
            <span>Lay on Face</span>
          </button>
        </div>
      )}
    </div>
  )
}
