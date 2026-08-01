/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║        BEZIER CURVE ENGINE — Human Mouse Movement Simulator          ║
 * ║                                                                      ║
 * ║  Real humans don't move mouse in straight lines.                     ║
 * ║  This generates curved paths with natural hesitation + micro-tremors ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export interface Point {
  x: number;
  y: number;
}

export interface MouseMoveOptions {
  /** Number of intermediate points on the curve (higher = smoother but slower) */
  steps?: number;
  /** Max pixel jitter/tremor added to each step (human hands shake slightly) */
  jitter?: number;
  /** Min milliseconds between each step */
  minStepMs?: number;
  /** Max milliseconds between each step */
  maxStepMs?: number;
  /** Probability (0-1) of a micro-pause mid-movement (hesitation) */
  hesitationChance?: number;
  /** Duration of a hesitation pause in ms */
  hesitationMs?: [number, number]; // [min, max]
}

/**
 * Generate a cubic Bezier curve from point A to point B.
 * Control points are randomized to produce natural-looking curves.
 *
 * @param start     Starting point
 * @param end       Ending point
 * @param steps     Number of interpolation steps
 * @returns         Array of points along the curved path
 */
export function generateBezierPath(start: Point, end: Point, steps = 30): Point[] {
  // Random control points — offset from the midpoint to create curve
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  // Perpendicular offset for curve shape (human-like arc)
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const perpX = -dy / len;
  const perpY = dx / len;

  // Control points: offset perpendicular to path + some randomness
  const cp1Offset = (Math.random() - 0.5) * len * 0.3;
  const cp2Offset = (Math.random() - 0.5) * len * 0.3;

  const cp1: Point = {
    x: midX * 0.4 + end.x * 0.1 + perpX * cp1Offset + (Math.random() - 0.5) * 20,
    y: midY * 0.4 + end.y * 0.1 + perpY * cp1Offset + (Math.random() - 0.5) * 20,
  };
  const cp2: Point = {
    x: midX * 0.6 + end.x * 0.4 + perpX * cp2Offset + (Math.random() - 0.5) * 20,
    y: midY * 0.6 + end.y * 0.4 + perpY * cp2Offset + (Math.random() - 0.5) * 20,
  };

  const path: Point[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;

    // Cubic Bezier formula: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
    const x =
      mt * mt * mt * start.x +
      3 * mt * mt * t * cp1.x +
      3 * mt * t * t * cp2.x +
      t * t * t * end.x;
    const y =
      mt * mt * mt * start.y +
      3 * mt * mt * t * cp1.y +
      3 * mt * t * t * cp2.y +
      t * t * t * end.y;

    path.push({ x: Math.round(x), y: Math.round(y) });
  }

  return path;
}

/**
 * Add natural jitter/tremor to a point (human hands shake slightly).
 */
export function addJitter(point: Point, maxJitter = 2): Point {
  return {
    x: point.x + (Math.random() - 0.5) * maxJitter * 2,
    y: point.y + (Math.random() - 0.5) * maxJitter * 2,
  };
}

/**
 * Generate a random offset click position (humans don't click exact center).
 * Returns a position slightly off-center from the target element.
 */
export function humanClickOffset(elementWidth = 100, elementHeight = 40): Point {
  // Click within central 60% of element (avoid edges)
  const margin = 0.2;
  return {
    x: elementWidth * (margin + Math.random() * (1 - 2 * margin)),
    y: elementHeight * (margin + Math.random() * (1 - 2 * margin)),
  };
}

/**
 * Simulate human-like mouse movement on a Puppeteer page.
 * Moves along a Bezier curve with jitter and occasional hesitations.
 *
 * @param page      Puppeteer page object
 * @param from      Starting coordinates
 * @param to        Target coordinates
 * @param options   Mouse movement options
 */
export async function humanMouseMove(
  page: { mouse: { move: (x: number, y: number) => Promise<void> } },
  from: Point,
  to: Point,
  options: MouseMoveOptions = {},
): Promise<void> {
  const {
    steps = 25 + Math.floor(Math.random() * 20), // 25–45 steps
    jitter = 1.5,
    minStepMs = 8,
    maxStepMs = 25,
    hesitationChance = 0.15, // 15% chance of mid-move pause
    hesitationMs = [100, 400],
  } = options;

  const path = generateBezierPath(from, to, steps);

  for (let i = 0; i < path.length; i++) {
    const point = addJitter(path[i], jitter);

    // Move mouse to this point
    await page.mouse.move(point.x, point.y);

    // Occasional hesitation (human-like pause mid-movement)
    if (i > 0 && i < path.length - 1 && Math.random() < hesitationChance) {
      const pauseMs =
        hesitationMs[0] + Math.floor(Math.random() * (hesitationMs[1] - hesitationMs[0]));
      await sleep(pauseMs);
    } else {
      // Variable step speed (easing: slower at start/end, faster in middle)
      const progress = i / path.length;
      const easing = 1 - Math.abs(2 * progress - 1) * 0.5; // 0.5 → 1 → 0.5
      const stepMs = minStepMs + (maxStepMs - minStepMs) * (1 - easing) + Math.random() * 5;
      await sleep(stepMs);
    }
  }
}

/**
 * Simulate a human click: move → hover briefly → click.
 */
export async function humanClick(
  page: {
    mouse: {
      move: (x: number, y: number) => Promise<void>;
      click: (x: number, y: number) => Promise<void>;
    };
  },
  target: Point,
  currentPos: Point = { x: 0, y: 0 },
): Promise<void> {
  // Slightly off-center target (human inaccuracy)
  const clickTarget: Point = {
    x: target.x + (Math.random() - 0.5) * 8,
    y: target.y + (Math.random() - 0.5) * 6,
  };

  // Move to target along Bezier path
  await humanMouseMove(page, currentPos, clickTarget);

  // Brief hover before click (50–200ms)
  await sleep(50 + Math.random() * 150);

  // Click
  await page.mouse.click(clickTarget.x, clickTarget.y);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
