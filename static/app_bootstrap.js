/**
 * Application bootstrap: initializes auth state on both pages
 * Updates UI elements (auth buttons, user card) and emits ready event
 */

(() => {
  'use strict';

  /**
   * Update auth buttons based on login state
   */
  function updateAuthButtons() {
    const signupBtn = document.getElementById('signupBtn');
    const loginBtn = document.getElementById('loginBtn');
    const loggedIn = window.AuthClient && window.AuthClient.isLoggedIn();

    if (signupBtn) {
      if (loggedIn) {
        signupBtn.classList.add('hidden');
      } else {
        signupBtn.classList.remove('hidden');
      }
    }
    
    if (loginBtn) {
      loginBtn.textContent = loggedIn ? 'Log Out' : 'Log In';
    }
  }

  /**
   * Update user card with username and tier
   */
  function updateUserCard(username, tier) {
    const userNameEl = document.getElementById('userName');
    const userTierEl = document.getElementById('userTier');
    
    if (userNameEl) {
      userNameEl.textContent = username || 'Guest';
    }
    
    if (userTierEl) {
      userTierEl.textContent = tier || 'BASE';
      userTierEl.className = `user-tier tier-${(tier || 'BASE').toLowerCase()}`;
    }
  }

  /**
   * Initialize auth state on page load
   */
  async function initAuth() {
    if (!window.AuthClient) {
      console.warn('[AppBootstrap] AuthClient not loaded');
      return;
    }

    try {
      // Update buttons immediately
      updateAuthButtons();

      // Check if logged in
      const isLoggedIn = window.AuthClient.isLoggedIn();
      
      if (isLoggedIn) {
        try {
          // Fetch user profile
          const profile = await window.AuthClient.getMe();
          updateUserCard(profile.username, profile.subscription_tier);
        } catch (error) {
          console.error('[AppBootstrap] Error loading user profile:', error);
          // If token is invalid, clear it
          if (error.message && (error.message.includes('Unauthorized') || error.message.includes('401'))) {
            window.AuthClient.clearToken();
            updateAuthButtons();
          }
          updateUserCard('Guest', 'BASE');
        }
      } else {
        updateUserCard('Guest', 'BASE');
      }

      // Emit ready event
      window.dispatchEvent(new CustomEvent('auth:ready', {
        detail: { loggedIn: isLoggedIn }
      }));
    } catch (error) {
      console.error('[AppBootstrap] Error initializing auth:', error);
      updateUserCard('Guest', 'BASE');
      window.dispatchEvent(new CustomEvent('auth:ready', {
        detail: { loggedIn: false }
      }));
    }
  }

  /**
   * Handle auth changed events
   */
  function handleAuthChanged(event) {
    const { loggedIn } = event.detail || {};
    
    // Update buttons
    updateAuthButtons();
    
    if (loggedIn) {
      // Fetch and update user profile
      window.AuthClient.getMe()
        .then(profile => {
          updateUserCard(profile.username, profile.subscription_tier);
        })
        .catch(error => {
          console.error('[AppBootstrap] Error loading profile after auth change:', error);
          updateUserCard('Guest', 'BASE');
        });
    } else {
      // Clear user card
      updateUserCard('Guest', 'BASE');
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Wait for AuthClient to be available
      setTimeout(() => {
        if (window.AuthClient) {
          initAuth();
        } else {
          console.warn('[AppBootstrap] AuthClient not available, retrying...');
          setTimeout(initAuth, 100);
        }
      }, 50);
    });
  } else {
    setTimeout(initAuth, 50);
  }

  // Listen for auth changed events
  window.addEventListener('auth:changed', handleAuthChanged);

  // Expose API
  window.AppBootstrap = {
    updateAuthButtons,
    updateUserCard,
    initAuth,
  };
})();

