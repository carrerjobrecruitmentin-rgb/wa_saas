/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║           HUMAN EMULATION ENGINE — The Master Orchestrator           ║
 * ║                                                                      ║
 * ║  "God-Level" Anti-Ban System that combines ALL stealth techniques:   ║
 * ║                                                                      ║
 * ║  1. Spintax          — Unique message per contact                    ║
 * ║  2. Bezier Mouse     — Curved, natural mouse movement                ║
 * ║  3. Keystroke Dynamics — Human typing with typos                     ║
 * ║  4. Background Noise — Realistic browsing between sends              ║
 * ║  5. Circadian Rhythm — Sleep during off-hours                        ║
 * ║  6. Stealth Mode     — Anti-fingerprinting & UA spoofing             ║
 * ║  7. Batch Breaks     — Long pauses every N messages                  ║
 * ║                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

import { Injectable } from '@nestjs/common';
import { createLogger } from '../services/logger.service';
import { resolveSpintax, hasSpintax } from './spintax.engine';
import {
  CircadianConfig,
  DEFAULT_CIRCADIAN_CONFIG,
  calculateHumanDelay,
  waitForWorkingHours,
  isWithinWorkingHours,
  getCurrentActivityWeight,
} from './circadian-rhythm.engine';
import {
  NoiseConfig,
  DEFAULT_NOISE_CONFIG,
  performBackgroundNoise,
} from './background-noise.engine';
import {
  TypingProfile,
  DEFAULT_TYPING_PROFILE,
  randomTypingProfile,
  humanType,
} from './keystroke-dynamics.engine';
import {
  humanMouseMove,
  humanClick,
  Point,
} from './bezier-mouse.engine';
import {
  StealthProfile,
  randomStealthProfile,
  applyStealthToPage,
  getStealthLaunchArgs,
} from './stealth-mode.engine';

export interface HumanEmulationConfig {
  /** Circadian rhythm settings */
  circadian: CircadianConfig;
  /** Background noise settings */
  noise: NoiseConfig;
  /** Typing profile (or 'random' to randomize per message) */
  typingProfile: TypingProfile | 'random';
  /** Stealth profile (or 'random' to randomize) */
  stealthProfile: StealthProfile | 'random';
  /** Whether all stealth features are enabled */
  enabled: boolean;
  /** Anti-ban mode: 'conservative' | 'balanced' | 'aggressive' */
  mode: 'conservative' | 'balanced' | 'aggressive';
}

export const DEFAULT_HUMAN_EMULATION_CONFIG: HumanEmulationConfig = {
  circadian: DEFAULT_CIRCADIAN_CONFIG,
  noise: DEFAULT_NOISE_CONFIG,
  typingProfile: 'random',
  stealthProfile: 'random',
  enabled: true,
  mode: 'balanced',
};

/** Pre-send delay ranges by mode (ms) */
const MODE_DELAYS = {
  conservative: { min: 20_000, max: 60_000 },  // Very safe: 20-60s between messages
  balanced:     { min: 10_000, max: 35_000 },  // Balanced: 10-35s
  aggressive:   { min: 5_000,  max: 15_000 },  // Faster but riskier: 5-15s
};

/** Batch break config by mode */
const MODE_BATCH = {
  conservative: { size: 8,  pauseMin: 45 * 60_000, pauseMax: 90 * 60_000 },   // 45-90 min break
  balanced:     { size: 12, pauseMin: 30 * 60_000, pauseMax: 60 * 60_000 },   // 30-60 min break
  aggressive:   { size: 20, pauseMin: 15 * 60_000, pauseMax: 30 * 60_000 },   // 15-30 min break
};

@Injectable()
export class HumanEmulationEngine {
  private readonly logger = createLogger('HumanEmulationEngine');

  /**
   * ── Step 1: SPINTAX ─────────────────────────────────────────────────────
   * Resolve a message template with Spintax syntax.
   * Returns a unique message variant each time.
   */
  resolveMessage(template: string): string {
    if (!hasSpintax(template)) return template;
    const resolved = resolveSpintax(template);
    this.logger.debug(`Spintax resolved: "${template.slice(0, 30)}..." → "${resolved.slice(0, 30)}..."`);
    return resolved;
  }

  /**
   * ── Step 2: CIRCADIAN RHYTHM ────────────────────────────────────────────
   * Check working hours and wait if needed.
   */
  async enforceWorkingHours(
    config: CircadianConfig = DEFAULT_CIRCADIAN_CONFIG,
    mobile?: string,
  ): Promise<void> {
    await waitForWorkingHours(config, (msg) => this.logger.log(msg + (mobile ? ` [${mobile}]` : '')));
  }

  /**
   * ── Step 3: HUMAN DELAY ─────────────────────────────────────────────────
   * Calculate and apply a human-like delay before sending.
   * Accounts for time of day, mode, and random variation.
   */
  async applyHumanDelay(
    config: HumanEmulationConfig = DEFAULT_HUMAN_EMULATION_CONFIG,
    overrideMinMs?: number,
    overrideMaxMs?: number,
  ): Promise<void> {
    if (!config.enabled) return;

    const modeDelays = MODE_DELAYS[config.mode];
    const minMs = overrideMinMs ?? modeDelays.min;
    const maxMs = overrideMaxMs ?? modeDelays.max;

    const delayMs = calculateHumanDelay(minMs, maxMs, config.circadian);
    const delaySec = Math.round(delayMs / 1000);

    this.logger.log(`🕐 Human delay: ${delaySec}s (mode: ${config.mode}, hour weight: ${getCurrentActivityWeight(config.circadian).toFixed(2)})`);
    await this.sleep(delayMs);
  }

