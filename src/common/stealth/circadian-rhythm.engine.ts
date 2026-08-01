/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║      CIRCADIAN RHYTHM ENGINE — Human Sleep & Activity Scheduler      ║
 * ║                                                                      ║
 * ║  Humans don't send messages at 3 AM.                                 ║
 * ║  This engine mimics natural human activity patterns:                 ║
 * ║   - Morning rush (8-10 AM): high activity                            ║
 * ║   - Lunch break (12-2 PM): moderate activity                         ║
 * ║   - Evening (6-9 PM): peak activity                                  ║
 * ║   - Night (11 PM - 7 AM): sleep mode (minimal/no sending)            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export interface ActivityWindow {
  /** Hour of day (0–23) */
  hour: number;
  /** Activity probability weight (0.0 – 1.0) */
  weight: number;
  /** Delay multiplier applied to inter-message gaps during this hour */
  delayMultiplier: number;
}

/**
 * Human activity pattern by hour of day.
 * Weights represent relative likelihood of sending a message.
 * Based on WhatsApp/SMS usage statistics.
 */
export const HUMAN_ACTIVITY_PATTERN: ActivityWindow[] = [
  { hour: 0,  weight: 0.05, delayMultiplier: 5.0 },  // Midnight — almost nobody awake
  { hour: 1,  weight: 0.03, delayMultiplier: 6.0 },
  { hour: 2,  weight: 0.02, delayMultiplier: 8.0 },
  { hour: 3,  weight: 0.01, delayMultiplier: 10.0 }, // Deep sleep
  { hour: 4,  weight: 0.01, delayMultiplier: 10.0 },
  { hour: 5,  weight: 0.03, delayMultiplier: 6.0 },
  { hour: 6,  weight: 0.10, delayMultiplier: 3.0 },  // Early risers
  { hour: 7,  weight: 0.35, delayMultiplier: 2.0 },  // Morning wake-up
  { hour: 8,  weight: 0.65, delayMultiplier: 1.2 },  // Morning commute
  { hour: 9,  weight: 0.80, delayMultiplier: 1.0 },  // Work starts
  { hour: 10, weight: 0.75, delayMultiplier: 1.1 },
  { hour: 11, weight: 0.70, delayMultiplier: 1.1 },
  { hour: 12, weight: 0.85, delayMultiplier: 0.9 },  // Lunch peak
  { hour: 13, weight: 0.80, delayMultiplier: 1.0 },
  { hour: 14, weight: 0.65, delayMultiplier: 1.2 },  // Post-lunch dip
  { hour: 15, weight: 0.70, delayMultiplier: 1.1 },
  { hour: 16, weight: 0.75, delayMultiplier: 1.0 },
  { hour: 17, weight: 0.85, delayMultiplier: 0.9 },  // Work ending
  { hour: 18, weight: 0.90, delayMultiplier: 0.85 }, // Evening peak
  { hour: 19, weight: 1.00, delayMultiplier: 0.8 },  // Prime time
  { hour: 20, weight: 0.95, delayMultiplier: 0.85 },
  { hour: 21, weight: 0.80, delayMultiplier: 1.0 },
  { hour: 22, weight: 0.55, delayMultiplier: 1.5 },  // Winding down
  { hour: 23, weight: 0.25, delayMultiplier: 2.5 },  // Late night
];

/**
 * Configured working hours for the bot.
 * Messages outside these hours are blocked/queued.
 */
export interface CircadianConfig {
  /** Hour to start sending (inclusive) — default 8 AM */
  startHour: number;
  /** Hour to stop sending (exclusive) — default 10 PM */
  endHour: number;
  /** If true, also skip messages on Sundays */
  skipSundays: boolean;
  /** If true, reduce activity on Saturdays to 60% */
  reducedSaturday: boolean;
  /** Timezone offset from UTC in hours (default: local system time) */
  timezoneOffsetHours?: number;
}

export const DEFAULT_CIRCADIAN_CONFIG: CircadianConfig = {
  startHour: 8,
  endHour: 22,
  skipSundays: false,
  reducedSaturday: true,
};

/**
 * Get current "human hour" considering optional timezone offset.
 */
export function getCurrentHour(config?: CircadianConfig): number {
  const now = new Date();
  if (config?.timezoneOffsetHours !== undefined) {
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const targetMs = utcMs + config.timezoneOffsetHours * 3600000;
    return new Date(targetMs).getHours();
  }
  return now.getHours();
}

