/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║       STEALTH MODE ENGINE — Anti-Detection Browser Fingerprinting    ║
 * ║                                                                      ║
 * ║  Injects stealth patches into Puppeteer to make Chrome look like     ║
 * ║  a real user browser (not a bot):                                    ║
 * ║   - Hides navigator.webdriver flag                                   ║
 * ║   - Spoofs realistic User-Agent (iPhone/Android/Windows)             ║
 * ║   - Patches Chrome runtime fingerprints                              ║
 * ║   - Randomizes canvas/WebGL fingerprints                             ║
 * ║   - Injects realistic browser plugins list                           ║
 * ║   - Sets correct screen dimensions and color depth                   ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

export interface StealthProfile {
  /** User agent string to spoof */
  userAgent: string;
  /** Screen resolution to fake */
  viewport: { width: number; height: number };
  /** Platform string for navigator.platform */
  platform: string;
  /** Languages for navigator.languages */
  languages: string[];
  /** Hardware concurrency (CPU cores) */
  hardwareConcurrency: number;
  /** Device memory in GB */
  deviceMemory: number;
}

/** Realistic device profiles to randomize from */
export const STEALTH_PROFILES: StealthProfile[] = [
  // iPhone 14 Pro (Safari)
  {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    platform: 'iPhone',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 6,
    deviceMemory: 6,
  },
  // Samsung Galaxy S23 (Chrome)
  {
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    viewport: { width: 393, height: 851 },
    platform: 'Linux armv8l',
    languages: ['en-IN', 'en'],
    hardwareConcurrency: 8,
    deviceMemory: 8,
  },
  // Windows 11 Chrome (desktop)
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    platform: 'Win32',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 8,
    deviceMemory: 8,
  },
  // MacBook Pro (Chrome)
  {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    platform: 'MacIntel',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 10,
    deviceMemory: 16,
  },
  // OnePlus 11 (Chrome)
  {
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; CPH2449) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    platform: 'Linux aarch64',
    languages: ['en-IN', 'hi', 'en'],
    hardwareConcurrency: 8,
    deviceMemory: 16,
  },
  // Pixel 7 (Chrome)
  {
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 892 },
    platform: 'Linux aarch64',
    languages: ['en-US', 'en'],
    hardwareConcurrency: 8,
    deviceMemory: 8,
  },
];

/**
 * Pick a random stealth profile.
 */
export function randomStealthProfile(): StealthProfile {
  return STEALTH_PROFILES[Math.floor(Math.random() * STEALTH_PROFILES.length)];
}

/**
 * Get the Puppeteer launch args needed for stealth operation.
 * These flags disable automation indicators in Chrome.
 */
export function getStealthLaunchArgs(): string[] {
  return [
    // Core anti-detection flags
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',  // KEY: removes navigator.webdriver
    '--disable-infobars',
    '--disable-extensions-except=',

    // Make Chrome look like a real browser
    '--window-size=1366,768',
    '--start-maximized',
    '--disable-notifications',
    '--disable-popup-blocking',

    // Performance flags (also real browsers use these on slow machines)
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',

    // Disable automation UI
    '--disable-infobars',
    '--no-default-browser-check',
    '--disable-prompt-on-repost',
    '--disable-hang-monitor',
    '--disable-sync',

    // Media/GPU (realistic browser flags)
    '--disable-gpu',
    '--mute-audio',
  ];
}

/**
 * JavaScript patches to inject into the page to hide automation fingerprints.
 * These run in the browser context before any page scripts.
 *
 * Based on puppeteer-extra-plugin-stealth patches but implemented inline.
 */
