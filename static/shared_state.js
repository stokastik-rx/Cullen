/**
 * Shared state initialization for auth + sidebar across all pages
 * Ensures consistent UI state on / (chat) and /roster pages
 */

(() => {
  'use strict';

  let isInitialized = false;

  /**
   * Initialize auth state: update buttons, user card, and load sidebar threads
   * Called on page load for both chat and roster pages
   */
  async function initSharedState() {
    if (isInitialized) {
      console.log('[SharedState] Already initialized, skipping');
      return;
    }

    // Wait for Auth and SidebarThreads modules to be available
    if (typeof Auth === 'undefined') {
      console.warn('[SharedState] Auth module not loaded yet');
      return;
    }

    isInitialized = true;

    try {
      // Step 1: Update auth buttons based on login state
      Auth.updateAuthButtons();

      // Step 2: Load user profile and update user card
      const isLoggedIn = Auth.isLoggedIn();
      
      if (isLoggedIn) {
        try {
          const profile = await Auth.getUserProfile();
          Auth.updateUserCard(profile.username, profile.subscription_tier);
        } catch (error) {
          console.error('[SharedState] Error loading user profile:', error);
          // If token is invalid, clear it and show guest state
          if (error.message && (error.message.includes('Unauthorized') || error.message.includes('401'))) {
            Auth.clearAuthToken();
            Auth.updateAuthButtons();
          }
          Auth.updateUserCard('Guest', 'BASE');
        }
      } else {
        Auth.updateUserCard('Guest', 'BASE');
      }

      // Step 3: Initialize sidebar threads if SidebarThreads module is available
      if (typeof window.SidebarThreads !== 'undefined' && window.SidebarThreads.loadThreads) {
        // SidebarThreads.init() is called automatically on DOMContentLoaded
        // But we ensure threads are loaded after auth state is set
        if (isLoggedIn) {
          await window.SidebarThreads.loadThreads();
        } else {
          // Clear threads if logged out
          if (window.SidebarThreads.clearActiveThread) {
            window.SidebarThreads.clearActiveThread();
          }
        }
      }
    } catch (error) {
      console.error('[SharedState] Error initializing shared state:', error);
    }
  }

  /**
   * Re-initialize shared state (useful after login/logout)
   */
  async function refreshSharedState() {
    isInitialized = false;
    await initSharedState();
  }

  // Auto-initialize on DOM ready
  // Wait for other modules (Auth, SidebarThreads) to be loaded
  let retryCount = 0;
  const MAX_RETRIES = 20; // Max 1 second of retries (20 * 50ms)

  function tryInit() {
    // Check if required modules are loaded
    const authReady = typeof Auth !== 'undefined' && typeof Auth.updateAuthButtons === 'function';
    const sidebarReady = typeof window.SidebarThreads !== 'undefined' && typeof window.SidebarThreads.loadThreads === 'function';
    
    if (authReady && sidebarReady) {
      initSharedState();
    } else if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(tryInit, 50);
    } else {
      console.warn('[SharedState] Modules not loaded after max retries. Auth:', authReady, 'Sidebar:', sidebarReady);
      // Try to initialize anyway with what we have
      if (authReady) {
        Auth.updateAuthButtons();
        const isLoggedIn = Auth.isLoggedIn();
        if (isLoggedIn) {
          Auth.getUserProfile()
            .then(profile => Auth.updateUserCard(profile.username, profile.subscription_tier))
            .catch(() => Auth.updateUserCard('Guest', 'BASE'));
        } else {
          Auth.updateUserCard('Guest', 'BASE');
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(tryInit, 100);
    });
  } else {
    // DOM already loaded
    setTimeout(tryInit, 100);
  }

  // Listen for thread updates from other pages/tabs (set up once)
  let listenerSetup = false;
  function setupThreadUpdateListener() {
    if (listenerSetup) return;
    listenerSetup = true;
    
    window.addEventListener('sidebar:threads-updated', async () => {
      if (typeof window.SidebarThreads !== 'undefined' && window.SidebarThreads.loadThreads) {
        await window.SidebarThreads.loadThreads();
      }
    });
  }

  // Setup listener when modules are ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupThreadUpdateListener);
  } else {
    setupThreadUpdateListener();
  }

  // Expose API
  window.SharedState = {
    init: initSharedState,
    refresh: refreshSharedState,
  };
})();

