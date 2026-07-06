export const BLOCKED_DOMAINS = new Set([
  'localhost',
  '127.0.0.1',
  'accounts.google.com',
  'login.microsoftonline.com',
  'appleid.apple.com',
  'github.com/login',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'pornhub.com',
  // bank domains
  'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'citi.com',
])

export function isBlockedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return BLOCKED_DOMAINS.has(parsed.hostname) || 
           parsed.hostname.endsWith('.local') ||
           parsed.protocol === 'chrome:' ||
           parsed.protocol === 'chrome-extension:'
  } catch {
    return true
  }
}
