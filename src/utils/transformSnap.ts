/** 0.5 mm steps; position & scale size inputs use centimetres (0.05 cm). */
export const SNAP_CM_STEP = 0.05
/** Position drag snap while Shift is held (0.5 cm = 5 mm). */
export const SNAP_POSITION_SHIFT_CM_STEP = 0.5
export const SNAP_ROTATION_DEG_STEP = 5
/** Rotation drag snap while Shift is held. */
export const SNAP_ROTATION_SHIFT_DEG_STEP = 15

/** @deprecated alias — scale UI is in cm, not unitless factors */
export const SNAP_SCALE_STEP = SNAP_CM_STEP
export const SNAP_POSITION_CM_STEP = SNAP_CM_STEP

function decimalsForStep(step: number) {
  if (step >= 1) return 0
  const d = -Math.floor(Math.log10(step))
  return Math.min(Math.max(d, 0), 6)
}

export function snapToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || step <= 0) return value
  const snapped = Math.round(value / step) * step
  const places = decimalsForStep(step)
  return places ? Number(snapped.toFixed(places)) : snapped
}

/** Snap a length in centimetres (position or mesh size). */
export const snapCm = (v: number) => snapToStep(v, SNAP_CM_STEP)

export const snapPositionCm = snapCm

export const snapRotationDeg = (v: number) => snapToStep(v, SNAP_ROTATION_DEG_STEP)

/** After position drag: `startCm + deltaCm`, snapped once to the grid. */
export function snapDragPositionCm(
  startCm: number,
  deltaCm: number,
  enabled: boolean,
  stepCm = SNAP_CM_STEP
) {
  const target = startCm + deltaCm
  return enabled ? snapToStep(target, stepCm) : target
}

/** After scale drag: `startSizeCm * factor`, snapped once on the cm size. */
export function snapDragSizeCm(
  startSizeCm: number,
  factor: number,
  enabled: boolean
) {
  const target = startSizeCm * factor
  return enabled ? snapCm(target) : target
}

/** Total rotation delta from drag start; snap in {@link stepDeg} steps when enabled. */
export function snapRotationDeltaDeg(
  rawDeltaDeg: number,
  enabled: boolean,
  stepDeg = SNAP_ROTATION_DEG_STEP
) {
  if (!enabled) return rawDeltaDeg
  return Math.round(rawDeltaDeg / stepDeg) * stepDeg
}

/** Snap policy for rotation drags (Shift → 15°, otherwise default grid when snapping is on). */
export function rotationDragSnap(
  e: Pick<PointerEvent, "shiftKey" | "ctrlKey" | "altKey" | "metaKey">
) {
  if (e.shiftKey) {
    return { enabled: true, stepDeg: SNAP_ROTATION_SHIFT_DEG_STEP }
  }
  const enabled = gizmoSnapEnabled(e)
  return { enabled, stepDeg: SNAP_ROTATION_DEG_STEP }
}

export function gizmoSnapEnabled(
  e: Pick<PointerEvent, "ctrlKey" | "altKey" | "metaKey">
) {
  return !(e.ctrlKey || e.altKey || e.metaKey)
}

/** Snap policy for position drags (Shift → 0.5 cm, otherwise fine grid when snapping is on). */
export function positionDragSnap(
  e: Pick<PointerEvent, "shiftKey" | "ctrlKey" | "altKey" | "metaKey">
) {
  if (e.shiftKey) {
    return { enabled: true, stepCm: SNAP_POSITION_SHIFT_CM_STEP }
  }
  const enabled = gizmoSnapEnabled(e)
  return { enabled, stepCm: SNAP_CM_STEP }
}