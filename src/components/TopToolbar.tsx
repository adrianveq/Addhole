import * as React from "react"
import * as THREE from "three"
import { APP_VERSION, PALETTE } from "../constants/editorConfig"
import { EditingGroupState, SceneObject } from "../types/editor"
import { iconBtn } from "../styles/uiStyles"
import { Icon, SwatchCircle } from "./Icon"

export function TopToolbar({
  topOffset,
  glass,
  radius,
  rSm,
  accent,
  accentBorder,
  sqToolBtn,
  setAboutModalOpen,
  onTriggerFileInput,
  importButtonLabel,
  addMenuOpen,
  setAddMenuOpen,
  marqueeSelectMode,
  setMarqueeSelectMode,
  editingGroupState,
  exitGroupIsolation,
  histFlags,
  handleUndo,
  handleRedo,
  visibleListObjects,
  objectsCollapsed,
  setObjectsCollapsed,
  selectedIds,
  setSelectedIds,
  handleGroupSelected,
  canUngroupSelected,
  handleUngroupSelected,
  canSplitSelected,
  handleSplitSelected,
  selectedObj,
  objectsListHeight,
  setObjectsListHeight,
  collapsedGroups,
  setCollapsedGroups,
  enterGroupIsolation,
  colorPopoverId,
  setColorPopoverId,
  renamingId,
  setRenamingId,
  renameText,
  setRenameText,
  patchObject,
  moveObjectInList,
  requestDeleteObjects,
}: {
  topOffset: number
  glass: React.CSSProperties
  radius: number
  rSm: number
  accent: string
  accentBorder: string
  sqToolBtn: (active?: boolean) => React.CSSProperties
  setAboutModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  onTriggerFileInput: () => void
  importButtonLabel?: string
  addMenuOpen: boolean
  setAddMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  marqueeSelectMode: boolean
  setMarqueeSelectMode: React.Dispatch<React.SetStateAction<boolean>>
  editingGroupState: EditingGroupState | null
  exitGroupIsolation: (nextSelectedIdsAfterExit?: string[]) => Promise<void>
  histFlags: { canUndo: boolean; canRedo: boolean }
  handleUndo: () => void
  handleRedo: () => void
  visibleListObjects: SceneObject[]
  objectsCollapsed: boolean
  setObjectsCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  selectedIds: string[]
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>
  handleGroupSelected: () => void
  canUngroupSelected: boolean
  handleUngroupSelected: () => void
  canSplitSelected: boolean
  handleSplitSelected: () => void
  selectedObj: SceneObject | null
  objectsListHeight: number
  setObjectsListHeight: React.Dispatch<React.SetStateAction<number>>
  collapsedGroups: Record<string, boolean>
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  enterGroupIsolation: (groupId: string, initialChildIndex?: number) => void
  colorPopoverId: string | null
  setColorPopoverId: React.Dispatch<React.SetStateAction<string | null>>
  renamingId: string | null
  setRenamingId: React.Dispatch<React.SetStateAction<string | null>>
  renameText: string
  setRenameText: React.Dispatch<React.SetStateAction<string>>
  patchObject: (id: string, fn: (o: SceneObject) => SceneObject, recordHistory?: boolean) => void
  moveObjectInList: (id: string, direction: -1 | 1) => void
  requestDeleteObjects: (ids: string[]) => void
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: topOffset,
        left: 14,
        width: 320,
        maxWidth: "calc(100vw - 28px)",
        display: "flex",
        flexDirection: "column",
        gap: 7,
        zIndex: 15,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          title={`ADIVI 3D Studio (${APP_VERSION}) — About`}
          onClick={() => setAboutModalOpen(true)}
          style={sqToolBtn(false)}
        >
          <Icon name="brand" size={17} accent={accentBorder} />
        </button>

        <button
          type="button"
          title="Import STL, 3MF, STEP, SVG or .adiv project"
          onClick={onTriggerFileInput}
          style={{
            ...glass,
            height: 34,
            padding: "0 11px",
            borderRadius: rSm,
            backgroundColor: accent,
            borderColor: accentBorder,
            fontWeight: 700,
            fontSize: 12.5,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Icon name="upload" size={13} />
          <span>{importButtonLabel || "Import"}</span>
        </button>

        <button
          type="button"
          title="Add Shape or SVG"
          onClick={() => setAddMenuOpen(true)}
          style={sqToolBtn(addMenuOpen)}
        >
          <Icon name="plus" size={14} />
        </button>

        <button
          type="button"
          title="Multi-Select Mode (drag box or tap multiple objects on touch screens)"
          onClick={() => setMarqueeSelectMode((v) => !v)}
          style={sqToolBtn(marqueeSelectMode)}
        >
          <Icon
            name="marquee"
            size={14}
            accent={marqueeSelectMode ? "#FFFFFF" : accentBorder}
          />
        </button>

        {!editingGroupState && (
          <>
            <button
              type="button"
              title="Undo (Ctrl+Z)"
              disabled={!histFlags.canUndo}
              onClick={handleUndo}
              style={{
                ...sqToolBtn(false),
                opacity: histFlags.canUndo ? 1 : 0.4,
              }}
            >
              <Icon name="undo" size={14} />
            </button>
            <button
              type="button"
              title="Redo (Ctrl+Y)"
              disabled={!histFlags.canRedo}
              onClick={handleRedo}
              style={{
                ...sqToolBtn(false),
                opacity: histFlags.canRedo ? 1 : 0.4,
              }}
            >
              <Icon name="redo" size={14} />
            </button>
          </>
        )}
      </div>

      {/* OBJECTS TREE PANEL */}
      {visibleListObjects.length > 0 && (
        <div
          style={{
            ...glass,
            borderRadius: radius,
            padding: "8px 8px 4px 8px",
            display: "flex",
            flexDirection: "column",
            gap: objectsCollapsed ? 0 : 6,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
              color: "#94A3B8",
              fontWeight: 700,
              minHeight: 24,
              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={() => setObjectsCollapsed((v) => !v)}
              style={{
                background: "none",
                border: "none",
                color: "#CBD5E1",
                fontSize: 12,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: 0,
                cursor: "pointer",
              }}
            >
              <Icon
                name={objectsCollapsed ? "chevron-right" : "chevron-down"}
                size={14}
              />
              <span>
                {editingGroupState
                  ? `Group: ${editingGroupState.groupName} (${visibleListObjects.length})`
                  : `Objects (${visibleListObjects.length})`}
              </span>
            </button>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              {editingGroupState ? (
                <button
                  type="button"
                  onClick={() => exitGroupIsolation()}
                  style={{
                    height: 24,
                    padding: "0 9px",
                    borderRadius: 4,
                    border: "none",
                    backgroundColor: accent,
                    color: "#FFF",
                    fontSize: 11.5,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                  }}
                >
                  <Icon name="check" size={12} />
                  <span>Done</span>
                </button>
              ) : (
                <>
                  {selectedIds.length >= 2 && (
                    <button
                      type="button"
                      title="Group selected objects"
                      onClick={handleGroupSelected}
                      style={{
                        height: 24,
                        padding: "0 8px",
                        borderRadius: 4,
                        border: "none",
                        backgroundColor: accent,
                        color: "#FFF",
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        cursor: "pointer",
                      }}
                    >
                      <Icon name="merge" size={12} />
                      <span>Group ({selectedIds.length})</span>
                    </button>
                  )}
                  {canUngroupSelected && (
                    <button
                      type="button"
                      title="Ungroup into original objects"
                      onClick={handleUngroupSelected}
                      style={{
                        height: 24,
                        padding: "0 8px",
                        borderRadius: 4,
                        border: "1px solid rgba(255,255,255,0.18)",
                        backgroundColor: "rgba(255,255,255,0.1)",
                        color: "#F8FAFC",
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        cursor: "pointer",
                      }}
                    >
                      <Icon name="ungroup" size={12} />
                      <span>Ungroup</span>
                    </button>
                  )}
                  {canSplitSelected && selectedObj && (
                    <button
                      type="button"
                      title="Split disconnected parts"
                      onClick={handleSplitSelected}
                      style={{
                        height: 24,
                        padding: "0 8px",
                        borderRadius: 4,
                        border: "1px solid rgba(255,255,255,0.18)",
                        backgroundColor: "rgba(255,255,255,0.1)",
                        color: "#F8FAFC",
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        cursor: "pointer",
                      }}
                    >
                      <Icon name="split" size={12} />
                      <span>Split ({selectedObj.partCount})</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {!objectsCollapsed && (
            <>
              <div
                className="adivi-objects-scroll"
                style={{
                  height: objectsListHeight,
                  maxHeight: 540,
                  overflowY: "auto",
                  paddingRight: 2,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {visibleListObjects.map((o, idx) => {
                  const sel = selectedIds.includes(o.id)
                  const isGroup =
                    !editingGroupState && Boolean((o.groupChildren?.length || 0) > 1)
                  const secondChild = isGroup ? o.groupChildren![1] : null
                  const isGroupExpanded = isGroup && !collapsedGroups[o.id]

                  return (
                    <div
                      key={o.id}
                      style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                    >
                      <div
                        onClick={(e) => {
                          if (
                            e.shiftKey ||
                            e.ctrlKey ||
                            e.metaKey ||
                            marqueeSelectMode
                          ) {
                            setSelectedIds((cur) =>
                              cur.includes(o.id)
                                ? cur.filter((id) => id !== o.id)
                                : [...cur, o.id]
                            )
                          } else {
                            setSelectedIds([o.id])
                          }
                        }}
                        onDoubleClick={(e) => {
                          if (isGroup && e.target === e.currentTarget) {
                            enterGroupIsolation(o.id, 0)
                          }
                        }}
                        title={
                          isGroup
                            ? "Double-click bar to isolate & edit group parts"
                            : undefined
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 6,
                          padding: "6px 7px",
                          borderRadius: Math.min(5, rSm),
                          backgroundColor: sel
                            ? "rgba(13,148,136,0.26)"
                            : isGroup
                              ? "rgba(30, 41, 59, 0.85)"
                              : "rgba(255,255,255,0.04)",
                          border: `1px solid ${
                            sel
                              ? accentBorder
                              : isGroup
                                ? "rgba(255,255,255,0.14)"
                                : "transparent"
                          }`,
                          cursor: "pointer",
                          fontSize: 12.5,
                          fontWeight: isGroup ? 700 : 400,
                        }}
                      >
                        <span
                          onDoubleClick={(e) => {
                            if (isGroup && e.target === e.currentTarget) {
                              e.stopPropagation()
                              enterGroupIsolation(o.id, 0)
                            }
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          {isGroup && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setCollapsedGroups((prev) => ({
                                  ...prev,
                                  [o.id]: !prev[o.id],
                                }))
                              }}
                              onDoubleClick={(e) => e.stopPropagation()}
                              style={{
                                background: "none",
                                border: "none",
                                color: accentBorder,
                                padding: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                            >
                              <Icon
                                name={
                                  isGroupExpanded ? "chevron-down" : "chevron-right"
                                }
                                size={14}
                              />
                            </button>
                          )}

                          {isGroup ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setColorPopoverId((cur) =>
                                  cur === o.id ? null : o.id
                                )
                              }}
                              onDoubleClick={(e) => e.stopPropagation()}
                              style={{
                                position: "relative",
                                width: 16,
                                height: 16,
                                background: "none",
                                border: "none",
                                padding: 0,
                                flexShrink: 0,
                                cursor: "pointer",
                              }}
                            >
                              <span
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  right: 0,
                                  width: 11,
                                  height: 11,
                                  borderRadius: 99,
                                  backgroundColor: secondChild?.isHole
                                    ? "#1E293B"
                                    : secondChild?.color || o.color,
                                  border: secondChild?.isHole
                                    ? "1.5px solid #FCA5A5"
                                    : "1px solid rgba(255,255,255,0.7)",
                                }}
                              />
                              <span
                                style={{
                                  position: "absolute",
                                  bottom: 0,
                                  left: 0,
                                  width: 11,
                                  height: 11,
                                  borderRadius: 99,
                                  backgroundColor: o.color,
                                  border: "1px solid rgba(255,255,255,0.85)",
                                }}
                              />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setColorPopoverId((cur) =>
                                  cur === o.id ? null : o.id
                                )
                              }}
                              onDoubleClick={(e) => e.stopPropagation()}
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                display: "inline-flex",
                                alignItems: "center",
                                cursor: "pointer",
                              }}
                            >
                              <SwatchCircle
                                isHole={o.isHole}
                                color={o.color}
                                size={13}
                              />
                            </button>
                          )}

                          {renamingId === o.id ? (
                            <input
                              autoFocus
                              value={renameText}
                              onClick={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => e.stopPropagation()}
                              onChange={(e) => setRenameText(e.target.value)}
                              onBlur={() => {
                                if (renameText.trim()) {
                                  patchObject(o.id, (it) => ({
                                    ...it,
                                    name: renameText.trim(),
                                  }))
                                }
                                setRenamingId(null)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (renameText.trim()) {
                                    patchObject(o.id, (it) => ({
                                      ...it,
                                      name: renameText.trim(),
                                    }))
                                  }
                                  setRenamingId(null)
                                } else if (e.key === "Escape") {
                                  setRenamingId(null)
                                }
                              }}
                              style={{
                                width: "100%",
                                height: 20,
                                borderRadius: 4,
                                border: `1px solid ${accentBorder}`,
                                background: "#09101D",
                                color: "#FFF",
                                fontSize: 12,
                                padding: "0 5px",
                                outline: "none",
                              }}
                            />
                          ) : (
                            <span
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                setRenamingId(o.id)
                                setRenameText(o.name)
                              }}
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                opacity: o.visible ? 1 : 0.45,
                              }}
                            >
                              {o.name}
                              {isGroup && (
                                <span
                                  style={{
                                    color: accentBorder,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    marginLeft: 5,
                                  }}
                                >
                                  ({o.groupChildren!.length})
                                </span>
                              )}
                            </span>
                          )}
                        </span>

                        <span
                          onDoubleClick={(e) => e.stopPropagation()}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            flexShrink: 0,
                          }}
                        >
                          <button
                            type="button"
                            title="Move up"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation()
                              moveObjectInList(o.id, -1)
                            }}
                            style={{
                              ...iconBtn(idx === 0 ? "#475569" : "#94A3B8"),
                              opacity: idx === 0 ? 0.35 : 1,
                            }}
                          >
                            <Icon name="arrow-up" size={12} />
                          </button>
                          <button
                            type="button"
                            title="Move down"
                            disabled={idx === visibleListObjects.length - 1}
                            onClick={(e) => {
                              e.stopPropagation()
                              moveObjectInList(o.id, 1)
                            }}
                            style={{
                              ...iconBtn(
                                idx === visibleListObjects.length - 1
                                  ? "#475569"
                                  : "#94A3B8"
                              ),
                              opacity:
                                idx === visibleListObjects.length - 1 ? 0.35 : 1,
                            }}
                          >
                            <Icon name="arrow-down" size={12} />
                          </button>
                          <button
                            type="button"
                            title="Hide / Show (H)"
                            onClick={(e) => {
                              e.stopPropagation()
                              patchObject(o.id, (it) => ({
                                ...it,
                                visible: !it.visible,
                              }))
                            }}
                            style={iconBtn("#94A3B8")}
                          >
                            <Icon name={o.visible ? "eye" : "eye-off"} size={13} />
                          </button>
                          <button
                            type="button"
                            title="Delete (Del)"
                            onClick={(e) => {
                              e.stopPropagation()
                              requestDeleteObjects([o.id])
                            }}
                            style={iconBtn("#FCA5A5")}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </span>
                      </div>

                      {isGroupExpanded && o.groupChildren && (
                        <div
                          style={{
                            marginLeft: 14,
                            paddingLeft: 8,
                            borderLeft: "1.5px solid rgba(20, 184, 166, 0.35)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                          }}
                        >
                          {o.groupChildren.map((child, cIdx) => (
                            <div
                              key={`${o.id}_c_${cIdx}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                enterGroupIsolation(o.id, cIdx)
                              }}
                              title="Click to edit this part inside group"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                padding: "4.5px 7px",
                                borderRadius: Math.min(4, rSm),
                                backgroundColor: "rgba(15, 23, 42, 0.55)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                fontSize: 11.5,
                                color: "#CBD5E1",
                                cursor: "pointer",
                              }}
                            >
                              <SwatchCircle
                                isHole={child.isHole}
                                color={child.color}
                                size={11}
                              />
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {child.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* COLOR / OPACITY / SOLID & HOLE POPOVER */}
                      {colorPopoverId === o.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                          style={{
                            ...glass,
                            position: "absolute",
                            left: 0,
                            top: 34,
                            width: 244,
                            padding: 11,
                            borderRadius: rSm,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                            zIndex: 25,
                            boxShadow: "0 10px 26px rgba(0,0,0,0.45)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            {PALETTE.map((hex) => (
                              <button
                                key={hex}
                                type="button"
                                onClick={() => {
                                  patchObject(o.id, (it) => ({
                                    ...it,
                                    color: hex,
                                    isHole: false,
                                  }))
                                  setColorPopoverId(null)
                                }}
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 99,
                                  backgroundColor: hex,
                                  border:
                                    o.color === hex && !o.isHole
                                      ? `2px solid ${accentBorder}`
                                      : "1.5px solid rgba(255,255,255,0.5)",
                                  padding: 0,
                                  cursor: "pointer",
                                  flexShrink: 0,
                                }}
                              />
                            ))}
                            <label
                              title="Custom Color"
                              style={{
                                position: "relative",
                                width: 20,
                                height: 20,
                                borderRadius: 99,
                                background:
                                  "conic-gradient(#EF4444, #F59E0B, #10B981, #38BDF8, #A78BFA, #EF4444)",
                                border: "1.5px solid rgba(255,255,255,0.7)",
                                cursor: "pointer",
                                overflow: "hidden",
                                flexShrink: 0,
                              }}
                            >
                              <input
                                type="color"
                                value={o.color}
                                onChange={(e) =>
                                  patchObject(o.id, (it) => ({
                                    ...it,
                                    color: e.target.value,
                                    isHole: false,
                                  }))
                                }
                                style={{
                                  position: "absolute",
                                  inset: -6,
                                  width: 32,
                                  height: 32,
                                  opacity: 0,
                                  cursor: "pointer",
                                }}
                              />
                            </label>
                          </div>

                          {!o.isHole && (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
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
                                <span>Opacity</span>
                                <strong style={{ color: accentBorder }}>
                                  {Math.round((o.opacity ?? 1) * 100)}%
                                </strong>
                              </div>
                              <input
                                type="range"
                                min={15}
                                max={100}
                                step={5}
                                value={Math.round((o.opacity ?? 1) * 100)}
                                onChange={(e) =>
                                  patchObject(o.id, (it) => ({
                                    ...it,
                                    opacity: Number(e.target.value) / 100,
                                  }))
                                }
                                style={{
                                  width: "100%",
                                  accentColor: accent,
                                  cursor: "pointer",
                                  margin: 0,
                                }}
                              />
                            </div>
                          )}

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 6,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                patchObject(o.id, (it) => ({
                                  ...it,
                                  isHole: false,
                                }))
                                setColorPopoverId(null)
                              }}
                              style={{
                                height: 27,
                                borderRadius: 4,
                                border: `1px solid ${!o.isHole ? accentBorder : "rgba(255,255,255,0.14)"}`,
                                backgroundColor: !o.isHole
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
                              <Icon name="solidIcon" size={12} />
                              <span>Solid</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                patchObject(o.id, (it) => ({
                                  ...it,
                                  isHole: true,
                                }))
                                setColorPopoverId(null)
                              }}
                              style={{
                                height: 27,
                                borderRadius: 4,
                                border: `1px solid ${o.isHole ? "#FCA5A5" : "rgba(255,255,255,0.14)"}`,
                                backgroundColor: o.isHole
                                  ? "rgba(239, 68, 68, 0.35)"
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
                              <Icon name="holeIcon" size={12} />
                              <span>Hole</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div
                title="Drag vertically to resize Objects panel"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  const startY = e.clientY
                  const startH = objectsListHeight
                  const onMove = (ev: PointerEvent) =>
                    setObjectsListHeight(
                      THREE.MathUtils.clamp(startH + (ev.clientY - startY), 88, 520)
                    )
                  const onUp = () => {
                    window.removeEventListener("pointermove", onMove)
                    window.removeEventListener("pointerup", onUp)
                  }
                  window.addEventListener("pointermove", onMove)
                  window.addEventListener("pointerup", onUp)
                }}
                style={{
                  height: 11,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "ns-resize",
                  touchAction: "none",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 3,
                    borderRadius: 99,
                    backgroundColor: "rgba(148, 163, 184, 0.36)",
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
