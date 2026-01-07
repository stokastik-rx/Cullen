/**
 * Centralized authentication client with event emission
 * Replaces scattered auth logic with a single source of truth
 */

(() => {
  'use strict';

  const TOKEN_KEY = 'access_token';
  const TOKEN_TYPE_KEY = 'token_type';
  const API_BASE = '/api/v1';

  /**
   * Get current auth token
   */
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Set auth token and emit event
   */
  function setToken(token, tokenType = 'bearer') {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_TYPE_KEY, tokenType);
    } else {
      clearToken();
      return;
    }
    
    // Emit auth changed event
    window.dispatchEvent(new CustomEvent('auth:changed', {
      detail: { loggedIn: true, token }
    }));
    
    // Emit auth:login event for roster sync
    window.dispatchEvent(new CustomEvent('auth:login'));
  }

  /**
   * Clear auth token and emit event
   */
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_TYPE_KEY);
    
    // Clear roster storage
    localStorage.removeItem('cullen_roster_cards_v1');
    localStorage.removeItem('cullen_roster_cards_meta_v1');
    localStorage.removeItem('cullen_chat_roster_associations');
    
    // Emit auth changed event
    window.dispatchEvent(new CustomEvent('auth:changed', {
      detail: { loggedIn: false }
    }));
    
    // Emit auth:logout event for roster sync
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  /**
   * Check if user is logged in
   */
  function isLoggedIn() {
    return getToken() !== null;
  }

  /**
   * Get current user profile
   */
  async function getMe() {
    const token = getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    // Use centralized API client if available
    if (typeof window.API !== 'undefined' && window.API.request) {
      return await window.API.request('/auth/me', { method: 'GET' });
    }

    // Fallback to direct fetch
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to get user profile');
    }
    return await response.json();
  }

  /**
   * Login with username/email and password
   */
  async function login(usernameOrEmail, password) {
    const formData = new URLSearchParams();
    formData.append('username', usernameOrEmail);
    formData.append('password', password);

    // Use centralized API client if available
    if (typeof window.API !== 'undefined' && window.API.public) {
      try {
        const data = await window.API.public('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData,
        });
        if (data && data.access_token) {
          setToken(data.access_token, data.token_type || 'bearer');
          return data;
        } else {
          throw new Error('Invalid login response: missing access_token');
        }
      } catch (error) {
        console.error('[AuthClient] Login error:', error);
        throw error;
      }
    }

    // Fallback to direct fetch
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.detail || errorData.message || 'Login failed';
      console.error('[AuthClient] Login failed:', response.status, errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    if (data && data.access_token) {
      setToken(data.access_token, data.token_type || 'bearer');
      return data;
    } else {
      throw new Error('Invalid login response: missing access_token');
    }
  }

  /**
   * Signup with email, username, and password
   */
  async function signup(email, username, password) {
    const payload = { email, username, password };

    // Use centralized API client if available
    if (typeof window.API !== 'undefined' && window.API.public) {
      return await window.API.public('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    // Fallback to direct fetch
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Signup failed');
    }
    return await response.json();
  }

  /**
   * Logout (clear token)
   */
  function logout() {
    clearToken();
  }

  // Expose API
  window.AuthClient = {
    getToken,
    setToken,
    clearToken,
    isLoggedIn,
    getMe,
    login,
    signup,
    logout,
  };
})();

