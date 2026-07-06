(function() {
  // Check if page has noindex meta
  const robotsMeta = document.querySelector('meta[name="robots"]');
  if (robotsMeta && robotsMeta.getAttribute('content')?.toLowerCase().includes('noindex')) {
    return;
  }

  // Ensure title is present
  if (!document.title || !document.title.trim()) {
    return;
  }

  const url = window.location.href;

  // Blocklist helper matching lib/blocklist.ts rules
  const BLOCKED_DOMAINS = [
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
    'chase.com',
    'bankofamerica.com',
    'wellsfargo.com',
    'citi.com'
  ];

  function isBlocked(urlString) {
    try {
      const parsed = new URL(urlString);
      if (parsed.protocol === 'chrome:' || parsed.protocol === 'chrome-extension:' || parsed.protocol === 'about:' || parsed.protocol === 'data:') {
        return true;
      }
      if (parsed.hostname.endsWith('.local')) {
        return true;
      }
      return BLOCKED_DOMAINS.some(domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain));
    } catch {
      return true;
    }
  }

  if (isBlocked(url)) {
    return;
  }

  // Content extraction function running on DOM
  function extractPageContent() {
    // Clone the body to clean it
    const bodyClone = document.body.cloneNode(true);

    const removeSelectors = [
      'script', 'style', 'nav', 'footer', 'header', 'aside', 
      'iframe', 'noscript', 'canvas', 'svg', 'form', 'button'
    ];

    removeSelectors.forEach(selector => {
      const elements = bodyClone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });

    const mainSelectors = ['article', 'main', '[role="main"]'];
    let mainElement = null;

    for (const selector of mainSelectors) {
      const found = bodyClone.querySelector(selector);
      if (found) {
        mainElement = found;
        break;
      }
    }

    if (!mainElement) {
      mainElement = bodyClone;
    }

    const rawText = mainElement.textContent || mainElement.innerText || '';
    const collapsedText = rawText.replace(/\s+/g, ' ').trim();
    return collapsedText.substring(0, 3000);
  }

  function runExtractionAndSend() {
    try {
      chrome.storage.local.get(["isBatterySavePaused"], async (data) => {
        if (data.isBatterySavePaused && navigator.getBattery) {
          try {
            const battery = await navigator.getBattery();
            if (!battery.charging && battery.level <= 0.20) {
              // Battery saver threshold hit (<=20% and not plugged in)
              return;
            }
          } catch (e) {
            // Gracefully ignore battery API errors
          }
        }

        const extractedContent = extractPageContent();
        const payload = {
          url: window.location.href,
          title: document.title,
          content: extractedContent,
          timestamp: Date.now(),
          domain: window.location.hostname
        };

        chrome.runtime.sendMessage({ type: 'PAGE_VISITED', payload }, (response) => {
          // Suppress errors and handle silently
          if (chrome.runtime.lastError) {
            // Extension context invalidated or service worker asleep
          }
        });
      });
    } catch (e) {
      // Handle errors silently
    }
  }

  // Wait until page is loaded
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    runExtractionAndSend();
  } else {
    window.addEventListener('DOMContentLoaded', runExtractionAndSend);
  }
})();
