import type { PoseFrame, PosePerson, PosePoint } from '../viewer/PoseViewer'

type RenderOptions = {
  width?: number
  height?: number
  backgroundColor?: string
  bodyStickWidth?: number
  handStickWidth?: number
  jointRadius?: number
  drawHands?: boolean
  drawHead?: boolean
}

const BODY_POINT_PAIR_A = [0, 6, 6, 8, 10, 5, 7, 9, 12, 14, 16, 11, 13, 15, 2, 1, 4, 3, 17, 20]
const BODY_POINT_PAIR_B = [0, 5, 6, 8, 10, 5, 7, 9, 12, 14, 16, 11, 13, 15, 2, 1, 4, 3, 18, 21]

// Limb order from draw_aapose_new (1-indexed in the original; converted to 0-index here).
const BODY_LIMBS: Array<[number, number]> = [
  [1, 2],
  [1, 5],
  [2, 3],
  [3, 4],
  [5, 6],
  [6, 7],
  [1, 8],
  [8, 9],
  [9, 10],
  [1, 11],
  [11, 12],
  [12, 13],
  [1, 0],
  [0, 14],
  [14, 16],
  [0, 15],
  [15, 17],
  [13, 18],
  [10, 19],
]

const HAND_EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
]

const BODY_COLORS: Array<[number, number, number]> = [
  [255, 0, 0],
  [255, 85, 0],
  [255, 170, 0],
  [255, 255, 0],
  [170, 255, 0],
  [85, 255, 0],
  [0, 255, 0],
  [0, 255, 85],
  [0, 255, 170],
  [0, 255, 255],
  [0, 170, 255],
  [0, 85, 255],
  [0, 0, 255],
  [85, 0, 255],
  [170, 0, 255],
  [255, 0, 255],
  [255, 0, 170],
  [255, 0, 85],
  [255, 0, 0],
]

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)

  let r = 0
  let g = 0
  let b = 0

  switch (i % 6) {
    case 0:
      r = v
      g = t
      b = p
      break
    case 1:
      r = q
      g = v
      b = p
      break
    case 2:
      r = p
      g = v
      b = t
      break
    case 3:
      r = p
      g = q
      b = v
      break
    case 4:
      r = t
      g = p
      b = v
      break
    case 5:
      r = v
      g = p
      b = q
      break
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function colorToRgba(color: [number, number, number], alpha = 1) {
  return `rgba(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])}, ${alpha})`
}

function isJointValid(person: PosePerson, index: number) {
  const mask = person.valid
  if (Array.isArray(mask) && index < mask.length) {
    const value = mask[index]
    return value === true || value === 1 || (typeof value === 'number' && value > 0.01)
  }
  return true
}

function averagePoints(a: PosePoint | undefined, b: PosePoint | undefined): PosePoint {
  if (!a && !b) return [0, 0, 0]
  if (!a) return [b![0], b![1], b![2]]
  if (!b) return [a[0], a[1], a[2]]
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5]
}

function splitForAAPose(person: PosePerson) {
  const points = person.points || []
  const bodyPoints: PosePoint[] = []
  const bodyValid: boolean[] = []

  for (let i = 0; i < BODY_POINT_PAIR_A.length; i++) {
    const aIdx = BODY_POINT_PAIR_A[i]
    const bIdx = BODY_POINT_PAIR_B[i]
    const a = points[aIdx]
    const b = points[bIdx]
    bodyPoints.push(averagePoints(a, b))
    bodyValid.push(isJointValid(person, aIdx) && isJointValid(person, bIdx))
  }

  const leftHandPoints = points.slice(91, 112)
  const rightHandPoints = points.slice(112, 133)
  const leftHandValid = leftHandPoints.map((_, i) => isJointValid(person, 91 + i))
  const rightHandValid = rightHandPoints.map((_, i) => isJointValid(person, 112 + i))

  return {
    bodyPoints,
    bodyValid,
    leftHandPoints,
    rightHandPoints,
    leftHandValid,
    rightHandValid,
  }
}

function makeProjector(allPoints: Array<[number, number]>, width: number, height: number) {
  if (!allPoints.length) {
    return (pt: PosePoint) => ({
      x: width * 0.5 + pt[0] * width * 0.4,
      y: height * 0.5 - pt[1] * height * 0.4,
    })
  }
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  allPoints.forEach(([x, y]) => {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  })

  const spanX = Math.max(maxX - minX, 1e-4)
  const spanY = Math.max(maxY - minY, 1e-4)
  const span = Math.max(spanX, spanY)
  const pad = span * 0.3
  const scale = Math.min(width / (span + pad * 2), height / (span + pad * 2))
  const cx = (minX + maxX) * 0.5
  const cy = (minY + maxY) * 0.5

  return (pt: PosePoint) => ({
    x: width * 0.5 + (pt[0] - cx) * scale,
    y: height * 0.5 - (pt[1] - cy) * scale,
  })
}

