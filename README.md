# ADIVI 3D Studio (Standalone Web App)

Lightweight browser CAD & 3D print preparation studio with boolean CSG operations, multi-color SVG extrusion, STEP/3MF/STL import, and binary STL export.

## Quick Start

```bash
npm install
npm run dev
```

## Build for Production / Online Hosting

```bash
npm run build
```

Upload the generated `dist/` folder to Vercel, Netlify, Cloudflare Pages, or any static hosting (e.g. `studio.adivi.pl`), or embed it in Framer via an `<iframe>`.

### Optional URL Query Parameters
- `?model=https://example.com/part.stl&name=Part` — auto-load an initial STL/3MF/STEP/SVG file
- `?bg=#0F172A&accent=#0D9488` — customize theme colors via URL

## Folder Structure
- `src/types/editor.ts` — Shared TypeScript interfaces (`SceneObject`, `EditorProps`, etc.)
- `src/constants/editorConfig.ts` — App constants, color palette, default settings
- `src/utils/format.ts` — Formatting, IDs, blob download
- `src/utils/projectStorage.ts` — IndexedDB autosave & `.adiv` JSON serialization
- `src/utils/fileLoaders.ts` — SVG multi-color extrusion, 3MF parser, lazy STEP (OCCT) decoder
- `src/three/geometryOps.ts` — Parametric primitives, fillet/chamfer box, CSG booleans, mesh decimation, coplanar face detection, split/merge
- `src/three/sceneHelpers.ts` — Build plate grid, 18 cm scale banana, selection brackets, bed contact highlight
- `src/three/gizmo.ts` — Move / Rotate / Scale 3D viewport gizmo
- `src/components/` — Modular UI panels, modals, context menu, icons, and 3D viewport
