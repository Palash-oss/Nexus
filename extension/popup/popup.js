// Popup script for Nexus Search Extension

const DEFAULT_BACKEND = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const userInfo = document.getElementById("user-info");
  const connectBtn = document.getElementById("connect-btn");
  const tokenContainer = document.getElementById("token-container");
  const tokenInput = document.getElementById("token-input");
  const saveTokenBtn = document.getElementById("save-token-btn");
  const statQueued = document.getElementById("stat-queued");
  const statIndexed = document.getElementById("stat-indexed");
  const pauseToggle = document.getElementById("pause-toggle");
  const batteryToggle = document.getElementById("battery-toggle");
  const popupSearch = document.getElementById("popup-search");
  const searchBtn = document.getElementById("search-btn");
  const recentList = document.getElementById("recent-list");

  // Check status and update UI
  function updateUI() {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (status) => {
      if (chrome.runtime.lastError || !status) {
        return;
      }

      statQueued.textContent = status.queueLength;
      statIndexed.textContent = status.totalIndexed;
      pauseToggle.checked = status.isPaused;

      chrome.storage.local.get(["isBatterySavePaused"], (data) => {
        batteryToggle.checked = !!data.isBatterySavePaused;
      });

      if (status.isLoggedIn) {
        statusDot.className = "dot dot-green";
        statusText.textContent = "Connected";
        connectBtn.textContent = "Disconnect";
        tokenContainer.classList.add("hidden");
        
        // Show user email if stored, otherwise generic account msg
        chrome.storage.local.get(["nexusEmail", "nexusToken"], (data) => {
          if (data.nexusEmail) {
            userInfo.textContent = data.nexusEmail;
            userInfo.classList.remove("hidden");
          } else {
            userInfo.textContent = "Connected to Nexus account";
            userInfo.classList.remove("hidden");
          }
        });
      } else {
        statusDot.className = "dot dot-red";
        statusText.textContent = "Not connected";
        connectBtn.textContent = "Connect to Nexus";
        userInfo.classList.add("hidden");
        tokenContainer.classList.remove("hidden");
      }
    });

    // Populate the last 5 pages indexed
    chrome.storage.local.get(["recentUrls"], (data) => {
      const recent = data.recentUrls || {};
      const sortedUrls = Object.entries(recent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(entry => entry[0]);

      if (sortedUrls.length > 0) {
        recentList.innerHTML = "";
        sortedUrls.forEach(url => {
          const li = document.createElement("li");
          li.title = url;
          try {
            const parsed = new URL(url);
            li.textContent = `${parsed.hostname}${parsed.pathname}`;
          } catch {
            li.textContent = url;
          }
          recentList.appendChild(li);
        });
      } else {
        recentList.innerHTML = '<li class="empty-list">No pages indexed recently.</li>';
      }
    });
  }

  // Connect/Disconnect Action
  connectBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (status) => {
      if (status?.isLoggedIn) {
        // Disconnect
        chrome.runtime.sendMessage({ type: "CLEAR_TOKEN" }, () => {
          chrome.storage.local.remove(["nexusEmail", "nexusToken"], () => {
            updateUI();
          });
        });
      } else {
        // Connect - Open auth flow
        chrome.tabs.create({ url: `${DEFAULT_BACKEND}/extension/connect` });
      }
    });
  });

  // Manual save token
  saveTokenBtn.addEventListener("click", () => {
    const token = tokenInput.value.trim();
    if (!token) return;

    chrome.runtime.sendMessage({ type: "SET_TOKEN", token }, (res) => {
      if (res?.success) {
        tokenInput.value = "";
        // Try to fetch email from backend to store alongside token
        fetch(`${DEFAULT_BACKEND}/api/extension/token`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        })
        .then(r => r.json())
        .then(data => {
          if (data.email) {
            chrome.storage.local.set({ nexusEmail: data.email }, () => updateUI());
          } else {
            updateUI();
          }
        })
        .catch(() => updateUI());
      }
    });
  });

  // Pause / Resume Toggle
  pauseToggle.addEventListener("change", (e) => {
    chrome.runtime.sendMessage({ type: "TOGGLE_PAUSE", value: e.target.checked }, () => {
      updateUI();
    });
  });

  // Battery Save Toggle
  batteryToggle.addEventListener("change", (e) => {
    chrome.storage.local.set({ isBatterySavePaused: e.target.checked }, () => {
      updateUI();
    });
  });

  // Quick Search inside popup
  function runSearch() {
    const q = popupSearch.value.trim();
    if (q) {
      chrome.tabs.create({ url: `${DEFAULT_BACKEND}/?q=${encodeURIComponent(q)}` });
    }
  }

  searchBtn.addEventListener("click", runSearch);
  popupSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  // Initial update
  updateUI();

  // Poll status every 5 seconds
  setInterval(updateUI, 5000);
});
