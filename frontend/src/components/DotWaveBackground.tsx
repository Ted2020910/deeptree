import { useRef, useEffect } from 'react'

// ─── Config ───
const GAP = 20
const AMP1 = 6
const AMP2 = 4
const AMP3 = 2.5
const FREQ1 = 0.04
const FREQ2 = 0.065
const FREQ3 = 0.03
const SPEED1 = 0.0008
const SPEED2 = -0.0006
const SPEED3 = 0.0004
const PHASE_ROW = 0.15
const MIN_OPACITY = 0.06
const MAX_OPACITY = 0.28
const MIN_RADIUS = 1.0
const MAX_RADIUS = 2.8

function lerp(t: number, a: number, b: number) {
  return a + t * (b - a)
}

export function DotWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const reducedMotion = useRef(false)
  const dotRgb = useRef('255,255,255')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Read theme color
    function readDotColor() {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue('--dot-wave-rgb').trim()
      if (val) dotRgb.current = val
    }
    readDotColor()

    // Watch for theme changes on <html>
    const mo = new MutationObserver(() => readDotColor())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    // Check prefers-reduced-motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.current = mq.matches
    const onMqChange = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches }
    mq.addEventListener('change', onMqChange)

    // Sizing
    const parent = canvas.parentElement!
    let w = 0, h = 0, cols = 0, rows = 0
    const dpr = Math.min(window.devicePixelRatio, 2)

    function resize() {
      w = parent.clientWidth
      h = parent.clientHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      canvas!.style.width = w + 'px'
      canvas!.style.height = h + 'px'
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(w / GAP) + 2
      rows = Math.ceil(h / GAP) + 2
    }

    const ro = new ResizeObserver(resize)
    ro.observe(parent)
    resize()

    let frame = 0

    function draw(time: number) {
      frame++
      if (frame % 2 !== 0 && !reducedMotion.current) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      ctx!.clearRect(0, 0, w, h)

      const t = reducedMotion.current ? 0 : time
      const rgb = dotRgb.current

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const baseX = col * GAP
          const baseY = row * GAP

          const wave1 = Math.sin(col * FREQ1 + t * SPEED1 + row * PHASE_ROW) * AMP1
          const wave2 = Math.sin(col * FREQ2 + t * SPEED2 + row * PHASE_ROW * 0.7) * AMP2
          const wave3 = Math.sin((col + row) * FREQ3 + t * SPEED3) * AMP3

          const yOffset = wave1 + wave2 + wave3
          const totalAmp = AMP1 + AMP2 + AMP3
          const norm = (yOffset + totalAmp) / (totalAmp * 2)

          const opacity = lerp(norm, MIN_OPACITY, MAX_OPACITY)
          const radius = lerp(norm, MIN_RADIUS, MAX_RADIUS)

          ctx!.beginPath()
          ctx!.arc(baseX, baseY + yOffset, radius, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(${rgb},${opacity})`
          ctx!.fill()
        }
      }

      if (!reducedMotion.current) {
        rafRef.current = requestAnimationFrame(draw)
      }
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      mo.disconnect()
      mq.removeEventListener('change', onMqChange)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="dot-wave-canvas"
      aria-hidden="true"
    />
  )
}
