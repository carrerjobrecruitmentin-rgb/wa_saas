/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║      BACKGROUND NOISE ENGINE — Human-Like Browser Activity           ║
 * ║                                                                      ║
 * ║  Between messages, real humans don't just sit still.                 ║
 * ║  They scroll chats, check statuses, read old messages, etc.         ║
 * ║  This engine simulates that "background noise" to fool AI detectors. ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export type NoiseActivity =
  | 'scroll_chat_list'
  | 'scroll_chat_up'
  | 'scroll_chat_down'
  | 'read_old_message'
  | 'hover_contact'
  | 'check_status_tab'
  | 'idle_mouse_movement'
  | 'open_close_emoji'
  | 'focus_search_bar'
  | 'switch_chat_and_back';

export interface NoiseConfig {
  /** Min ms to spend on noise activities */
  minDurationMs: number;
  /** Max ms to spend on noise activities */
  maxDurationMs: number;
  /** Probability weights for each activity */
  activityWeights: Record<NoiseActivity, number>;
  /** Whether to perform noise (can be toggled) */
  enabled: boolean;
}

export const DEFAULT_NOISE_CONFIG: NoiseConfig = {
  minDurationMs: 8_000,   // At least 8 seconds of noise
  maxDurationMs: 45_000,  // Up to 45 seconds
  enabled: true,
  activityWeights: {
    scroll_chat_list:    30,  // Most common — scroll the chat list
    scroll_chat_up:      20,  // Scroll up in current chat
    scroll_chat_down:    15,  // Scroll back down
    read_old_message:    10,  // Pause like reading an old message
    hover_contact:        8,  // Hover over a contact name
    check_status_tab:    12,  // Click Stories/Status tab and back
    idle_mouse_movement: 20,  // Random mouse jitter on screen
    open_close_emoji:     8,  // Open emoji picker, close it
    focus_search_bar:     7,  // Click search, wait, click away
    switch_chat_and_back: 5,  // Switch to another chat briefly
  },
};

/**
 * Pick a weighted random noise activity.
 */
export function pickNoiseActivity(config: NoiseConfig = DEFAULT_NOISE_CONFIG): NoiseActivity {
  const entries = Object.entries(config.activityWeights) as [NoiseActivity, number][];
  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (const [activity, weight] of entries) {
    random -= weight;
    if (random <= 0) return activity;
  }
  return 'scroll_chat_list';
}

/**
 * Perform smooth scroll simulation.
 * Mimics human smooth scrolling (not instant jumps).
 *
 * @param page        Puppeteer page
 * @param selector    CSS selector of scrollable element
 * @param distance    Pixels to scroll (positive = down, negative = up)
 * @param durationMs  How long the scroll should take
 */
export async function smoothScroll(
  page: { evaluate: (fn: Function, ...args: unknown[]) => Promise<unknown> },
  selector: string,
  distance: number,
  durationMs = 800,
): Promise<void> {
  await page.evaluate(
    (sel: string, dist: number, dur: number) => {
      return new Promise<void>((resolve) => {
        const elRaw = document.querySelector(sel);
        if (!elRaw) { resolve(); return; }
        const el = elRaw as HTMLElement;

        const startPos = el.scrollTop;
        const startTime = performance.now();

        // Ease-in-out cubic function
        function easeInOutCubic(t: number): number {
          return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function step(currentTime: number) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / dur, 1);
          const eased = easeInOutCubic(progress);
          el.scrollTop = startPos + dist * eased;

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        }

        requestAnimationFrame(step);
      });
    },
    selector,
    distance,
    durationMs,
  );
}

/**
 * Generate a random idle mouse movement within the viewport.
 */
export async function idleMouseMovement(
  page: {
    viewport: () => { width: number; height: number } | null;
    mouse: { move: (x: number, y: number) => Promise<void> };
  },
  durationMs = 3000,
): Promise<void> {
  const viewport = page.viewport() ?? { width: 1280, height: 720 };
  const endTime = Date.now() + durationMs;
  let x = viewport.width / 2;
  let y = viewport.height / 2;

  while (Date.now() < endTime) {
    // Small random movement (100-300px)
    const dx = (Math.random() - 0.5) * 200;
    const dy = (Math.random() - 0.5) * 150;
    x = Math.max(50, Math.min(viewport.width - 50, x + dx));
    y = Math.max(50, Math.min(viewport.height - 50, y + dy));

    await page.mouse.move(x, y);
    await sleep(200 + Math.random() * 600);
  }
}

/**
 * Perform a background noise sequence.
 * Simulates realistic human browsing behavior between messages.
 *
 * Note: This function is designed for puppeteer-based (whatsapp-web.js) sessions.
 * Each action is wrapped in try-catch so failures don't break the main flow.
 *
 * @param page    Puppeteer page object
 * @param config  Noise configuration
 */
