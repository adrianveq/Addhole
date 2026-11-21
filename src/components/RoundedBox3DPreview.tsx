import * as React from "react"
import * as THREE from "three"
import { BevelMode } from "../types/editor"
import { createRoundedBoxGeometry } from "../three/geometryOps"

export function RoundedBox3DPreview({
  dimCm,
  bevelMm,
  mode,
  accentBorder,
}: {
  dimCm: { x: number; y: number; z: number }
  bevelMm: number
  mode: BevelMode
  accentBorder: string
}) {
  const mountRef = React.useRef<HTMLDivElement>(null)
  const meshRef = React.useRef<THREE.Mesh | null>(null)
  const edgeRef = React.useRef<THREE.LineSegments | null>(null)

  React.useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(34, 1, 0.1, 200)
    cam.up.set(0, 0, 1)
    cam.position.set(34, -38, 28)
    cam.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(150, 150)
    el.innerHTML = ""
    el.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 1.1)
    key.position.set(-25, -35, 45)
    const rim = new THREE.DirectionalLight(0x5eead4, 0.55)
    rim.position.set(30, 25, -15)
    scene.add(key, rim)

    const geom = createRoundedBoxGeometry({ x: 20, y: 20, z: 20 }, 2.5, "fillet")
    geom.center()
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({
        color: 0x14b8a6,
        roughness: 0.42,
        metalness: 0.08,
      })
    )
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom, 24),
      new THREE.LineBasicMaterial({
        color: accentBorder,
        transparent: true,
        opacity: 0.55,
      })
    )
    mesh.add(edges)
    scene.add(mesh)
    meshRef.current = mesh
    edgeRef.current = edges

    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      mesh.rotation.z += 0.012
      renderer.render(scene, cam)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      mesh.geometry.dispose()
      edges.geometry.dispose()
      renderer.dispose()
    }
  }, [accentBorder])

  React.useEffect(() => {
    const mesh = meshRef.current
    const edges = edgeRef.current
    if (!mesh || !edges) return
    const sx = Math.max(0.2, dimCm.x)
    const sy = Math.max(0.2, dimCm.y)
    const sz = Math.max(0.2, dimCm.z)
    const normScale = 22 / Math.max(sx, sy, sz)
    const nextGeom = createRoundedBoxGeometry(
      { x: sx * normScale, y: sy * normScale, z: sz * normScale },
      bevelMm * (normScale / 10),
      mode
    )
    nextGeom.center()
    mesh.geometry.dispose()
    mesh.geometry = nextGeom
    edges.geometry.dispose()
    edges.geometry = new THREE.EdgesGeometry(nextGeom, 24)
  }, [dimCm.x, dimCm.y, dimCm.z, bevelMm, mode])

  return (
    <div
      ref={mountRef}
      style={{
        width: 150,
        height: 150,
        borderRadius: 6,
        backgroundColor: "rgba(2, 6, 23, 0.65)",
        border: "1px solid rgba(255,255,255,0.1)",
        overflow: "hidden",
      }}
    />
  )
}
