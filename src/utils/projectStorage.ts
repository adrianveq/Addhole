import * as THREE from "three"
import { IDB_NAME, IDB_STORE } from "../constants/editorConfig"
import { SceneObject } from "../types/editor"
import { findConnectedComponents } from "../three/geometryOps"
import { uid } from "./format"

export function serializeGeometry(geom: THREE.BufferGeometry): number[] {
  const ni = geom.index ? geom.toNonIndexed() : geom
  return Array.from(ni.attributes.position.array as Float32Array)
}

export function deserializeGeometry(coords: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(coords, 3))
  g.computeVertexNormals()
  return g
}

export function serializeProjectPayload(
  objects: SceneObject[],
  gridSizeCm: number,
  gridStepCm: number
) {
  return {
    format: "adivi-3d-project",
    version: 2,
    savedAt: new Date().toISOString(),
    plate: { gridSizeCm, gridStepCm },
    objects: objects.map((o) => ({
      id: o.id,
      name: o.name,
      color: o.color,
      opacity: o.opacity ?? 1,
      isHole: Boolean(o.isHole),
      partCount: o.partCount || 1,
      visible: o.visible !== false,
      scale: { ...o.scale },
      pos: { ...o.pos },
      rot: { ...o.rot },
      baseDim: { ...o.baseDim },
      groupOriginWorld: o.groupOriginWorld ? { ...o.groupOriginWorld } : undefined,
      coords: serializeGeometry(o.geometry),
      groupChildren: o.groupChildren
        ? o.groupChildren.map((c) => ({
            name: c.name,
            color: c.color,
            opacity: c.opacity ?? 1,
            isHole: Boolean(c.isHole),
            visible: c.visible !== false,
            coords: serializeGeometry(c.geometry),
          }))
        : undefined,
    })),
  }
}

export function deserializeProjectPayload(data: any): {
  objects: SceneObject[]
  gridSizeCm: number
  gridStepCm: number
} {
  if (!data || !Array.isArray(data.objects)) {
    throw new Error("Invalid .adiv project file")
  }
  return {
    objects: data.objects.map((raw: any) => {
      const geometry = deserializeGeometry(raw.coords || [])
      return {
        id: raw.id || uid(),
        name: raw.name || "Object",
        color: raw.color || "#E2E8F0",
        opacity: raw.opacity ?? 1,
        isHole: Boolean(raw.isHole),
        partCount: raw.partCount || findConnectedComponents(geometry).length,
        visible: raw.visible !== false,
        geometry,
        baseDim: raw.baseDim || { x: 2, y: 2, z: 2 },
        scale: raw.scale || { sx: 1, sy: 1, sz: 1 },
        pos: raw.pos || { x: 0, y: 0, z: 0 },
        rot: raw.rot || { x: 0, y: 0, z: 0 },
        groupOriginWorld: raw.groupOriginWorld,
        groupChildren: raw.groupChildren
          ? raw.groupChildren.map((c: any) => ({
              name: c.name,
              color: c.color,
              opacity: c.opacity ?? 1,
              isHole: Boolean(c.isHole),
              visible: c.visible !== false,
              geometry: deserializeGeometry(c.coords || []),
            }))
          : undefined,
      }
    }),
    gridSizeCm: data.plate?.gridSizeCm || 25,
    gridStepCm: data.plate?.gridStepCm || 5,
  }
}

async function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveAutosaveToIdb(payload: any): Promise<void> {
  try {
    const db = await openIdb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite")
      tx.objectStore(IDB_STORE).put(payload, "latest")
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    // Ignore storage quota or private mode failures
  }
}

export async function loadAutosaveFromIdb(): Promise<any | null> {
  try {
    const db = await openIdb()
    const res = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly")
      const getReq = tx.objectStore(IDB_STORE).get("latest")
      getReq.onsuccess = () => resolve(getReq.result || null)
      getReq.onerror = () => reject(getReq.error)
    })
    db.close()
    return res
  } catch {
    return null
  }
}
