import {
  baseDimCmFromGeometry,
  cloneGeometryWithScale,
  findConnectedComponents,
} from "../three/geometryOps"
import { SceneObject, TransformHome } from "../types/editor"

export const IDENTITY_TRANSFORM_HOME: TransformHome = {
  scale: { sx: 1, sy: 1, sz: 1 },
  pos: { x: 0, y: 0, z: 0 },
  rot: { x: 0, y: 0, z: 0 },
}

export function getTransformHome(o: SceneObject): TransformHome {
  return o.transformHome ?? IDENTITY_TRANSFORM_HOME
}

export function isScaleAwayFromHome(o: SceneObject): boolean {
  const h = getTransformHome(o).scale
  return (
    Math.abs(o.scale.sx - h.sx) > 1e-4 ||
    Math.abs(o.scale.sy - h.sy) > 1e-4 ||
    Math.abs(o.scale.sz - h.sz) > 1e-4
  )
}

export function isPosAwayFromHome(o: SceneObject): boolean {
  const h = getTransformHome(o).pos
  return (
    Math.abs(o.pos.x - h.x) > 1e-3 ||
    Math.abs(o.pos.y - h.y) > 1e-3 ||
    Math.abs(o.pos.z - h.z) > 1e-3
  )
}

export function isRotAwayFromHome(o: SceneObject): boolean {
  const h = getTransformHome(o).rot
  return (
    Math.abs(o.rot.x - h.x) > 1e-4 ||
    Math.abs(o.rot.y - h.y) > 1e-4 ||
    Math.abs(o.rot.z - h.z) > 1e-4
  )
}

export function acceptScaleAsHome(o: SceneObject): SceneObject {
  const home = getTransformHome(o)
  const { sx, sy, sz } = o.scale
  const geometry = cloneGeometryWithScale(o.geometry, sx, sy, sz)
  return {
    ...o,
    geometry,
    baseDim: baseDimCmFromGeometry(geometry),
    partCount: findConnectedComponents(geometry).length,
    scale: { sx: 1, sy: 1, sz: 1 },
    transformHome: {
      ...home,
      scale: { sx: 1, sy: 1, sz: 1 },
    },
  }
}

export function acceptPosAsHome(o: SceneObject): SceneObject {
  const home = getTransformHome(o)
  return {
    ...o,
    transformHome: {
      ...home,
      pos: { ...o.pos },
    },
  }
}

export function acceptRotAsHome(o: SceneObject): SceneObject {
  const home = getTransformHome(o)
  return {
    ...o,
    transformHome: {
      ...home,
      rot: { ...o.rot },
    },
  }
}