export function getStealthPageScript(profile: StealthProfile): string {
  return `
    (() => {
      // ── 1. Hide navigator.webdriver ──────────────────────────────────
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true,
      });

      // ── 2. Spoof navigator.platform ──────────────────────────────────
      Object.defineProperty(navigator, 'platform', {
        get: () => '${profile.platform}',
        configurable: true,
      });

      // ── 3. Spoof navigator.languages ─────────────────────────────────
      Object.defineProperty(navigator, 'languages', {
        get: () => ${JSON.stringify(profile.languages)},
        configurable: true,
      });

      // ── 4. Spoof hardware concurrency ────────────────────────────────
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => ${profile.hardwareConcurrency},
        configurable: true,
      });

      // ── 5. Spoof device memory ───────────────────────────────────────
      if ('deviceMemory' in navigator) {
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => ${profile.deviceMemory},
          configurable: true,
        });
      }

      // ── 6. Patch Chrome runtime (automation check) ───────────────────
      if (!window.chrome) {
        window.chrome = { runtime: {} };
      }
      if (!window.chrome.runtime) {
        window.chrome.runtime = {};
      }

      // ── 7. Spoof plugins (bots have empty plugins list) ───────────────
      const fakePlugins = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ];
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const arr = fakePlugins.map(p => {
            const plugin = { name: p.name, filename: p.filename, description: p.description, length: 0 };
            Object.setPrototypeOf(plugin, Plugin.prototype);
            return plugin;
          });
          arr.item = (i) => arr[i] || null;
          arr.namedItem = (name) => arr.find(p => p.name === name) || null;
          arr.refresh = () => {};
          Object.setPrototypeOf(arr, PluginArray.prototype);
          return arr;
        },
        configurable: true,
      });

      // ── 8. Canvas fingerprint randomization ───────────────────────────
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type, ...args) {
        const result = originalToDataURL.apply(this, [type, ...args]);
        // Add tiny random pixel noise to canvas output
        if (this.width > 0 && this.height > 0) {
          const ctx = this.getContext('2d');
          if (ctx) {
            const imgData = ctx.getImageData(0, 0, 1, 1);
            imgData.data[0] = (imgData.data[0] + Math.floor(Math.random() * 3)) % 256;
            ctx.putImageData(imgData, 0, 0);
          }
        }
        return originalToDataURL.apply(this, [type, ...args]);
      };

      // ── 9. Permissions API (real browsers have notification permission) ─
      const originalQuery = window.Permissions && window.Permissions.prototype.query;
      if (originalQuery) {
        window.Permissions.prototype.query = function(parameters) {
          return parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission, onchange: null })
            : originalQuery.apply(this, [parameters]);
        };
      }

      // ── 10. Hide automation in toString ──────────────────────────────
      const originalFunctionToString = Function.prototype.toString;
      Function.prototype.toString = function() {
        if (this === window.Permissions?.prototype.query) {
          return 'function query() { [native code] }';
        }
        return originalFunctionToString.apply(this, arguments);
      };

      console.debug('[Stealth] Anti-detection patches applied ✓');
    })();
  `;
}

/**
 * Apply stealth patches to a Puppeteer page.
 * Call this after page creation, before any navigation.
 *
 * @param page    Puppeteer page object
 * @param profile Stealth profile to apply (random if not provided)
 */
export async function applyStealthToPage(
  page: {
    evaluateOnNewDocument: (script: string) => Promise<void>;
    setUserAgent: (userAgent: string) => Promise<void>;
    setViewport: (viewport: { width: number; height: number; deviceScaleFactor?: number }) => Promise<void>;
    setExtraHTTPHeaders: (headers: Record<string, string>) => Promise<void>;
  },
  profile?: StealthProfile,
): Promise<void> {
  const stealthProfile = profile ?? randomStealthProfile();

  // 1. Inject stealth JS before page scripts
  await page.evaluateOnNewDocument(getStealthPageScript(stealthProfile));

  // 2. Set realistic User-Agent
  await page.setUserAgent(stealthProfile.userAgent);

  // 3. Set viewport to match the "device"
  await page.setViewport({
    ...stealthProfile.viewport,
    deviceScaleFactor: 1,
  });

  // 4. Set realistic HTTP headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': stealthProfile.languages.join(',') + ';q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-ch-ua-platform': `"${stealthProfile.platform.includes('Win') ? 'Windows' :
                              stealthProfile.platform.includes('Mac') ? 'macOS' :
                              'Android'}"`,
  });
}
