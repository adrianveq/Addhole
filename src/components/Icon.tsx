import * as React from "react"

export function Icon({
  name,
  size = 14,
  accent = "#14B8A6",
}: {
  name: string
  size?: number
  accent?: string
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { display: "block" as const },
  }

  const map: Record<string, React.ReactNode> = {
    brand: (
      <>
        <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" stroke={accent} strokeWidth={2.2} />
        <path d="M8.5 15.5L12 7.5l3.5 8M9.6 13.2h4.8" stroke="#F8FAFC" strokeWidth={2.1} />
      </>
    ),
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </>
    ),
    save: (
      <>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </>
    ),
    camera: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
    edgeGlow: (
      <>
        <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </>
    ),
    marquee: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
        <polyline points="9 11 12 14 22 4" stroke={accent} />
      </>
    ),
    plus: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </>
    ),
    solidIcon: (
      <>
        <circle cx="12" cy="12" r="8" fill="currentColor" stroke="none" />
      </>
    ),
    holeIcon: (
      <>
        <circle cx="12" cy="12" r="8" strokeDasharray="3 2" />
        <line x1="8.5" y1="12" x2="15.5" y2="12" />
      </>
    ),
    "arrow-up": (
      <>
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </>
    ),
    "arrow-down": (
      <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </>
    ),
    "chevron-down": <polyline points="6 9 12 15 18 9" />,
    "chevron-right": <polyline points="9 18 15 12 9 6" />,
    check: <polyline points="20 6 9 17 4 12" />,
    eye: (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    "eye-off": (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ),
    trash: (
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    ),
    lock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
    unlock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      </>
    ),
    reset: (
      <>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </>
    ),
    undo: (
      <>
        <polyline points="9 14 4 9 9 4" />
        <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
      </>
    ),
    redo: (
      <>
        <polyline points="15 14 20 9 15 4" />
        <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
      </>
    ),
    drop: (
      <>
        <path d="M12 3v14" />
        <polyline points="7 12 12 17 17 12" />
        <line x1="5" y1="21" x2="19" y2="21" />
      </>
    ),
    center: (
      <>
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </>
    ),
    focus: (
      <>
        <path d="M4 8V6a2 2 0 0 1 2-2h2" />
        <path d="M4 16v2a2 2 0 0 0 2 2h2" />
        <path d="M16 4h2a2 2 0 0 1 2 2v2" />
        <path d="M16 20h2a2 2 0 0 0 2-2v-2" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    "lay-face": (
      <>
        <polygon points="12 3 20 9.5 12 15.5 4 9.5 12 3" />
        <polyline points="8.5 14 12 17.5 15.5 14" />
        <line x1="3" y1="21" x2="21" y2="21" stroke={accent} strokeWidth={2.4} />
      </>
    ),
    merge: (
      <>
        <polyline points="8 3 3 3 3 8" />
        <line x1="3" y1="3" x2="10" y2="10" />
        <polyline points="16 3 21 3 21 8" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="12" y1="12" x2="12" y2="21" />
      </>
    ),
    ungroup: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <path d="M14 6h4v4" />
        <path d="M10 18H6v-4" />
      </>
    ),
    split: (
      <>
        <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="3 2" />
        <polyline points="8 8 4 12 8 16" />
        <polyline points="16 8 20 12 16 16" />
      </>
    ),
    simplify: (
      <>
        <polygon points="12 3 21 19 3 19 12 3" />
        <line x1="7.5" y1="11" x2="16.5" y2="11" />
      </>
    ),
    wireframe: (
      <>
        <path d="M12 2l8 4.5v11L12 22l-8-4.5v-11L12 2z" />
        <line x1="12" y1="11" x2="12" y2="22" />
        <line x1="12" y1="11" x2="20" y2="6.5" />
        <line x1="12" y1="11" x2="4" y2="6.5" />
      </>
    ),
    "mirror-x": (
      <>
        <line x1="12" y1="2.5" x2="12" y2="21.5" stroke={accent} strokeWidth={2.4} strokeDasharray="3 2.5" />
        <polygon points="9.2 6 3 12 9.2 18 9.2 6" fill="currentColor" stroke="none" />
        <polygon points="14.8 6 21 12 14.8 18 14.8 6" fill="none" stroke="currentColor" strokeWidth={2} />
      </>
    ),
    "mirror-y": (
      <>
        <line x1="2.5" y1="12" x2="21.5" y2="12" stroke={accent} strokeWidth={2.4} strokeDasharray="3 2.5" />
        <polygon points="6 9.2 12 3 18 9.2 6 9.2" fill="currentColor" stroke="none" />
        <polygon points="6 14.8 12 21 18 14.8 6 14.8" fill="none" stroke="currentColor" strokeWidth={2} />
      </>
    ),
    "mirror-z": (
      <>
        <line x1="3.5" y1="20.5" x2="20.5" y2="3.5" stroke={accent} strokeWidth={2.4} strokeDasharray="3 2.5" />
        <polygon points="4 6 11 6 4 13 4 6" fill="currentColor" stroke="none" />
        <polygon points="20 18 13 18 20 11 20 18" fill="none" stroke="currentColor" strokeWidth={2} />
      </>
    ),
    transform: (
      <>
        <rect x="2" y="2" width="5.5" height="5.5" rx="1" fill="currentColor" stroke="none" />
        <rect x="16.5" y="2" width="5.5" height="5.5" rx="1" fill="currentColor" stroke="none" />
        <rect x="2" y="16.5" width="5.5" height="5.5" rx="1" fill="currentColor" stroke="none" />
        <rect x="16.5" y="16.5" width="5.5" height="5.5" rx="1" fill="currentColor" stroke="none" />
        <line x1="7.5" y1="4.75" x2="16.5" y2="4.75" strokeWidth={2.65} />
        <line x1="7.5" y1="19.25" x2="16.5" y2="19.25" strokeWidth={2.65} />
        <line x1="4.75" y1="7.5" x2="4.75" y2="16.5" strokeWidth={2.65} />
        <line x1="19.25" y1="7.5" x2="19.25" y2="16.5" strokeWidth={2.65} />
      </>
    ),
    move: (
      <>
        <polyline points="5 9 2 12 5 15" />
        <polyline points="9 5 12 2 15 5" />
        <polyline points="15 19 12 22 9 19" />
        <polyline points="19 9 22 12 19 15" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </>
    ),
    rotate: (
      <>
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
        <polyline points="21 3 21 8 16 8" />
      </>
    ),
    scale: (
      <>
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </>
    ),
    ortho: (
      <>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </>
    ),
    persp: (
      <>
        <polygon points="4 6 15 4 20 8 20 19 9 20 4 16 4 6" />
        <polyline points="4 6 9 9 20 8" />
        <line x1="9" y1="9" x2="9" y2="20" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </>
    ),
    banana: (
      <>
        <path d="M4 17c4.5 2.5 11.5 1 15.5-5.5 1.8-2.9 2.1-5.8 1.5-7.5l-2.3.7c-.2 2.4-1.3 4.8-3.3 6.7-3.1 3-7.6 4.1-11.4 3.4L4 17z" />
        <path d="M19.5 4.2L21 2.5" />
      </>
    ),
    turntable: (
      <>
        <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-9-9" />
        <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3" />
        <polyline points="19 3 19 7 15 7" />
      </>
    ),
    "align-x-min": (
      <>
        <line x1="3.5" y1="3" x2="3.5" y2="21" stroke={accent} strokeWidth={2.8} />
        <rect x="6.5" y="5.5" width="14" height="4.5" rx="1.2" fill="currentColor" stroke="none" />
        <rect x="6.5" y="14" width="8.5" height="4.5" rx="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    "align-x-center": (
      <>
        <line x1="12" y1="2.5" x2="12" y2="21.5" stroke={accent} strokeWidth={2.8} />
        <rect x="4" y="5.5" width="16" height="4.5" rx="1.2" fill="currentColor" stroke="none" />
        <rect x="7" y="14" width="10" height="4.5" rx="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    "align-x-max": (
      <>
        <line x1="20.5" y1="3" x2="20.5" y2="21" stroke={accent} strokeWidth={2.8} />
        <rect x="3.5" y="5.5" width="14" height="4.5" rx="1.2" fill="currentColor" stroke="none" />
        <rect x="9" y="14" width="8.5" height="4.5" rx="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    "align-y-min": (
      <>
        <line x1="3" y1="20.5" x2="21" y2="20.5" stroke={accent} strokeWidth={2.8} />
        <rect x="5.5" y="3.5" width="4.5" height="14" rx="1.2" fill="currentColor" stroke="none" />
        <rect x="14" y="9" width="4.5" height="8.5" rx="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    "align-y-center": (
      <>
        <line x1="2.5" y1="12" x2="21.5" y2="12" stroke={accent} strokeWidth={2.8} />
        <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" fill="currentColor" stroke="none" />
        <rect x="14" y="7" width="4.5" height="10" rx="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    "align-y-max": (
      <>
        <line x1="3" y1="3.5" x2="21" y2="3.5" stroke={accent} strokeWidth={2.8} />
        <rect x="5.5" y="6.5" width="4.5" height="14" rx="1.2" fill="currentColor" stroke="none" />
        <rect x="14" y="6.5" width="4.5" height="8.5" rx="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    "align-z-min": (
      <>
        <line x1="3" y1="20.5" x2="21" y2="20.5" stroke={accent} strokeWidth={2.8} />
        <rect x="5.5" y="4.5" width="4.5" height="13" rx="1.2" fill="currentColor" stroke="none" />
        <rect x="14" y="10" width="4.5" height="7.5" rx="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    "align-z-center": (
      <>
        <line x1="2.5" y1="12" x2="21.5" y2="12" stroke={accent} strokeWidth={2.8} />
        <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" fill="currentColor" stroke="none" />
        <rect x="14" y="7.5" width="4.5" height="9" rx="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    "align-z-max": (
      <>
        <line x1="3" y1="3.5" x2="21" y2="3.5" stroke={accent} strokeWidth={2.8} />
        <rect x="5.5" y="6.5" width="4.5" height="13" rx="1.2" fill="currentColor" stroke="none" />
        <rect x="14" y="6.5" width="4.5" height="7.5" rx="1.2" fill="currentColor" stroke="none" />
      </>
    ),
    box: (
      <>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </>
    ),
    roundedBox: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <rect x="7" y="7" width="10" height="10" rx="2.5" />
      </>
    ),
    cylinder: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </>
    ),
    sphere: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="9" ry="3.5" />
      </>
    ),
    hemisphere: (
      <>
        <path d="M3 15a9 9 0 0 1 18 0" />
        <ellipse cx="12" cy="15" rx="9" ry="3" />
      </>
    ),
    cone: (
      <>
        <path d="M12 3L4 19c0 1.5 3.6 2.5 8 2.5s8-1 8-2.5L12 3z" />
      </>
    ),
    pyramid: (
      <>
        <polygon points="12 3 3 18 12 21 21 18 12 3" />
        <line x1="12" y1="3" x2="12" y2="21" />
      </>
    ),
    prism: (
      <>
        <polygon points="12 2 20 7 20 17 12 22 4 17 4 7 12 2" />
      </>
    ),
    torus: (
      <>
        <ellipse cx="12" cy="12" rx="9" ry="5" />
        <ellipse cx="12" cy="12" rx="3.5" ry="1.8" />
      </>
    ),
    tube: (
      <>
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <ellipse cx="12" cy="6" rx="4" ry="1.5" />
        <path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      </>
    ),
    wedge: <polygon points="4 19 20 19 4 5 4 19" />,
    arch: <path d="M4 20V11a8 8 0 0 1 16 0v9h-5v-8a3 3 0 0 0-6 0v8H4z" />,
    svgFile: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <circle cx="10" cy="14" r="2" />
        <path d="M14 16l2-3 2 3" />
      </>
    ),
    x: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
  }

  return map[name] ? <svg {...p}>{map[name]}</svg> : null
}

export function SwatchCircle({
  isHole,
  color,
  size = 14,
}: {
  isHole?: boolean
  color: string
  size?: number
}) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 99,
        backgroundColor: isHole ? "rgba(252, 165, 165, 0.22)" : color,
        border: isHole
          ? "1.6px solid #FCA5A5"
          : "1.5px solid rgba(255,255,255,0.68)",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      {isHole && (
        <span
          style={{
            position: "absolute",
            right: -3.5,
            bottom: -3.5,
            width: 8.5,
            height: 8.5,
            borderRadius: 99,
            backgroundColor: "#EF4444",
            border: "1px solid #0F172A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              width: 4.5,
              height: 1.4,
              backgroundColor: "#FFFFFF",
              borderRadius: 1,
            }}
          />
        </span>
      )}
    </span>
  )
}
