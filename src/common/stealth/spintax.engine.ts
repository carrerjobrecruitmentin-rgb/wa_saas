/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║           SPINTAX ENGINE — Human Message Variation Generator         ║
 * ║                                                                      ║
 * ║  Spintax Format: {Hello|Hi|Hey} {bhai|yaar|boss}!                   ║
 * ║  Each call picks random variant → every message looks unique         ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/**
 * Parses and resolves Spintax syntax in a string.
 * Supports nested spintax: {Hi|Hello {bro|dude}} → "Hi" or "Hello bro" or "Hello dude"
 *
 * @param template  String containing {option1|option2|...} blocks
 * @returns         Resolved string with one random choice per block
 */
export function resolveSpintax(template: string): string {
  // Keep resolving until no spintax blocks remain (handles nesting)
  let result = template;
  let iterations = 0;
  const MAX_ITERATIONS = 20; // safety guard against infinite loops

  while (hasSpintax(result) && iterations < MAX_ITERATIONS) {
    // Match innermost {a|b|c} blocks (must contain at least one pipe)
    result = result.replace(/\{([^{}|]+\|[^{}]+)\}/g, (_match, inner: string) => {
      const options = inner.split('|');
      return options[Math.floor(Math.random() * options.length)].trim();
    });
    iterations++;
  }

  return result;
}

/**
 * Check if a string contains Spintax syntax.
 */
export function hasSpintax(text: string): boolean {
  return /\{[^{}|]+\|[^{}]*\}/.test(text);
}

/**
 * Count how many unique variations a spintax template can produce.
 * Useful for estimating campaign diversity.
 */
export function countSpintaxVariations(template: string): number {
  let count = 1;
  const matches = template.matchAll(/\{([^{}]+)\}/g);
  for (const match of matches) {
    const options = match[1].split('|');
    count *= options.length;
  }
  return count;
}

/**
 * Generate N unique resolved variants from a spintax template.
 * Tries to generate distinct results, falls back gracefully.
 */
export function generateVariants(template: string, count: number): string[] {
  const variants = new Set<string>();
  const maxAttempts = count * 10;
  let attempts = 0;

  while (variants.size < count && attempts < maxAttempts) {
    variants.add(resolveSpintax(template));
    attempts++;
  }

  return Array.from(variants);
}
