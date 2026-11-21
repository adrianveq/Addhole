import * as React from "react"

export const modalBackdrop: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundColor: "rgba(2, 6, 23, 0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 30,
}

export const neutralChipBtn = (active: boolean): React.CSSProperties => ({
  height: 24,
  minWidth: 26,
  padding: "0 6px",
  borderRadius: 5,
  border: active
    ? "1px solid rgba(255,255,255,0.38)"
    : "1px solid rgba(255,255,255,0.16)",
  backgroundColor: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
  color: active ? "#FFFFFF" : "#CBD5E1",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  lineHeight: 1,
})

export const iconBtn = (color: string): React.CSSProperties => ({
  background: "none",
  border: "none",
  color,
  padding: 0,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
})

export const lbl: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11.5,
  fontWeight: 600,
  color: "#94A3B8",
  textAlign: "center",
}

export const inp: React.CSSProperties = {
  width: "100%",
  height: 28,
  borderRadius: 5,
  border: "1px solid rgba(255,255,255,0.16)",
  backgroundColor: "rgba(255,255,255,0.07)",
  color: "#F8FAFC",
  padding: "0 4px",
  fontSize: 12.5,
  fontWeight: 700,
  textAlign: "center",
  outline: "none",
  boxSizing: "border-box",
}

export function createThemeHelpers(accent: string, accentBorder: string, radius: number) {
  const rSm = Math.max(0, radius - 2)

  const glass: React.CSSProperties = {
    backgroundColor: "rgba(15, 23, 42, 0.86)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#F8FAFC",
  }

  const sqToolBtn = (active = false): React.CSSProperties => ({
    ...glass,
    width: 34,
    height: 34,
    borderRadius: rSm,
    backgroundColor: active ? accent : glass.backgroundColor,
    borderColor: active ? accentBorder : "rgba(255,255,255,0.16)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
  })

  const subtleSqBtn = (active = false): React.CSSProperties => ({
    ...glass,
    width: 30,
    height: 30,
    borderRadius: rSm,
    backgroundColor: active ? "rgba(255,255,255,0.12)" : glass.backgroundColor,
    borderColor: active ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.16)",
    color: active ? "#FFFFFF" : "#CBD5E1",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
  })

  const contextualBtnStyle = (active = false): React.CSSProperties => ({
    backgroundColor: active ? accent : "rgba(15, 23, 42, 0.86)",
    backdropFilter: "blur(8px)",
    border: `1px solid ${active ? accentBorder : "rgba(255,255,255,0.14)"}`,
    color: active ? "#FFFFFF" : "#E2E8F0",
    height: 31,
    padding: "0 11px",
    borderRadius: rSm,
    fontSize: 12.5,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
  })

  const ctxMenuItemStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    borderRadius: Math.min(5, rSm),
    border: "none",
    background: "transparent",
    color: "#F8FAFC",
    fontSize: 12.5,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    cursor: "pointer",
    textAlign: "left",
  }

  return {
    rSm,
    glass,
    sqToolBtn,
    subtleSqBtn,
    contextualBtnStyle,
    ctxMenuItemStyle,
  }
}
