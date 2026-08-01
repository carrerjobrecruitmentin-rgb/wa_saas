/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║       KEYSTROKE DYNAMICS ENGINE — Human Typing Simulator             ║
 * ║                                                                      ║
 * ║  Real humans don't type at constant speed. They:                     ║
 * ║   - Speed up mid-word, slow at start/end                             ║
 * ║   - Make typos and fix them with Backspace                           ║
 * ║   - Pause before long words or after punctuation                     ║
 * ║   - Type common bigrams faster (muscle memory)                       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export interface TypingProfile {
  /** Base WPM range [min, max] — realistic: 35–80 WPM */
  wpmRange: [number, number];
  /** Probability of making a typo per character (0–1) */
  typoRate: number;
  /** Probability of fixing a typo (vs leaving it) */
  typoFixRate: number;
  /** Extra delay after punctuation like . , ! ? (ms) */
  punctuationPauseMs: [number, number];
  /** Occasional "thinking" pause between words (ms) */
  thinkPauseMs: [number, number];
  /** Probability of a "thinking" pause between words */
  thinkPauseChance: number;
  /** Burst mode: fast typing for 3-7 chars, then slow (muscle memory effect) */
  burstEnabled: boolean;
}

/** Default human-like typing profile */
export const DEFAULT_TYPING_PROFILE: TypingProfile = {
  wpmRange: [38, 68],
  typoRate: 0.04,        // 4% chance per char → ~1 typo per 25 chars
  typoFixRate: 0.85,     // 85% of typos are fixed
  punctuationPauseMs: [80, 220],
  thinkPauseMs: [200, 600],
  thinkPauseChance: 0.08, // 8% chance of thinking pause between words
  burstEnabled: true,
};

/** Fast typist profile */
export const FAST_TYPING_PROFILE: TypingProfile = {
  wpmRange: [65, 95],
  typoRate: 0.06,
  typoFixRate: 0.90,
  punctuationPauseMs: [40, 120],
  thinkPauseMs: [100, 300],
  thinkPauseChance: 0.04,
  burstEnabled: true,
};

/** Slow/careful typist profile */
export const SLOW_TYPING_PROFILE: TypingProfile = {
  wpmRange: [20, 40],
  typoRate: 0.02,
  typoFixRate: 0.70,
  punctuationPauseMs: [150, 400],
  thinkPauseMs: [400, 1200],
  thinkPauseChance: 0.15,
  burstEnabled: false,
};

/** Common bigrams humans type quickly (muscle memory) */
const FAST_BIGRAMS = new Set([
  'th', 'he', 'in', 'er', 'an', 'en', 'on', 'at', 'es', 'ed',
  'ou', 'ea', 'ha', 'hi', 'to', 'or', 'it', 'is', 'ng', 'ar',
]);

/** Adjacent keyboard keys for realistic typos (QWERTY layout) */
const ADJACENT_KEYS: Record<string, string[]> = {
  'a': ['q', 'w', 's', 'z'],
  'b': ['v', 'g', 'h', 'n'],
  'c': ['x', 'd', 'f', 'v'],
  'd': ['s', 'e', 'r', 'f', 'c', 'x'],
  'e': ['w', 'r', 'd', 's'],
  'f': ['d', 'r', 't', 'g', 'v', 'c'],
  'g': ['f', 't', 'y', 'h', 'b', 'v'],
  'h': ['g', 'y', 'u', 'j', 'n', 'b'],
  'i': ['u', 'o', 'k', 'j'],
  'j': ['h', 'u', 'i', 'k', 'm', 'n'],
  'k': ['j', 'i', 'o', 'l', 'm'],
  'l': ['k', 'o', 'p'],
  'm': ['n', 'j', 'k'],
  'n': ['b', 'g', 'h', 'j', 'm'],
  'o': ['i', 'p', 'l', 'k'],
  'p': ['o', 'l'],
  'q': ['w', 'a'],
  'r': ['e', 't', 'f', 'd'],
  's': ['a', 'w', 'e', 'd', 'x', 'z'],
  't': ['r', 'y', 'g', 'f'],
  'u': ['y', 'i', 'j', 'h'],
  'v': ['c', 'f', 'g', 'b'],
  'w': ['q', 'e', 's', 'a'],
  'x': ['z', 's', 'd', 'c'],
  'y': ['t', 'u', 'h', 'g'],
  'z': ['a', 's', 'x'],
};

/**
 * Get a realistic typo character for the given character.
 */
function getTypoChar(char: string): string {
  const lower = char.toLowerCase();
  const adjacent = ADJACENT_KEYS[lower];
  if (adjacent && adjacent.length > 0) {
    const typo = adjacent[Math.floor(Math.random() * adjacent.length)];
    // Preserve case
    return char === char.toUpperCase() ? typo.toUpperCase() : typo;
  }
  // Fallback: double the character or swap with next common key
  return char + char;
}

