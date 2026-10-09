import { Footprints, Pause, Play, RotateCcw } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { DATA, type Settings } from "@/scene/data"
import { QUALITY_LABEL, type Quality } from "@/scene/quality"

type Opt<T extends string | number> = { value: T; label: string }

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: Opt<T>[]
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <ToggleGroup
      value={[String(value)]}
      onValueChange={(v: string[]) => {
        const next = options.find((o) => String(o.value) === v[0])
        if (next) onChange(next.value)
      }}
      disabled={disabled}
      spacing={0}
      variant="outline"
      size="sm"
      className="w-full"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={String(o.value)}
          value={String(o.value)}
          className="flex-1 aria-pressed:bg-white aria-pressed:text-neutral-950 aria-pressed:hover:bg-white"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-white/80">{label}</span>
        {hint && <span className="text-[11px] text-white/45">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const QUALITY_HINT: Record<Quality, string> = {
  low: "軽量 (スマホ向け)",
  medium: "焼き込み間接光・柔らかい影",
  ultra: "床の映り込み・柔らかい影まで",
}

interface Props {
  s: Settings
  set: (patch: Partial<Settings>) => void
  touring: boolean
  onTour: () => void
  onPreset: (key: string) => void
  onReset: () => void
  panoAvailable: Record<string, boolean>
  className?: string
}

export function ControlPanel({ s, set, touring, onTour, onPreset, onReset, panoAvailable, className }: Props) {
  const pano = s.mode === "pano"
  const fixedNote = pano ? "360°はキッチン黒・カーテン開・昼で固定" : undefined
  return (
    <div className={cn("space-y-4", className)}>
      <Segmented
        value={s.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: "walk", label: "ウォークスルー" },
          { value: "pano", label: "360° フォトリアル" },
        ]}
      />
      <p className="text-[11px] leading-relaxed text-white/50">
        {pano
          ? "Blender Cycles で書き出した 360° パノラマ。ドラッグで見回し、平面図の番号で地点を移動します。"
          : "リアルタイム表示。WASD / 矢印キーで歩行、ドラッグで見回し、平面図クリックで瞬間移動。"}
      </p>

      <div className="h-px bg-white/10" />

      {!pano && (
        <>
          <Row label="画質" hint={QUALITY_HINT[s.quality]}>
            <Segmented
              value={s.quality}
              onChange={(quality) => set({ quality })}
              options={(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => ({ value: q, label: QUALITY_LABEL[q] }))}
            />
          </Row>
          <Row label="色調" hint="AgX は静止画パースと同じ仕上げ">
            <Segmented
              value={s.tone}
              onChange={(tone) => set({ tone })}
              options={[
                { value: "agx", label: "AgX" },
                { value: "aces", label: "ACES" },
              ]}
            />
          </Row>
          <div className="h-px bg-white/10" />
        </>
      )}

      <Row label="天井高" hint="2.5m / 2.7m を同じ位置で比較">
        <Segmented
          value={s.ceiling}
          onChange={(ceiling) => set({ ceiling })}
          options={[
            { value: 2.5, label: "2,500" },
            { value: 2.7, label: "2,700" },
          ]}
        />
      </Row>
      <Row label="天井仕上げ" hint="軒天は常に木目">
        <Segmented
          value={s.ceilColor}
          onChange={(ceilColor) => set({ ceilColor })}
          options={[
            { value: "wood", label: "木目" },
            { value: "white", label: "白" },
          ]}
        />
      </Row>
      <Row label="キッチン" hint={fixedNote}>
        <Segmented
          value={s.kitchen}
          disabled={pano}
          onChange={(kitchen) => set({ kitchen })}
          options={[
            { value: "black", label: "マットブラック" },
            { value: "white", label: "マットホワイト" },
          ]}
        />
      </Row>
      <div className="grid grid-cols-2 gap-3">
        <Row label="カーテン">
          <Segmented
            value={s.curtain}
            disabled={pano}
            onChange={(curtain) => set({ curtain })}
            options={[
              { value: "open", label: "開" },
              { value: "closed", label: "閉" },
            ]}
          />
        </Row>
        <Row label="時間帯">
          <Segmented
            value={s.time}
            disabled={pano}
            onChange={(time) => set({ time })}
            options={[
              { value: "day", label: "昼" },
              { value: "night", label: "夜" },
            ]}
          />
        </Row>
        <Row label="ハイドア">
          <Segmented
            value={s.doors}
            disabled={pano}
            onChange={(doors) => set({ doors })}
            options={[
              { value: "closed", label: "閉" },
              { value: "open", label: "開" },
            ]}
          />
        </Row>
        <Row label="目線">
          <Segmented
            value={s.eye}
            disabled={pano}
            onChange={(eye) => set({ eye })}
            options={[
              { value: "stand", label: "立 1.5m" },
              { value: "sit", label: "座 1.15m" },
            ]}
          />
        </Row>
      </div>
      <Row label="画角" hint={`${s.fov}°（人の視野に近いのは 60〜70°）`}>
        <Slider value={[s.fov]} min={45} max={95} step={1} onValueChange={(v) => set({ fov: Array.isArray(v) ? v[0] : v })} />
      </Row>

      <div className="h-px bg-white/10" />

      {pano ? (
        <Row label="360° 地点">
          <div className="grid grid-cols-1 gap-1">
            {Object.entries(DATA.panos).map(([k, v], i) => (
              <Button
                key={k}
                size="sm"
                variant={s.pano === k ? "default" : "outline"}
                disabled={panoAvailable[k] === false}
                onClick={() => set({ pano: k })}
                className="justify-start"
              >
                <span className="w-4 text-white/50 tabular-nums">{i + 1}</span>
                {v.label}
                {panoAvailable[k] === false && <span className="ml-auto text-[10px] text-white/40">レンダリング待ち</span>}
              </Button>
            ))}
          </div>
        </Row>
      ) : (
        <Row label="パース視点（静止画と同じアングル）">
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(DATA.cameras).map(([k, c], i) => (
              <Button key={k} size="sm" variant="outline" onClick={() => onPreset(k)} className="h-auto justify-start py-1.5 text-left whitespace-normal">
                <span className="text-white/50 tabular-nums">{"①②③④⑤⑥"[i]}</span>
                <span className="text-[11px] leading-snug">{c.label}</span>
              </Button>
            ))}
          </div>
          <div className="flex gap-1.5 pt-1">
            <Button size="sm" onClick={onTour} className="flex-1">
              {touring ? <Pause /> : <Play />}
              {touring ? "ツアーを止める" : "自動ウォークツアー"}
            </Button>
            <Button size="sm" variant="outline" onClick={onReset} aria-label="視点をリセット">
              <RotateCcw />
            </Button>
          </div>
        </Row>
      )}
      {!pano && (
        <p className="flex items-center gap-1.5 text-[11px] text-white/40">
          <Footprints className="size-3.5" /> Shift で早歩き ・ Q/E で旋回
        </p>
      )}
    </div>
  )
}