/**
 * Check if the current time is within "human working hours".
 * Returns true if it's safe to send now.
 */
export function isWithinWorkingHours(config: CircadianConfig = DEFAULT_CIRCADIAN_CONFIG): boolean {
  const now = new Date();
  const hour = getCurrentHour(config);
  const dayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday

  // Skip Sundays if configured
  if (config.skipSundays && dayOfWeek === 0) {
    return false;
  }

  return hour >= config.startHour && hour < config.endHour;
}

/**
 * Calculate milliseconds until the next working window opens.
 * Returns 0 if we're already in working hours.
 */
export function msUntilNextWorkingWindow(
  config: CircadianConfig = DEFAULT_CIRCADIAN_CONFIG,
): number {
  if (isWithinWorkingHours(config)) return 0;

  const now = new Date();
  const hour = getCurrentHour(config);
  const dayOfWeek = now.getDay();

  // Calculate next start time
  const nextStart = new Date(now);

  if (hour >= config.endHour) {
    // Past end of day → start tomorrow
    nextStart.setDate(nextStart.getDate() + 1);
  }

  // Skip Sundays
  if (config.skipSundays) {
    const nextDay = nextStart.getDay();
    if (nextDay === 0) {
      nextStart.setDate(nextStart.getDate() + 1);
    }
  }

  nextStart.setHours(config.startHour, 0, 0, 0);

  // Add random jitter so all bots don't wake up at exactly the same time
  // ±30 minutes variation
  const jitterMs = (Math.random() - 0.5) * 30 * 60 * 1000;

  return Math.max(0, nextStart.getTime() - now.getTime() + jitterMs);
}

/**
 * Wait until working hours if currently outside them.
 * Returns immediately if already within working hours.
 */
export async function waitForWorkingHours(
  config: CircadianConfig = DEFAULT_CIRCADIAN_CONFIG,
  logFn?: (msg: string) => void,
): Promise<void> {
  const waitMs = msUntilNextWorkingWindow(config);
  if (waitMs <= 0) return;

  const waitMinutes = Math.round(waitMs / 60000);
  const resumeAt = new Date(Date.now() + waitMs);

  logFn?.(
    `🌙 Outside working hours (${config.startHour}:00 – ${config.endHour}:00). ` +
    `Sleeping ${waitMinutes} min. Resuming at ${resumeAt.toLocaleTimeString()}.`,
  );

  await sleep(waitMs);
}

/**
 * Get the activity weight for the current hour.
 * Used to decide if a message should be sent or delayed.
 */
export function getCurrentActivityWeight(config?: CircadianConfig): number {
  const hour = getCurrentHour(config);
  return HUMAN_ACTIVITY_PATTERN[hour]?.weight ?? 0.5;
}

/**
 * Get a delay multiplier based on current time of day.
 * Messages sent late at night get much longer delays.
 */
export function getTimeBasedDelayMultiplier(config?: CircadianConfig): number {
  const hour = getCurrentHour(config);
  const pattern = HUMAN_ACTIVITY_PATTERN[hour];
  if (!pattern) return 1.0;

  // On Saturdays, add extra delay
  const dayOfWeek = new Date().getDay();
  const saturdayMultiplier = (config?.reducedSaturday && dayOfWeek === 6) ? 1.3 : 1.0;

  return pattern.delayMultiplier * saturdayMultiplier;
}

/**
 * Calculate a human-like inter-message delay for the current time.
 *
 * @param baseMinMs   Minimum delay in ms (from campaign settings)
 * @param baseMaxMs   Maximum delay in ms (from campaign settings)
 * @param config      Circadian config for time adjustments
 * @returns           Final delay in ms, adjusted for time of day
 */
export function calculateHumanDelay(
  baseMinMs: number,
  baseMaxMs: number,
  config?: CircadianConfig,
): number {
  const multiplier = getTimeBasedDelayMultiplier(config);
  const adjustedMin = baseMinMs * multiplier;
  const adjustedMax = baseMaxMs * multiplier;

  // Random within adjusted range, with slight skew toward longer delays (log-normal style)
  const base = adjustedMin + Math.random() * (adjustedMax - adjustedMin);

  // 20% chance of extra "human distraction" pause (checking notifications, etc.)
  if (Math.random() < 0.20) {
    const distractionMs = 5000 + Math.random() * 25000; // 5-30s distraction
    return base + distractionMs;
  }

  return base;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
