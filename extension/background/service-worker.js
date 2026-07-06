// Background Service Worker for Nexus Search Extension

const DEFAULT_BACKEND = "http://localhost:3000";

// On installation, set up alarm and open Nexus connect page
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("flush", { periodInMinutes: 0.5 });
  chrome.tabs.create({ url: `${DEFAULT_BACKEND}/extension/connect` });
});

// Alarm listener to trigger periodic flushes
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "flush") {
    flushQueue();
  }
});

// Listen for messages from content scripts and popup UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PAGE_VISITED") {
    handlePageVisited(message.payload);
    sendResponse({ status: "queued" });
  } else if (message.type === "GET_STATUS") {
    getStatus().then(sendResponse);
    return true; // Keep channel open for async response
  } else if (message.type === "SET_TOKEN") {
    chrome.storage.local.set({ nexusToken: message.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === "CLEAR_TOKEN") {
    chrome.storage.local.remove(["nexusToken"], () => {
      chrome.storage.local.set({ pendingPages: [] }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  } else if (message.type === "TOGGLE_PAUSE") {
    chrome.storage.local.set({ isPaused: message.value }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle incoming page visited payload
async function handlePageVisited(page) {
  const data = await chrome.storage.local.get(["pendingPages", "recentUrls", "isPaused"]);
  
  if (data.isPaused) {
    return;
  }

  const pending = data.pendingPages || [];
  const recent = data.recentUrls || {};

  // Clean old items from recentUrls (older than 24 hours)
  const now = Date.now();
  const cleanedRecent = {};
  for (const [url, timestamp] of Object.entries(recent)) {
    if (now - timestamp < 24 * 60 * 60 * 1000) {
      cleanedRecent[url] = timestamp;
    }
  }

  // Deduplication check: skip if indexed in last 24h
  if (cleanedRecent[page.url]) {
    return;
  }

  // Skip duplicate in current pending queue
  if (pending.some((item) => item.url === page.url)) {
    return;
  }

  // Push to queue, capping at 100 items
  pending.push(page);
  if (pending.length > 100) {
    pending.shift(); // Drop oldest
  }

  await chrome.storage.local.set({
    pendingPages: pending,
    recentUrls: cleanedRecent,
  });
}

// Get status for popup rendering
async function getStatus() {
  const data = await chrome.storage.local.get([
    "pendingPages",
    "nexusToken",
    "indexedTodayCount",
    "indexedTodayDate",
    "isPaused",
  ]);

  const now = new Date();
  const todayStr = now.toDateString();
  let totalIndexedToday = data.indexedTodayCount || 0;

  // Reset count if it's a new day
  if (data.indexedTodayDate !== todayStr) {
    totalIndexedToday = 0;
    await chrome.storage.local.set({
      indexedTodayCount: 0,
      indexedTodayDate: todayStr,
    });
  }

  return {
    queueLength: (data.pendingPages || []).length,
    totalIndexed: totalIndexedToday,
    isLoggedIn: !!data.nexusToken,
    isPaused: !!data.isPaused,
  };
}

// Flush queue to backend Next.js API
async function flushQueue() {
  const data = await chrome.storage.local.get([
    "pendingPages",
    "nexusToken",
    "isPaused",
    "recentUrls",
    "indexedTodayCount",
    "indexedTodayDate"
  ]);

  if (data.isPaused) {
    return;
  }

  const token = data.nexusToken;
  const pending = data.pendingPages || [];

  if (!token || pending.length === 0) {
    return;
  }

  // Limit ingestion request to max 50 pages as required by Zod schema
  const toProcess = pending.slice(0, 50);
  const remaining = pending.slice(50);

  try {
    const response = await fetch(`${DEFAULT_BACKEND}/api/extension/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ pages: toProcess })
    });

    if (response.status === 401) {
      // Token expired, clear it
      await chrome.storage.local.remove(["nexusToken"]);
      return;
    }

    if (!response.ok) {
      throw new Error(`Ingest server returned status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      // Update recentUrls mapping
      const recent = data.recentUrls || {};
      const now = Date.now();
      toProcess.forEach((page) => {
        recent[page.url] = now;
      });

      // Update today's indexed count
      const todayStr = new Date().toDateString();
      let todayCount = data.indexedTodayCount || 0;
      if (data.indexedTodayDate === todayStr) {
        todayCount += toProcess.length;
      } else {
        todayCount = toProcess.length;
      }

      await chrome.storage.local.set({
        pendingPages: remaining,
        recentUrls: recent,
        indexedTodayCount: todayCount,
        indexedTodayDate: todayStr
      });
    }
  } catch (error) {
    // Keep files in queue and retry next time
    console.error("Failed to flush queue:", error);
  }
}