function collectVisiblePoints(points: PosePoint[], valid: boolean[], sink: Array<[number, number]>, skip?: Set<number>) {
  points.forEach((pt, idx) => {
    if (skip?.has(idx) || !valid[idx]) return
    sink.push([pt[0], pt[1]])
  })
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  projector: (pt: PosePoint) => { x: number; y: number },
  points: PosePoint[],
  valid: boolean[],
  lineWidth: number,
  jointRadius: number,
  limbs: Array<[number, number]>,
  hiddenJoints: Set<number>
) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  limbs.forEach(([aIdx, bIdx], limbIndex) => {
    if (!valid[aIdx] || !valid[bIdx]) return
    const a = projector(points[aIdx])
    const b = projector(points[bIdx])
    ctx.strokeStyle = colorToRgba(BODY_COLORS[limbIndex % BODY_COLORS.length])
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  })

  points.forEach((pt, idx) => {
    if (hiddenJoints.has(idx) || !valid[idx]) return
    const pos = projector(pt)
    ctx.fillStyle = colorToRgba(BODY_COLORS[idx % BODY_COLORS.length])
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, jointRadius, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  projector: (pt: PosePoint) => { x: number; y: number },
  points: PosePoint[],
  valid: boolean[],
  lineWidth: number,
  jointRadius: number
) {
  const edgeCount = HAND_EDGES.length
  HAND_EDGES.forEach((edge, idx) => {
    const [aIdx, bIdx] = edge
    if (!valid[aIdx] || !valid[bIdx]) return
    const a = projector(points[aIdx])
    const b = projector(points[bIdx])
    const color = hsvToRgb(idx / edgeCount, 1, 1)
    ctx.strokeStyle = colorToRgba(color)
    ctx.lineWidth = lineWidth
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  })

  points.forEach((pt, idx) => {
    if (!valid[idx]) return
    const pos = projector(pt)
    const color = hsvToRgb(idx / points.length, 1, 1)
    ctx.fillStyle = colorToRgba(color)
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, jointRadius, 0, Math.PI * 2)
    ctx.fill()
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

export async function renderKijaiPoseFrame(frame: PoseFrame, options: RenderOptions = {}): Promise<Blob | null> {
  const width = Math.max(64, Math.floor(options.width || options.height || 1024))
  const height = Math.max(64, Math.floor(options.height || options.width || 1024))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = options.backgroundColor || 'black'
  ctx.fillRect(0, 0, width, height)

  const people = frame.people || []
  if (!people.length) {
    return canvasToBlob(canvas)
  }

  const drawHands = options.drawHands !== false
  const drawHead = options.drawHead !== false
  const headIndices = new Set<number>()
  if (!drawHead) {
    ;[0, 14, 15, 16, 17].forEach((idx) => headIndices.add(idx))
  }
  const bodyLimbs = drawHead ? BODY_LIMBS : BODY_LIMBS.filter(([a, b]) => !headIndices.has(a) && !headIndices.has(b))

  const processed = people.map((person) => splitForAAPose(person))
  const allPoints: Array<[number, number]> = []
  processed.forEach((entry) => {
    collectVisiblePoints(entry.bodyPoints, entry.bodyValid, allPoints, headIndices)
    collectVisiblePoints(entry.leftHandPoints, entry.leftHandValid, allPoints)
    collectVisiblePoints(entry.rightHandPoints, entry.rightHandValid, allPoints)
  })

  const projector = makeProjector(allPoints, width, height)
  const baseWidth = Math.min(width, height)
  const bodyLineWidth = options.bodyStickWidth || Math.max(4, baseWidth * 0.018)
  const handLineWidth = options.handStickWidth || Math.max(3, bodyLineWidth * 0.65)
  const jointRadius = options.jointRadius || bodyLineWidth * 0.42

  processed.forEach((entry) => {
    drawBody(ctx, projector, entry.bodyPoints, entry.bodyValid, bodyLineWidth, jointRadius, bodyLimbs, headIndices)
    if (drawHands) {
      drawHand(ctx, projector, entry.leftHandPoints, entry.leftHandValid, handLineWidth, jointRadius * 0.6)
      drawHand(ctx, projector, entry.rightHandPoints, entry.rightHandValid, handLineWidth, jointRadius * 0.6)
    }
  })

  return canvasToBlob(canvas)
}
