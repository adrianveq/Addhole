import * as React from "react"
import { EditingGroupState, SceneObject } from "../types/editor"
import { Icon } from "./Icon"

export function ContextMenu({
  contextMenu,
  setContextMenu,
  glass,
  rSm,
  accentBorder,
  ctxMenuItemStyle,
  editingGroupState,
  selectedIds,
  selectedObj,
  canUngroupSelected,
  canSplitSelected,
  handleGroupSelected,
  handleUngroupSelected,
  handleSplitSelected,
  duplicateSelected,
  handleDropToPlate,
  handleCenterOnPlate,
  patchSelected,
  requestDeleteObjects,
  setAddMenuOpen,
  onTriggerFileInput,
}: {
  contextMenu: { x: number; y: number }
  setContextMenu: React.Dispatch<React.SetStateAction<null | { x: number; y: number }>>
  glass: React.CSSProperties
  rSm: number
  accentBorder: string
  ctxMenuItemStyle: React.CSSProperties
  editingGroupState: EditingGroupState | null
  selectedIds: string[]
  selectedObj: SceneObject | null
  canUngroupSelected: boolean
  canSplitSelected: boolean
  handleGroupSelected: () => void
  handleUngroupSelected: () => void
  handleSplitSelected: () => void
  duplicateSelected: () => void
  handleDropToPlate: () => void
  handleCenterOnPlate: () => void
  patchSelected: (fn: (o: SceneObject) => SceneObject, recordHistory?: boolean) => void
  requestDeleteObjects: (ids: string[]) => void
  setAddMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  onTriggerFileInput: () => void
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        ...glass,
        position: "absolute",
        left: contextMenu.x,
        top: contextMenu.y,
        width: 185,
        borderRadius: rSm,
        padding: 5,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        zIndex: 35,
        boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
      }}
    >
      {!editingGroupState && selectedIds.length >= 2 && (
        <button
          type="button"
          className="adivi-ctx-btn"
          onClick={() => {
            setContextMenu(null)
            handleGroupSelected()
          }}
          style={{ ...ctxMenuItemStyle, color: accentBorder }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="merge" size={13} />
            <span>Group ({selectedIds.length})</span>
          </span>
        </button>
      )}
      {canUngroupSelected && (
        <button
          type="button"
          className="adivi-ctx-btn"
          onClick={() => {
            setContextMenu(null)
            handleUngroupSelected()
          }}
          style={ctxMenuItemStyle}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="ungroup" size={13} />
            <span>Ungroup</span>
          </span>
        </button>
      )}
      {canSplitSelected && selectedObj && (
        <button
          type="button"
          className="adivi-ctx-btn"
          onClick={() => {
            setContextMenu(null)
            handleSplitSelected()
          }}
          style={ctxMenuItemStyle}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Icon name="split" size={13} />
            <span>Split ({selectedObj.partCount})</span>
          </span>
        </button>
      )}
      {selectedIds.length > 0 && (
        <>
          {!editingGroupState && (
            <button
              type="button"
              className="adivi-ctx-btn"
              onClick={() => {
                setContextMenu(null)
                duplicateSelected()
              }}
              style={ctxMenuItemStyle}
            >
              <span>Duplicate</span>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Ctrl+D</span>
            </button>
          )}
          <button
            type="button"
            className="adivi-ctx-btn"
            onClick={() => {
              setContextMenu(null)
              handleDropToPlate()
            }}
            style={ctxMenuItemStyle}
          >
            <span>Drop to Plate</span>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>D</span>
          </button>
          <button
            type="button"
            className="adivi-ctx-btn"
            onClick={() => {
              setContextMenu(null)
              handleCenterOnPlate()
            }}
            style={ctxMenuItemStyle}
          >
            <span>Center on Plate</span>
          </button>
          <button
            type="button"
            className="adivi-ctx-btn"
            onClick={() => {
              setContextMenu(null)
              patchSelected((o) => ({ ...o, isHole: !o.isHole }))
            }}
            style={ctxMenuItemStyle}
          >
            <span>
              {selectedObj?.isHole
                ? "Convert to Solid (+)"
                : "Convert to Hole (−)"}
            </span>
          </button>
          <div
            style={{
              height: 1,
              backgroundColor: "rgba(255,255,255,0.1)",
              margin: "2px 4px",
            }}
          />
          <button
            type="button"
            className="adivi-ctx-btn"
            onClick={() => {
              setContextMenu(null)
              requestDeleteObjects(selectedIds)
            }}
            style={{ ...ctxMenuItemStyle, color: "#FCA5A5" }}
          >
            <span>Delete</span>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>Del</span>
          </button>
        </>
      )}
      {selectedIds.length === 0 && (
        <>
          <button
            type="button"
            className="adivi-ctx-btn"
            onClick={() => {
              setContextMenu(null)
              setAddMenuOpen(true)
            }}
            style={ctxMenuItemStyle}
          >
            <span>Add Shape...</span>
          </button>
          <button
            type="button"
            className="adivi-ctx-btn"
            onClick={() => {
              setContextMenu(null)
              onTriggerFileInput()
            }}
            style={ctxMenuItemStyle}
          >
            <span>Import File...</span>
          </button>
        </>
      )}
    </div>
  )
}
