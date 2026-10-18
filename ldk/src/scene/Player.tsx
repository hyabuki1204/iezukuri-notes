import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useRef } from "react"
import { type Object3D, type PerspectiveCamera, Raycaster, Vector2 } from "three"
import { doorLeaf, toThree } from "./data"
import { input, moveBy, player, tour } from "./player"
import { LOOK_CURVE, POS_CURVE, TOUR_LENGTH, TOUR_SPEED } from "./tour"

const WALK = 1.25 // m/s
const RUN = 2.4
const TURN = 1.8 // rad/s (矢印キー左右)
const LOOK_SENS = 0.0032
const TAP_STEP = 0.2 // s

function stopTour() {
  if (!tour.playing) return
  tour.playing = false
  tour.onStop.forEach((f) => f())
}

interface Props {
  eyeHeight: number
  fov: number
  /** 360°パノラマ表示中は視点位置を固定 (Blender 座標) */
  anchor?: [number, number, number]
  /** ほぼ動かずに離したとき、視線の先の扉を開閉する */
  onToggleDoor?: (id: string) => void
}

const TAP_SLOP = 8

function chainVisible(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) {
    if (!p.visible) return false
  }
  return true
}

export function Player({ eyeHeight, fov, anchor, onToggleDoor }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const toggleRef = useRef(onToggleDoor)
  toggleRef.current = onToggleDoor
  const raycaster = useRef(new Raycaster())
  const ndc = useRef(new Vector2())

  useEffect(() => {
    input.wake = () => invalidate()
    return () => {
      input.wake = () => {}
    }
  }, [invalidate])

  useEffect(() => {
    camera.fov = fov
    camera.near = 0.03
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, fov, invalidate])

  useEffect(() => invalidate(), [anchor, eyeHeight, invalidate])

  useEffect(() => {
    const el = gl.domElement
    let dragging = false
    let dragged = false
    let lx = 0
    let ly = 0
    let downX = 0
    let downY = 0
    // タッチは景色をつかんで動かす向き (ストリートビュー式)、マウスは視線を動かす向き
    let sign = 1
    const down = (e: PointerEvent) => {
      dragging = true
      dragged = false
      downX = lx = e.clientX
      downY = ly = e.clientY
      sign = e.pointerType === "touch" ? -1 : 1
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      if (!dragged && Math.hypot(e.clientX - downX, e.clientY - downY) < TAP_SLOP) return
      dragged = true
      input.look.dx += sign * (e.clientX - lx)
      input.look.dy += sign * (e.clientY - ly)
      lx = e.clientX
      ly = e.clientY
      invalidate()
    }
    const up = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      const toggle = toggleRef.current
      if (dragged || !toggle) return
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      ndc.current.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.current.setFromCamera(ndc.current, camera)
      const hits = raycaster.current.intersectObjects(scene.children, true)
      for (const h of hits) {
        if (!chainVisible(h.object)) continue
        const leaf = doorLeaf(h.object.name)
        if (leaf) {
          toggle(leaf.id)
          invalidate()
        }
        break
      }
    }
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea")) return
      input.keys.add(e.code)
      if (!e.repeat) input.taps.add(e.code)
      invalidate()
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault()
    }
    const ku = (e: KeyboardEvent) => input.keys.delete(e.code)
    const blur = () => input.keys.clear()
    el.addEventListener("pointerdown", down)
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", up)
    window.addEventListener("keydown", kd)
    window.addEventListener("keyup", ku)
    window.addEventListener("blur", blur)
    return () => {
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", up)
      window.removeEventListener("keydown", kd)
      window.removeEventListener("keyup", ku)
      window.removeEventListener("blur", blur)
    }
  }, [camera, gl, invalidate, scene])

  useFrame((_, rawDt) => {
    const taps = input.taps
    const tapOnly = taps.size > 0 && ![...taps].some((c) => input.keys.has(c))
    // Software-rendered frames can be slower than a key tap; give a released tap one visible step.
    const dt = tapOnly ? TAP_STEP : Math.min(rawDt, 0.05)
    if (input.keys.size > 0 || input.joy.x !== 0 || input.joy.y !== 0 || tour.playing) invalidate()
    const k = new Set([...input.keys, ...taps])
    taps.clear()
    let fwd = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0)
    let side = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0)
    const turn = (k.has("ArrowLeft") || k.has("KeyQ") ? 1 : 0) - (k.has("ArrowRight") || k.has("KeyE") ? 1 : 0)
    fwd += -input.joy.y
    side += input.joy.x
    const lookMoved = input.look.dx !== 0 || input.look.dy !== 0

    if (tour.playing && (anchor || fwd !== 0 || side !== 0 || turn !== 0 || lookMoved)) stopTour()

    if (anchor) {
      player.heading -= input.look.dx * LOOK_SENS - turn * TURN * dt
      player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch - input.look.dy * LOOK_SENS))
      input.look.dx = 0
      input.look.dy = 0
      camera.position.copy(toThree(...anchor))
      camera.rotation.order = "YXZ"
      camera.rotation.set(player.pitch, player.heading - Math.PI / 2, 0)
      return
    }

    if (tour.playing) {
      tour.t += (dt * TOUR_SPEED) / TOUR_LENGTH
      if (tour.t >= 1) {
        tour.t = 1
        stopTour()
      }
      const u = POS_CURVE.getUtoTmapping(tour.t, 0)
      const p = POS_CURVE.getPoint(u)
      const look = LOOK_CURVE.getPoint(u)
      player.x = p.x
      player.y = p.y
      player.heading = Math.atan2(look.y - p.y, look.x - p.x)
      const dist = Math.hypot(look.x - p.x, look.y - p.y)
      player.pitch = Math.atan2(look.z - eyeHeight, dist) * 0.6
    } else {
      player.heading -= input.look.dx * LOOK_SENS - turn * TURN * dt
      player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch - input.look.dy * LOOK_SENS))
      const len = Math.hypot(fwd, side)
      if (len > 0) {
        const speed = (k.has("ShiftLeft") || k.has("ShiftRight") ? RUN : WALK) * Math.min(1, len)
        const f = fwd / Math.max(1, len)
        const s = side / Math.max(1, len)
        const ch = Math.cos(player.heading)
        const sh = Math.sin(player.heading)
        moveBy((ch * f + sh * s) * speed * dt, (sh * f - ch * s) * speed * dt)
      }
    }
    input.look.dx = 0
    input.look.dy = 0

    camera.position.copy(toThree(player.x, player.y, eyeHeight))
    camera.rotation.order = "YXZ"
    camera.rotation.set(player.pitch, player.heading - Math.PI / 2, 0)
  })

  return null
}

export { stopTour }
