import { LengthUnit, ScaleDimUnit } from "../types/editor"
import { SNAP_CM_STEP, snapCm } from "./transformSnap"

/** Display step for length inputs (values are shown in cm or mm). */
export const SNAP_MM_STEP = SNAP_CM_STEP * 10

export function lengthFromDisplay(value: number, unit: LengthUnit): number {
  return unit === "mm" ? value * 0.1 : value
}

export function lengthToDisplay(cm: number, unit: LengthUnit): number {
  return unit === "mm" ? cm * 10 : cm
}

export function snapLengthFromDisplay(
  display: number,
  unit: LengthUnit,
  fine: boolean
): number {
  const cm = lengthFromDisplay(display, unit)
  const snappedCm = fine ? cm : snapCm(cm)
  return lengthToDisplay(snappedCm, unit)
}

export function lengthStep(unit: LengthUnit): number {
  return unit === "mm" ? SNAP_MM_STEP : SNAP_CM_STEP
}

export function scaleSizeToDisplay(
  sizeCm: number,
  baseDimCm: number,
  unit: ScaleDimUnit
): number {
  if (unit === "%") return (sizeCm / baseDimCm) * 100
  return lengthToDisplay(sizeCm, unit)
}

export function scaleFactorFromDisplay(
  display: number,
  baseDimCm: number,
  unit: ScaleDimUnit
): number {
  if (unit === "%") return display / 100
  return lengthFromDisplay(display, unit) / baseDimCm
}