/**
 * Calculate inter-keystroke delay in ms from WPM.
 * 1 WPM = ~5 chars/min = 1 char / 12 seconds → too slow.
 * Real WPM counting: 5 chars = 1 word.
 * So 60 WPM = 300 chars/min = 5 chars/sec = 200ms per char.
 * Formula: delay_ms = 60000 / (wpm * 5)
 */
function wpmToDelayMs(wpm: number): number {
  return Math.round(60000 / (wpm * 5));
}

/**
 * Simulate human-like typing on a Puppeteer page.
 * Types character by character with realistic dynamics.
 *
 * @param keyboard  Puppeteer keyboard object (page.keyboard)
 * @param text      Text to type
 * @param profile   Typing profile to use
 */
export async function humanType(
  keyboard: {
    type: (text: string, options?: { delay?: number }) => Promise<void>;
    press: (key: string, options?: { delay?: number }) => Promise<void>;
  },
  text: string,
  profile: TypingProfile = DEFAULT_TYPING_PROFILE,
): Promise<void> {
  // Pick a base WPM for this session (consistent within a message)
  const sessionWpm = profile.wpmRange[0] + Math.random() * (profile.wpmRange[1] - profile.wpmRange[0]);
  const baseDelayMs = wpmToDelayMs(sessionWpm);

  let burstCount = 0;
  let burstTarget = profile.burstEnabled ? (3 + Math.floor(Math.random() * 5)) : 0;
  let inBurst = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    const bigram = (prevChar + char).toLowerCase();

    // ── Typo simulation ────────────────────────────────────────────────
    if (char !== ' ' && char !== '\n' && Math.random() < profile.typoRate) {
      const typo = getTypoChar(char);

      // Type the wrong character
      await keyboard.type(typo, { delay: baseDelayMs * (0.8 + Math.random() * 0.4) });
      await sleep(baseDelayMs * (1.2 + Math.random() * 0.8)); // notice the mistake

      if (Math.random() < profile.typoFixRate) {
        // Fix it with backspace(s)
        const extraBackspaces = typo.length > 1 ? typo.length - 1 : 0;
        for (let b = 0; b <= extraBackspaces; b++) {
          await keyboard.press('Backspace', { delay: 30 + Math.random() * 60 });
          await sleep(20 + Math.random() * 40);
        }
        // Now type the correct character
        await keyboard.type(char, { delay: baseDelayMs * (0.9 + Math.random() * 0.3) });
      } else {
        // Leave the typo, continue
        continue;
      }
    } else {
      // ── Normal keystroke ─────────────────────────────────────────────
      let charDelay = baseDelayMs;

      // Bigram speed boost (muscle memory for common letter pairs)
      if (FAST_BIGRAMS.has(bigram)) {
        charDelay *= 0.65 + Math.random() * 0.2; // 65–85% of base delay
      }

      // Burst mode: type a short run of chars faster
      if (profile.burstEnabled) {
        if (!inBurst) {
          if (Math.random() < 0.3) {
            inBurst = true;
            burstCount = 0;
            burstTarget = 3 + Math.floor(Math.random() * 5);
          }
        }
        if (inBurst) {
          charDelay *= 0.5 + Math.random() * 0.2; // much faster in burst
          burstCount++;
          if (burstCount >= burstTarget) {
            inBurst = false;
          }
        }
      }

      // Add natural variation (±30%)
      charDelay *= 0.7 + Math.random() * 0.6;

      await keyboard.type(char, { delay: Math.max(20, charDelay) });
    }

    // ── Post-character delays ────────────────────────────────────────
    const isPunctuation = /[.,!?;:]/.test(char);
    const isWordEnd = char === ' ' || char === '\n';

    if (isPunctuation) {
      // Pause after punctuation
      const pauseMs =
        profile.punctuationPauseMs[0] +
        Math.random() * (profile.punctuationPauseMs[1] - profile.punctuationPauseMs[0]);
      await sleep(pauseMs);
    } else if (isWordEnd && Math.random() < profile.thinkPauseChance) {
      // Occasional "thinking" pause between words
      const thinkMs =
        profile.thinkPauseMs[0] +
        Math.random() * (profile.thinkPauseMs[1] - profile.thinkPauseMs[0]);
      await sleep(thinkMs);
    }
  }
}

/**
 * Randomly pick a typing profile weighted by probability.
 * Most users are average typists.
 */
export function randomTypingProfile(): TypingProfile {
  const r = Math.random();
  if (r < 0.15) return FAST_TYPING_PROFILE;       // 15% fast typists
  if (r < 0.30) return SLOW_TYPING_PROFILE;        // 15% slow typists
  return DEFAULT_TYPING_PROFILE;                   // 70% average typists
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
