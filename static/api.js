/**
 * Centralized API client for all authenticated requests
 * Handles token management, base URL, and error handling
 */

(() => {
  'use strict';

  const API_BASE = '/api/v1';

  /**
   * Get authentication token from localStorage
   */
  function getAuthToken() {
    if (typeof Auth !== 'undefined' && Auth.getAuthToken) {
      return Auth.getAuthToken();
    }
    return localStorage.getItem('access_token');
  }

  /**
   * Make an authenticated API request
   * @param {string} endpoint - API endpoint (e.g., '/auth/me' or '/chat')
   * @param {object} options - Fetch options (method, body, headers, etc.)
   * @returns {Promise<any>} - Parsed JSON response or null for 204 No Content
   */
  async function apiRequest(endpoint, options = {}) {
    const token = getAuthToken();
    
    // Build full URL
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add Authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Make request
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle errors
    if (!response.ok) {
      let errorMsg = `API error: ${response.status}`;
      let errorBody = null;
      
      try {
        errorBody = await response.json();
        errorMsg = errorBody.detail || errorBody.message || errorMsg;
        console.error(`[API] Error ${response.status} ${endpoint}:`, {
          url,
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        });
      } catch (parseError) {
        try {
          const text = await response.text();
          console.error(`[API] Error ${response.status} ${endpoint} (non-JSON):`, {
            url,
            status: response.status,
            statusText: response.statusText,
            body: text,
          });
        } catch {
          console.error(`[API] Error ${response.status} ${endpoint}:`, {
            url,
            status: response.status,
            statusText: response.statusText,
          });
        }
      }
      
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      
      // Handle 403 CHAT_LIMIT errors
      if (response.status === 403) {
        const error = new Error(errorMsg);
        error.status = 403;
        if (errorBody) {
          error.code = errorBody.code || errorBody.detail?.code;
          error.detail = errorBody.detail || errorBody;
        }
        throw error;
      }
      
      throw new Error(errorMsg);
    }

    // Handle 204 No Content (DELETE responses)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }

    // Parse JSON response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return null;
  }

  /**
   * Make an unauthenticated API request (for signup/login)
   * @param {string} endpoint - API endpoint
   * @param {object} options - Fetch options
   * @returns {Promise<any>} - Parsed JSON response
   */
  async function publicRequest(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    
    const headers = {
      ...options.headers,
    };

    // If caller is sending a JSON string body and didn't specify Content-Type,
    // default to application/json. This prevents FastAPI from treating the body
    // as raw bytes and raising a validation error.
    const hasContentType =
      Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
    if (!hasContentType && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Expose API
  window.API = {
    request: apiRequest,
    public: publicRequest,
    getAuthToken,
  };
})();

