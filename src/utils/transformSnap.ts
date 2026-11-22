/** 0.5 mm steps; position & scale size inputs use centimetres (0.05 cm). */
export const SNAP_CM_STEP = 0.05
export const SNAP_ROTATION_DEG_STEP = 5

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
  enabled: boolean
) {
  const target = startCm + deltaCm
  return enabled ? snapCm(target) : target
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

/** Total rotation delta from drag start; snap in 5° steps when enabled. */
export function snapRotationDeltaDeg(rawDeltaDeg: number, enabled: boolean) {
  if (!enabled) return rawDeltaDeg
  return (
    Math.round(rawDeltaDeg / SNAP_ROTATION_DEG_STEP) * SNAP_ROTATION_DEG_STEP
  )
}

export function gizmoSnapEnabled(
  e: Pick<PointerEvent, "ctrlKey" | "altKey" | "metaKey">
) {
  return !(e.ctrlKey || e.altKey || e.metaKey)
}