// =========================
// /static/roster_shared.js
// Shared roster storage + sidebar rendering (all pages)
// =========================

(() => {
  const STORAGE_KEY = "cullen_roster_cards_v1";
  const META_KEY = "cullen_roster_cards_meta_v1";
  const API_LIST_URL = "/api/v1/roster/cards";

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  function getMeta() {
    const raw = localStorage.getItem(META_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (!parsed || typeof parsed !== "object") return { updatedAt: 0 };
    const updatedAt = typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0;
    return { updatedAt };
  }

  function getLocalUpdatedAt() {
    return getMeta().updatedAt || 0;
  }

  function touchLocalUpdatedAt() {
    localStorage.setItem(META_KEY, JSON.stringify({ updatedAt: Date.now() }));
  }

  function getAuthToken() {
    if (typeof Auth !== 'undefined' && Auth.getAuthToken) {
    return Auth.getAuthToken();
    }
    return localStorage.getItem("access_token");
  }

  async function fetchCardsFromApi() {
    const token = getAuthToken();
    if (!token) return null;
    try {
      const res = await fetch(API_LIST_URL, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  }

  async function saveCardsToApi(cards) {
    const token = getAuthToken();
    if (!token) return false;
    try {
      const res = await fetch(API_LIST_URL, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cards),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  function loadCards() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.id === "string")
      .map((x) => ({
        id: String(x.id),
        name: String(x.name || "").trim(),
        bg: String(x.bg || "").trim(),
      }))
      .filter((x) => x.name.length > 0);
  }

  function saveCards(cards, opts = {}) {
    const persistRemote = opts.persistRemote !== false;
    const touch = opts.touch !== false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    if (touch) touchLocalUpdatedAt();
    // If logged in, persist per-account roster to the backend (best-effort).
    // We don't block the UI on this to keep the roster page snappy.
    if (persistRemote) void saveCardsToApi(cards);
  }

  function deleteCard(id) {
    const cards = loadCards().filter((c) => c.id !== id);
    saveCards(cards);
    renderSidebar(); // refresh sidebar everywhere
    // notify roster page (if open)
    window.dispatchEvent(new CustomEvent("roster:changed"));
  }

  /**
   * Format name as spaced caps: "Shay" -> "S H A Y"
   */
  function formatSpacedCaps(name) {
    return name.trim().toUpperCase().split("").join(" ");
  }

  /**
   * Get active roster filter from URL or localStorage
   */
  function getActiveRosterFilter() {
    const params = new URLSearchParams(window.location.search);
    const rosterId = params.get('roster');
    return rosterId || null;
  }

  /**
   * Set active roster filter and update URL
   */
  function setActiveRosterFilter(rosterId) {
    const params = new URLSearchParams(window.location.search);
    if (rosterId) {
      params.set('roster', rosterId);
    } else {
      params.delete('roster');
    }
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.pushState({ roster: rosterId }, '', newUrl);
    
    // Dispatch event for other modules
    window.dispatchEvent(new CustomEvent('roster:filter-changed', {
      detail: { rosterId }
    }));
  }

  /**
   * Enter workspace mode for a roster
   */
  function enterWorkspaceMode(rosterId) {
    setActiveRosterFilter(rosterId);
    updateWorkspaceHeader(rosterId);
    
    // Dispatch event to reload chat list
    window.dispatchEvent(new CustomEvent('roster:filter-changed', {
      detail: { rosterId }
    }));
    
    // Check if current chat is global - if so, select first roster chat or clear
    const params = new URLSearchParams(window.location.search);
    const currentChatId = params.get('chat');
    
    if (currentChatId && window.SidebarThreads) {
      const threads = window.SidebarThreads.getThreads();
      const currentThread = threads.find(t => t.id === parseInt(currentChatId, 10));
      
      if (currentThread) {
        const threadRosterId = currentThread.roster_card_id || currentThread.roster_id;
        if (threadRosterId !== rosterId) {
          // Current chat is not in this roster - select first roster chat or clear
          const rosterThreads = threads.filter(t => {
            const tRosterId = t.roster_card_id || t.roster_id;
            return tRosterId === rosterId;
          });
          
          if (rosterThreads.length > 0) {
            // Select most recent roster chat
            window.SidebarThreads.selectThread(rosterThreads[0].id);
          } else {
            // Clear selection and update URL
            window.SidebarThreads.clearActiveThread();
            const newParams = new URLSearchParams();
            newParams.set('roster', rosterId);
            window.history.pushState({ roster: rosterId }, '', '/?' + newParams.toString());
          }
        }
      }
    }
  }

  /**
   * Exit workspace mode (return to global mode)
   */
  function exitWorkspaceMode() {
    setActiveRosterFilter(null);
    updateWorkspaceHeader(null);
    
    // Dispatch event to reload chat list
    window.dispatchEvent(new CustomEvent('roster:filter-changed', {
      detail: { rosterId: null }
    }));
    
    // Check if current chat is roster-specific - if so, select first global chat or clear
    const params = new URLSearchParams(window.location.search);
    const currentChatId = params.get('chat');
    
    if (currentChatId && window.SidebarThreads) {
      const threads = window.SidebarThreads.getThreads();
      const currentThread = threads.find(t => t.id === parseInt(currentChatId, 10));
      
      if (currentThread) {
        const threadRosterId = currentThread.roster_card_id || currentThread.roster_id;
        if (threadRosterId) {
          // Current chat is roster-specific - select first global chat or clear
          const globalThreads = threads.filter(t => {
            const tRosterId = t.roster_card_id || t.roster_id;
            return !tRosterId || tRosterId === '';
          });
          
          if (globalThreads.length > 0) {
            // Select most recent global chat
            window.SidebarThreads.selectThread(globalThreads[0].id);
          } else {
            // Clear selection and update URL
            window.SidebarThreads.clearActiveThread();
            window.history.pushState({}, '', '/');
          }
        }
      }
    } else {
      // No chat selected, just update URL
      window.history.pushState({}, '', '/');
    }
  }

  /**
   * Update workspace header display
   */
  function updateWorkspaceHeader(rosterId) {
    const header = document.getElementById('workspaceHeader');
    const titleEl = document.getElementById('workspaceTitle');
    
    if (!header || !titleEl) return;
    
    if (rosterId) {
      const cards = loadCards();
      const card = cards.find(c => c.id === rosterId);
      if (card) {
        titleEl.textContent = formatSpacedCaps(card.name);
        header.style.display = 'block';
        return;
      }
    }
    
    header.style.display = 'none';
  }

  /**
   * Update roster filter header display (legacy - kept for compatibility)
   */
  function updateRosterFilterHeader(rosterId) {
    // Legacy function - workspace header is now used instead
    updateWorkspaceHeader(rosterId);
  }

  /**
   * Show toast notification that roster is not implemented
   */
  function showRosterNotImplementedToast() {
    // Try to use existing toast system if available
    if (typeof window.SidebarThreads !== 'undefined' && window.SidebarThreads.showToast) {
      window.SidebarThreads.showToast('Sorry — Roster will be implemented in CullenPill 1.5.', 'info');
      return;
    }
    
    // Fallback: create simple toast
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a1a;
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      opacity: 0;
      transition: opacity 150ms ease;
    `;
    toast.textContent = 'Sorry — Roster will be implemented in CullenPill 1.5.';
    document.body.appendChild(toast);
    
    // Fade in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
    });
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 150);
    }, 3000);
  }

  function renderSidebar() {
    const list = document.getElementById("interestList");
    if (!list) return;

    // Don't render roster items - feature disabled
    list.innerHTML = "";
    return;

    const cards = loadCards();
    list.innerHTML = "";

    const activeRosterId = getActiveRosterFilter();

    for (const c of cards) {
      const row = document.createElement("div");
      row.className = `interest-item ${activeRosterId === c.id ? 'active' : ''}`;
      row.dataset.cardId = c.id;

      // Content wrapper (title + optional subtitle)
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "interest-item-content";

      const title = document.createElement("div");
      title.className = "interest-item-title";
      // Display name normally (no spaced letters)
      title.textContent = c.name.trim();

      contentWrapper.appendChild(title);

      // Optional subtitle from bg field
      if (c.bg && c.bg.trim()) {
        const subtitle = document.createElement("div");
        subtitle.className = "interest-item-subtitle";
        subtitle.textContent = c.bg.trim();
        contentWrapper.appendChild(subtitle);
      }

      // Click handler for the entire row - DISABLED (roster feature not released)
      row.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Don't trigger if clicking menu
        if (e.target.closest(".mini-menu")) return;
        
        // Show "not implemented" message
        showRosterNotImplementedToast();
      });

      // No menu for roster items - removed per user request
      row.appendChild(contentWrapper);
      list.appendChild(row);
    }
    
    // Update header display
    updateRosterFilterHeader(activeRosterId);
  }

  // Listen for roster filter changes
  window.addEventListener('roster:filter-changed', (e) => {
    updateWorkspaceHeader(e.detail.rosterId);
  });

  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    const activeRosterId = getActiveRosterFilter();
    updateWorkspaceHeader(activeRosterId);
    renderSidebar(); // Re-render to update active state
  });

  // Setup workspace back button
  document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('workspaceBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        exitWorkspaceMode();
      });
    }
  });

  // Initialize workspace header on page load
  function initWorkspaceHeader() {
    // Check URL params first
    const params = new URLSearchParams(window.location.search);
    const urlRosterId = params.get('roster');
    
    if (urlRosterId) {
      // Set active roster filter from URL
      setActiveRosterFilter(urlRosterId);
          }
    
    const activeRosterId = getActiveRosterFilter();
    updateWorkspaceHeader(activeRosterId);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorkspaceHeader);
  } else {
    initWorkspaceHeader();
  }

  function closeAllMiniMenus() {
    document.querySelectorAll(".mini-menu.open").forEach((el) => el.classList.remove("open"));
  }

  // Close menus on outside click / ESC
  document.addEventListener("click", () => closeAllMiniMenus());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllMiniMenus();
  });

  /**
   * Sync roster from API and update sidebar
   * Called on login or when auth state changes
   */
  async function syncRosterFromApi() {
    const token = getAuthToken();
    if (!token) {
      // Not logged in - clear sidebar roster
      renderSidebar();
      return;
    }

    try {
      const startUpdatedAt = getLocalUpdatedAt();
      const cards = await fetchCardsFromApi();
      if (Array.isArray(cards)) {
        // Race-condition guard: if the user made local edits while the fetch was in-flight,
        // do NOT overwrite their local changes with stale server data.
        if (getLocalUpdatedAt() !== startUpdatedAt) return;

        // Apply server state without "touching" local modified time and without writing back to server.
        saveCards(cards, { touch: false, persistRemote: false });
        renderSidebar();
        window.dispatchEvent(new CustomEvent("roster:changed"));
      } else {
        // No cards from API - clear local storage and sidebar
        localStorage.removeItem(STORAGE_KEY);
        renderSidebar();
        window.dispatchEvent(new CustomEvent("roster:changed"));
      }
    } catch (error) {
      console.error('[RosterStore] Error syncing roster from API:', error);
      // On error, keep existing sidebar state
    }
  }

  /**
   * Handle auth changed event
   */
  function handleAuthChanged(event) {
    const { loggedIn } = event.detail || {};
    if (loggedIn) {
      // User logged in - fetch roster from API
      syncRosterFromApi();
    } else {
      // User logged out - clear roster
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(META_KEY);
      renderSidebar();
      window.dispatchEvent(new CustomEvent("roster:changed"));
    }
  }

  /**
   * Handle auth login event - sync roster from API
   */
  function handleAuthLogin() {
    syncRosterFromApi();
  }

  /**
   * Handle auth logout event - clear roster
   */
  function handleAuthLogout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_KEY);
    renderSidebar();
    window.dispatchEvent(new CustomEvent("roster:changed"));
  }

  // Listen for auth events
  window.addEventListener('auth:changed', handleAuthChanged);
  window.addEventListener('auth:login', handleAuthLogin);
  window.addEventListener('auth:logout', handleAuthLogout);

  // Re-render if another tab changes localStorage
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY || e.key === META_KEY) renderSidebar();
  });

  // Public API
  window.RosterStore = {
    STORAGE_KEY,
    loadCards,
    saveCards,
    deleteCard,
    renderSidebar,
    getActiveRosterFilter,
    setActiveRosterFilter,
    enterWorkspaceMode,
    exitWorkspaceMode,
    updateWorkspaceHeader,
    fetchCardsFromApi,
    syncRosterFromApi,
  };

  // initial
  renderSidebar();

  // If we have a JWT, sync roster from the backend and re-render sidebar.
  // This ensures roster cards are stored per-account while still allowing
  // guest users to use localStorage.
  syncRosterFromApi();
})();
