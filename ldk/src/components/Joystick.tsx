import { useRef, useState } from "react"
import { input } from "@/scene/player"

const R = 48

/** タッチ端末用の移動スティック (左手) */
export function Joystick() {
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const origin = useRef<{ x: number; y: number } | null>(null)

  const update = (cx: number, cy: number) => {
    if (!origin.current) return
    let dx = cx - origin.current.x
    let dy = cy - origin.current.y
    const len = Math.hypot(dx, dy)
    if (len > R) {
      dx = (dx / len) * R
      dy = (dy / len) * R
    }
    setKnob({ x: dx, y: dy })
    input.joy.x = dx / R
    input.joy.y = dy / R
    input.wake()
  }
  const end = () => {
    origin.current = null
    setKnob({ x: 0, y: 0 })
    input.joy.x = 0
    input.joy.y = 0
  }

  return (
    <div
      className="relative size-32 touch-none rounded-full border border-white/20 bg-black/35 backdrop-blur-md"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        e.currentTarget.setPointerCapture(e.pointerId)
        update(e.clientX, e.clientY)
      }}
      onPointerMove={(e) => update(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="移動スティック"
    >
      <div
        className="absolute top-1/2 left-1/2 size-12 -translate-1/2 rounded-full bg-white/70 shadow-lg"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  )
}