  /**
   * ── Step 4: BATCH BREAKS ────────────────────────────────────────────────
   * Take a long break after N messages (simulates natural human behavior).
   */
  async applyBatchBreakIfNeeded(
    jobIndex: number,
    config: HumanEmulationConfig = DEFAULT_HUMAN_EMULATION_CONFIG,
  ): Promise<void> {
    if (!config.enabled) return;

    const batchConfig = MODE_BATCH[config.mode];
    if (jobIndex > 0 && jobIndex % batchConfig.size === 0) {
      const pauseMs =
        batchConfig.pauseMin +
        Math.random() * (batchConfig.pauseMax - batchConfig.pauseMin);
      const pauseMin = Math.round(pauseMs / 60_000);

      this.logger.log(
        `☕ Batch break after ${jobIndex} messages. Taking ${pauseMin} min break...`,
      );
      await this.sleep(pauseMs);
    }
  }

  /**
   * ── Step 5: BACKGROUND NOISE ────────────────────────────────────────────
   * Perform human-like browser activity (scrolling, hovering, etc.)
   * Call this between messages when using Puppeteer/whatsapp-web.js.
   */
  async performNoise(
    page: Parameters<typeof performBackgroundNoise>[0],
    config: NoiseConfig = DEFAULT_NOISE_CONFIG,
  ): Promise<void> {
    try {
      await performBackgroundNoise(page, config);
    } catch (err) {
      this.logger.debug(`Background noise error (non-fatal): ${String(err)}`);
    }
  }

  /**
   * ── Step 6: HUMAN TYPING ────────────────────────────────────────────────
   * Type a message with human-like keystroke dynamics.
   * Includes typos, variable speed, burst mode.
   */
  async typeMessage(
    keyboard: Parameters<typeof humanType>[0],
    text: string,
    profile?: TypingProfile | 'random',
  ): Promise<void> {
    const typingProfile =
      !profile || profile === 'random' ? randomTypingProfile() : profile;

    this.logger.debug(`Typing ${text.length} chars with profile: ${typingProfile.wpmRange.join('-')} WPM`);
    await humanType(keyboard, text, typingProfile);
  }

  /**
   * ── Step 7: STEALTH MOUSE CLICK ─────────────────────────────────────────
   * Move mouse to a target along a Bezier curve and click.
   */
  async clickElement(
    page: Parameters<typeof humanClick>[0],
    target: Point,
    currentPos?: Point,
  ): Promise<void> {
    await humanClick(page, target, currentPos);
  }

  /**
   * ── Step 8: STEALTH PAGE SETUP ──────────────────────────────────────────
   * Apply all anti-fingerprinting patches to a Puppeteer page.
   */
  async applyStealthToPage(
    page: Parameters<typeof applyStealthToPage>[0],
    profile?: StealthProfile | 'random',
  ): Promise<void> {
    const stealthProfile =
      !profile || profile === 'random' ? randomStealthProfile() : profile;
    await applyStealthToPage(page, stealthProfile);
    this.logger.log(`🕵️ Stealth applied: ${stealthProfile.platform} — ${stealthProfile.userAgent.slice(0, 60)}...`);
  }

  /**
   * Get Puppeteer launch args with stealth flags included.
   */
  getStealthLaunchArgs(): string[] {
    return getStealthLaunchArgs();
  }

  /**
   * ── FULL PRE-SEND FLOW ───────────────────────────────────────────────────
   * Executes the complete human emulation pipeline before sending a message.
   * This is the main method to call from the campaign processor.
   *
   * Flow:
   *   1. Check working hours → wait if needed
   *   2. Apply batch break if needed
   *   3. Resolve spintax in message
   *   4. Apply human delay
   *
   * @returns The final message text (spintax resolved)
   */
  async preSendFlow(options: {
    messageTemplate: string;
    jobIndex: number;
    mobile?: string;
    config?: HumanEmulationConfig;
    overrideMinMs?: number;
    overrideMaxMs?: number;
  }): Promise<string> {
    const {
      messageTemplate,
      jobIndex,
      mobile,
      config = DEFAULT_HUMAN_EMULATION_CONFIG,
      overrideMinMs,
      overrideMaxMs,
    } = options;

    if (!config.enabled) {
      return this.resolveMessage(messageTemplate);
    }

    // 1. Enforce working hours (Circadian Rhythm)
    await this.enforceWorkingHours(config.circadian, mobile);

    // 2. Batch break check
    await this.applyBatchBreakIfNeeded(jobIndex, config);

    // 3. Resolve Spintax → unique message
    const finalMessage = this.resolveMessage(messageTemplate);

    // 4. Human delay (time-of-day aware)
    await this.applyHumanDelay(config, overrideMinMs, overrideMaxMs);

    this.logger.log(
      `✅ Pre-send flow complete for ${mobile ?? 'unknown'} ` +
      `[job #${jobIndex}, mode: ${config.mode}]`,
    );

    return finalMessage;
  }

  /**
   * Check if it's a good time to be active (based on activity weight).
   * Returns false during very low-activity hours even within working hours.
   */
  isGoodTimeToSend(config?: CircadianConfig): boolean {
    if (!isWithinWorkingHours(config ?? DEFAULT_CIRCADIAN_CONFIG)) return false;
    const weight = getCurrentActivityWeight(config);
    // Below 20% weight → very unusual time, skip
    return weight >= 0.2;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