export async function performBackgroundNoise(
  page: {
    evaluate: (fn: Function, ...args: unknown[]) => Promise<unknown>;
    mouse: {
      move: (x: number, y: number) => Promise<void>;
      click: (x: number, y: number) => Promise<void>;
    };
    viewport: () => { width: number; height: number } | null;
    $: (selector: string) => Promise<{ click: () => Promise<void> } | null>;
  },
  config: NoiseConfig = DEFAULT_NOISE_CONFIG,
): Promise<void> {
  if (!config.enabled) return;

  const totalMs =
    config.minDurationMs + Math.random() * (config.maxDurationMs - config.minDurationMs);
  const endTime = Date.now() + totalMs;

  while (Date.now() < endTime) {
    const activity = pickNoiseActivity(config);
    const remaining = endTime - Date.now();
    if (remaining < 1000) break;

    try {
      await executeNoiseActivity(page, activity);
    } catch {
      // Silently ignore - noise failures shouldn't break main flow
    }

    // Short gap between activities
    await sleep(500 + Math.random() * 1500);
  }
}

/**
 * Execute a specific noise activity.
 */
async function executeNoiseActivity(
  page: {
    evaluate: (fn: Function, ...args: unknown[]) => Promise<unknown>;
    mouse: {
      move: (x: number, y: number) => Promise<void>;
      click: (x: number, y: number) => Promise<void>;
    };
    viewport: () => { width: number; height: number } | null;
    $: (selector: string) => Promise<{ click: () => Promise<void> } | null>;
  },
  activity: NoiseActivity,
): Promise<void> {
  const viewport = page.viewport() ?? { width: 1280, height: 720 };

  switch (activity) {
    case 'scroll_chat_list': {
      // Scroll the chat list pane up or down
      const distance = (Math.random() < 0.5 ? 1 : -1) * (100 + Math.random() * 300);
      await smoothScroll(page, '#pane-side', distance, 600 + Math.random() * 400);
      await sleep(1000 + Math.random() * 2000);
      break;
    }

    case 'scroll_chat_up': {
      // Scroll up in the current chat (reading history)
      await smoothScroll(page, '#main .copyable-area', -(200 + Math.random() * 400), 800);
      await sleep(1500 + Math.random() * 3000); // "Reading" time
      break;
    }

    case 'scroll_chat_down': {
      // Scroll back down
      await smoothScroll(page, '#main .copyable-area', 200 + Math.random() * 400, 600);
      await sleep(500 + Math.random() * 1000);
      break;
    }

    case 'read_old_message': {
      // Move mouse over the message area (like reading)
      const startX = viewport.width * 0.3 + Math.random() * viewport.width * 0.4;
      const startY = viewport.height * 0.3 + Math.random() * viewport.height * 0.4;
      await page.mouse.move(startX, startY);
      await sleep(1500 + Math.random() * 3500); // Reading pause
      break;
    }

    case 'idle_mouse_movement': {
      await idleMouseMovement(page, 2000 + Math.random() * 3000);
      break;
    }

    case 'hover_contact': {
      // Hover over chat list area
      const chatListX = viewport.width * 0.15 + Math.random() * viewport.width * 0.1;
      const chatListY = 100 + Math.random() * (viewport.height - 200);
      await page.mouse.move(chatListX, chatListY);
      await sleep(300 + Math.random() * 700);
      break;
    }

    case 'check_status_tab': {
      // Try to click the Status/Communities tab if present
      const statusBtn = await page.$('[data-icon="status"]');
      if (statusBtn) {
        await statusBtn.click();
        await sleep(1500 + Math.random() * 2000);
        // Go back to chats
        const chatBtn = await page.$('[data-icon="chat"]');
        if (chatBtn) {
          await chatBtn.click();
          await sleep(500 + Math.random() * 500);
        }
      }
      break;
    }

    case 'open_close_emoji': {
      // Try to open emoji picker
      const emojiBtn = await page.$('[data-icon="smiley"]');
      if (emojiBtn) {
        await emojiBtn.click();
        await sleep(800 + Math.random() * 1200);
        // Press Escape to close
        await page.evaluate(() => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
        await sleep(300 + Math.random() * 500);
      }
      break;
    }

    case 'focus_search_bar': {
      // Click the search icon and wait
      const searchBtn = await page.$('[data-icon="search"]');
      if (searchBtn) {
        await searchBtn.click();
        await sleep(800 + Math.random() * 1500);
        // Press Escape
        await page.evaluate(() => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
        await sleep(300 + Math.random() * 400);
      }
      break;
    }

    case 'switch_chat_and_back': {
      // Move to chat list and "look" at another chat without clicking
      const chatX = viewport.width * 0.1 + Math.random() * viewport.width * 0.2;
      const chatY = 150 + Math.random() * (viewport.height - 200);
      await page.mouse.move(chatX, chatY);
      await sleep(200 + Math.random() * 400);
      // Move back to message input area
      await page.mouse.move(viewport.width * 0.6, viewport.height * 0.9);
      await sleep(300 + Math.random() * 600);
      break;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
