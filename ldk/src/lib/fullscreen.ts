import { useCallback, useEffect, useState } from "react"

type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

const doc = document as WebkitDocument

/** iPhone の Safari は要素の全画面表示に未対応 (false) なので、UI を隠すだけの没入表示にする */
export const NATIVE_FULLSCREEN = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled)

const fullscreenElement = () => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null

/** 全画面 (UI を隠した没入表示)。対応ブラウザではブラウザ自体の全画面表示も併用する */
export function useFullscreen() {
  const [full, setFull] = useState(false)

  useEffect(() => {
    const f = () => {
      if (!fullscreenElement()) setFull(false)
    }
    document.addEventListener("fullscreenchange", f)
    document.addEventListener("webkitfullscreenchange", f)
    return () => {
      document.removeEventListener("fullscreenchange", f)
      document.removeEventListener("webkitfullscreenchange", f)
    }
  }, [])

  const enter = useCallback(async () => {
    setFull(true)
    if (!NATIVE_FULLSCREEN || fullscreenElement()) return
    const root = document.documentElement as WebkitElement
    try {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: "hide" })
      else await root.webkitRequestFullscreen?.()
    } catch {
      // 拒否されても没入表示は続ける
    }
  }, [])

  const exit = useCallback(async () => {
    setFull(false)
    if (!fullscreenElement()) return
    try {
      if (document.exitFullscreen) await document.exitFullscreen()
      else await doc.webkitExitFullscreen?.()
    } catch {
      // すでに解除済み
    }
  }, [])

  return { full, enter, exit, toggle: full ? exit : enter }
}
