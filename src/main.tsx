import * as React from "react"
import { createRoot } from "react-dom/client"
import { Adivi3DModelViewer } from "./App"
import "./styles.css"

const params = new URLSearchParams(window.location.search)
const modelUrl = params.get("model") || undefined
const modelName = params.get("name") || undefined
const bgColor = params.get("bg") || undefined
const accentColor = params.get("accent") || undefined
const accentBorder = params.get("accentBorder") || undefined

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Adivi3DModelViewer
      colors={{
        bgColor,
        accentColor,
        accentBorder,
      }}
      initialModel={modelUrl ? { file: modelUrl, name: modelName } : undefined}
    />
  </React.StrictMode>
)
