// =========================
// Sidebar Thread Management
// Shared across chat and roster pages
// =========================

(() => {
  'use strict';

  // State
  let threads = [];
  let activeThreadId = null;
  let isLoading = false;

  // DOM Elements (will be set on init)
  let chatListEl = null;
  let newChatBtn = null;

  // API Base URLs
  const API_BASE_LEGACY = '/api/v1/chat'; // Legacy endpoints (currently mounted)
  const API_BASE_NEW = '/api/v1/chats'; // New normalized endpoints (if mounted)

  // =========================
  // Toast Notifications
  // =========================
  function showToast(message, type = 'error', htmlContent = null) {
    // Remove any existing toast
    const existingToast = document.querySelector('.sidebar-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `sidebar-toast sidebar-toast-${type}`;
    
    if (htmlContent) {
      toast.innerHTML = htmlContent;
    } else {
      toast.textContent = message;
    }
    
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: fadeInUp 0.3s ease;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
      max-width: 90vw;
      text-align: center;
    `;
    
    document.body.appendChild(toast);
    
    // Attach click handlers for upgrade links
    const upgradeLink = toast.querySelector('.upgrade-link');
    if (upgradeLink) {
      upgradeLink.addEventListener('click', (e) => {
        e.preventDefault();
        // Open upgrade modal if function exists
        if (typeof window.openUpgradeModal === 'function') {
          window.openUpgradeModal();
        } else {
          // Fallback: try to trigger upgrade button click
          const upgradeBtn = document.getElementById('upgradeBtn');
          if (upgradeBtn) {
            upgradeBtn.click();
          }
        }
      });
    }
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, htmlContent ? 5000 : 3000); // Longer timeout for upgrade messages
  }

  // =========================
  // Initialization
  // =========================
  function init() {
    chatListEl = document.getElementById('chatList');
    newChatBtn = document.getElementById('newChatBtn');
    const searchChatBtn = document.getElementById('searchChatBtn');

    if (!chatListEl) {
      console.warn('[Sidebar] chatList element not found');
      return;
    }

    // Setup search chat button
    if (searchChatBtn) {
      searchChatBtn.addEventListener('click', () => {
        openSearchModal();
      });
    }

    // Load saved thread ID from localStorage
    const savedThreadId = localStorage.getItem('cullen_active_thread_id');
    
    // Check for thread ID from navigation (roster page -> chat page)
    const navThreadId = sessionStorage.getItem('cullen_select_thread_id');
    if (navThreadId) {
      sessionStorage.removeItem('cullen_select_thread_id');
    }
    
    // Roster feature disabled - ignore roster query params
    const params = new URLSearchParams(window.location.search);
    const urlRosterId = params.get('roster');
    if (urlRosterId) {
      // Remove roster param from URL if present
      params.delete('roster');
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState({}, '', newUrl);
    }
    
    // Load threads
    loadThreads().then(() => {
      // Check for chat ID from URL
      const urlChatId = params.get('chat');
      
      // Priority: URL chat > navigation thread > saved thread
      const threadIdToSelect = urlChatId ? parseInt(urlChatId, 10) : 
                                (navThreadId ? parseInt(navThreadId, 10) : 
                                (savedThreadId ? parseInt(savedThreadId, 10) : null));
      if (threadIdToSelect && !isNaN(threadIdToSelect)) {
        const threadExists = threads.find(t => t.id === threadIdToSelect);
        if (threadExists) {
          selectThread(threadIdToSelect, false);
        } else if (urlRosterId) {
          // Chat not found but we're in workspace mode - select first roster chat or show empty
          const rosterThreads = threads.filter(t => {
            const tRosterId = getThreadRosterId(t);
            return tRosterId === urlRosterId;
          });
          if (rosterThreads.length > 0) {
            selectThread(rosterThreads[0].id, false);
          }
        }
      } else if (urlRosterId && threads.length > 0) {
        // In workspace mode but no chat selected - select first roster chat
        const rosterThreads = threads.filter(t => {
          const tRosterId = getThreadRosterId(t);
          return tRosterId === urlRosterId;
        });
        if (rosterThreads.length > 0) {
          selectThread(rosterThreads[0].id, false);
        }
      }
    });

    // Listen for roster filter changes
    window.addEventListener('roster:filter-changed', () => {
      loadThreads(); // Reload threads when filter changes
    });

    // New Chat button handler
    if (newChatBtn) {
      newChatBtn.addEventListener('click', handleNewChat);
    }

    // Load roster section initially
    loadRosterSection();
  }

  // =========================
  // API Functions
  // =========================
  function getAuthToken() {
    if (typeof Auth !== 'undefined' && Auth.getAuthToken) {
      return Auth.getAuthToken();
    }
    return localStorage.getItem('access_token');
  }

  async function apiRequest(url, options = {}) {
    // Use centralized API client if available
    if (typeof window.API !== 'undefined' && window.API.request) {
      // Convert full URL to endpoint path for API client
      const endpoint = url.startsWith('/api/v1') ? url.replace('/api/v1', '') : url;
      return await window.API.request(endpoint, options);
    }
    
    // Fallback to direct fetch (legacy support)
    const token = getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Improved error logging: parse and log full error details
      let errorMsg = `API error: ${response.status}`;
      let errorBody = null;
      try {
        errorBody = await response.json();
        errorMsg = errorBody.detail || errorBody.message || errorMsg;
        // Log full error details for debugging
        console.error(`[Sidebar] API Error ${response.status}:`, {
          url,
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        });
      } catch (parseError) {
        // If JSON parse fails, try to get text
        try {
          const text = await response.text();
          console.error(`[Sidebar] API Error ${response.status} (non-JSON):`, {
            url,
            status: response.status,
            statusText: response.statusText,
            body: text,
          });
        } catch {
          console.error(`[Sidebar] API Error ${response.status}:`, {
            url,
            status: response.status,
            statusText: response.statusText,
          });
        }
      }
      
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      
      // Handle 402 Plan Limit errors (PLAN_MAX_CHATS, PLAN_MAX_MESSAGES)
      if (response.status === 402) {
        let errorData = null;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json();
          }
        } catch {
          // Ignore JSON parse errors
        }
        
        // Create error object with status and code
        const error = new Error(errorMsg);
        error.status = 402;
        if (errorData) {
          // Handle both object detail and string detail
          if (typeof errorData === 'object' && errorData.detail) {
            if (typeof errorData.detail === 'object') {
              error.code = errorData.detail.code || errorData.detail.error_code;
              error.message = errorData.detail.message || errorMsg;
              error.detail = errorData.detail;
            } else {
              error.message = errorData.detail;
              error.detail = errorData.detail;
            }
          } else if (typeof errorData === 'object') {
            error.code = errorData.code || errorData.error_code;
            error.message = errorData.message || errorMsg;
            error.detail = errorData;
          }
        }
        throw error;
      }
      
      // Try to parse error details for 403 CHAT_LIMIT
      if (response.status === 403) {
        let errorData = null;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json();
          }
        } catch {
          // Ignore JSON parse errors
        }
        
        // Create error object with status and code
        const error = new Error(errorMsg);
        error.status = 403;
        if (errorData) {
          // Handle both object detail and string detail
          if (typeof errorData === 'object' && errorData.detail) {
            if (typeof errorData.detail === 'object') {
              error.code = errorData.detail.error_code || errorData.detail.code;
              error.detail = errorData.detail;
            } else {
              error.code = errorData.detail === 'CHAT_LIMIT' ? 'CHAT_LIMIT' : null;
              error.detail = errorData.detail;
            }
          } else if (typeof errorData === 'object') {
            error.code = errorData.error_code || errorData.code;
            error.detail = errorData;
          }
        }
        throw error;
      }
      
      throw new Error(errorMsg);
    }

    // Handle 204 No Content (DELETE responses)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }

    // Check if response has content before parsing JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return null;
  }

  /**
   * Get roster associations from localStorage (fallback only)
   */
  function getRosterAssociations() {
    try {
      const stored = localStorage.getItem('cullen_chat_roster_associations');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Set roster association for a chat (fallback only - backend should handle this)
   */
  function setRosterAssociation(chatId, rosterId) {
    // Keep for backward compatibility, but backend should be source of truth
    const associations = getRosterAssociations();
    if (rosterId) {
      associations[chatId] = rosterId;
    } else {
      delete associations[chatId];
    }
    localStorage.setItem('cullen_chat_roster_associations', JSON.stringify(associations));
  }

  /**
   * Get active roster filter from URL
   */
  function getActiveRosterFilter() {
    const params = new URLSearchParams(window.location.search);
    return params.get('roster') || null;
  }

  /**
   * Get roster_card_id from thread object (handles both roster_card_id and roster_id)
   */
  function getThreadRosterId(thread) {
    // Prefer roster_card_id (database field), fallback to roster_id, then localStorage
    if (thread.roster_card_id !== undefined && thread.roster_card_id !== null) {
      return thread.roster_card_id;
    }
    if (thread.roster_id !== undefined && thread.roster_id !== null) {
      return thread.roster_id;
    }
    // Fallback to localStorage only if field doesn't exist at all
    const associations = getRosterAssociations();
    return associations[thread.id] || null;
  }

  /**
   * Filter threads by roster ID using thread.roster_card_id field
   * DISABLED: Roster feature not released - always show all threads
   */
  function filterThreadsByRoster(allThreads, rosterId) {
    // Roster feature disabled - return all threads (no filtering)
    return allThreads;
    
    // Original implementation (disabled):
    // if (!rosterId) {
    //   // Global mode: show ONLY threads where roster_card_id is null/undefined/empty (unassigned)
    //   return allThreads.filter(thread => {
    //     const threadRosterId = getThreadRosterId(thread);
    //     return !threadRosterId || threadRosterId === '';
    //   });
    // }
    // 
    // // Folder mode: show ONLY threads where roster_card_id matches activeRosterId
    // return allThreads.filter(thread => {
    //   const threadRosterId = getThreadRosterId(thread);
    //   return threadRosterId === rosterId;
    // });
  }

  // =========================
  // Thread Management
  // =========================
  async function loadThreads() {
    if (isLoading) {
      console.log('[Sidebar] loadThreads skipped - already loading');
      return;
    }
    
    try {
      isLoading = true;
      const token = getAuthToken();
      if (!token) {
        threads = [];
        renderThreads();
        return;
      }

      // GET /api/v1/chat returns List[Chat] where Chat has: id, user_id, title, messages, created_at, updated_at
      // Use legacy endpoint for listing (GET /api/v1/chat returns List[Chat])
      const data = await apiRequest(`${API_BASE_LEGACY}`);
      
      // Validate and deduplicate by ID
      const seen = new Set();
      let allThreads = [];
      
      if (Array.isArray(data)) {
        for (const item of data) {
          // Validate item structure matches Chat schema
          if (item && typeof item.id === 'number' && !seen.has(item.id)) {
            seen.add(item.id);
            // Normalize thread data (ensure all required fields exist)
            // Include roster_card_id/roster_id if present in API response
            allThreads.push({
              id: item.id,
              user_id: item.user_id,
              title: item.title || null,
              messages: Array.isArray(item.messages) ? item.messages : [],
              created_at: item.created_at,
              updated_at: item.updated_at || item.created_at,
              roster_card_id: item.roster_card_id !== undefined ? item.roster_card_id : null,
              roster_id: item.roster_id !== undefined ? item.roster_id : null,
            });
          }
        }
      }
      
      // Sort by updated_at descending (most recent first)
      allThreads.sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      });

      // Roster filtering disabled - show all threads
      threads = filterThreadsByRoster(allThreads, null);

      renderThreads();
    } catch (error) {
      console.error('[Sidebar] Error loading threads:', error);
      threads = [];
      renderThreads();
      // Don't show toast for auth errors (user might just be logged out)
      if (error.message !== 'Not authenticated' && error.message !== 'Unauthorized') {
        showToast('Failed to load chats', 'error');
      }
    } finally {
      isLoading = false;
    }
  }

  async function createThread() {
    try {
      // Use legacy endpoint: POST /api/v1/chat returns Chat: {id, user_id, title, messages, created_at, updated_at}
      const data = await apiRequest(`${API_BASE_LEGACY}`, {
        method: 'POST',
      });
      
      // Validate response has required fields
      if (!data || (typeof data.id !== 'number' && typeof data.chat_id !== 'number')) {
        console.error('[Sidebar] Invalid createThread response:', data);
        throw new Error('Invalid response from server: missing id field');
      }

      // Handle ChatThreadCreateResponse format (has both id and chat_id)
      const threadId = data.id || data.chat_id;
      if (!threadId || typeof threadId !== 'number') {
        throw new Error('Invalid response: missing thread id');
      }

      // Create normalized thread object for internal use
      const threadData = {
        id: threadId,
        user_id: data.user_id || 0, // May not be in response
        title: data.title || null,
        messages: [], // New thread has no messages yet
        created_at: data.created_at,
        updated_at: data.updated_at || data.created_at,
      };

      // Optimistically add to threads array (dedupe first)
      const existingIndex = threads.findIndex(t => t.id === threadData.id);
      if (existingIndex >= 0) {
        threads[existingIndex] = threadData;
      } else {
        threads.unshift(threadData);
      }
      
      // Immediately update sidebar with animation
      renderThreads();
      
      // Return normalized data
      return threadData;
    } catch (error) {
      console.error('[Sidebar] Error creating thread:', error);
      
      // Handle 402 Plan Limit errors (PLAN_MAX_CHATS, PLAN_MAX_MESSAGES)
      if (error.status === 402) {
        const errorCode = error.code || (error.detail && typeof error.detail === 'object' ? error.detail.code : null);
        if (errorCode === 'PLAN_MAX_CHATS' || errorCode === 'PLAN_MAX_MESSAGES') {
          const message = error.message || (error.detail && typeof error.detail === 'object' ? error.detail.message : 'Plan limit reached');
          showLimitModal(message);
          throw error; // Stop normal flow
        }
      }
      
      // Check if this is a chat limit error (403 with CHAT_LIMIT code)
      const isChatLimitError = 
        error.status === 403 && (
          error.code === 'CHAT_LIMIT' ||
          error.message?.includes('CHAT_LIMIT') ||
          (error.detail && (
            (typeof error.detail === 'object' && (error.detail.error_code === 'CHAT_LIMIT' || error.detail.code === 'CHAT_LIMIT')) ||
            (typeof error.detail === 'string' && error.detail.includes('CHAT_LIMIT'))
          ))
        );
      
      if (isChatLimitError) {
        // Show upgrade required modal instead of toast
        showUpgradeRequiredModal();
        throw error;
      }
      
      showToast('Failed to create new chat', 'error');
      throw error;
    }
  }

  async function loadMessages(threadId) {
    try {
      // Use legacy endpoint: GET /api/v1/chat/{id} returns Chat with messages array
      const data = await apiRequest(`${API_BASE_LEGACY}/${threadId}`);
      // Returns Chat object with messages array
      return Array.isArray(data?.messages) ? data.messages : [];
    } catch (error) {
      console.error('[Sidebar] Error loading messages:', error);
      showToast('Failed to load messages', 'error');
      throw error;
    }
  }

  async function sendMessage(threadId, messageText) {
    try {
      let actualThreadId = threadId;
      const titlePreview = messageText.trim().substring(0, 40);
      
      // Roster feature disabled - don't associate threads with roster
      const currentRosterId = null;
      
      // Step 1: Create thread if it doesn't exist (optimistic UI update)
      if (!actualThreadId) {
        // Optimistically add thread to sidebar immediately for instant feedback
        const optimisticId = Date.now(); // Temporary ID
        const optimisticThread = {
          id: optimisticId,
          user_id: 0,
          title: titlePreview,
          messages: [{ role: 'user', content: messageText }],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          roster_card_id: null, // Roster feature disabled
          _isOptimistic: true, // Flag for later replacement
        };
        
        // Add optimistically to sidebar with animation
        threads.unshift(optimisticThread);
        renderThreads();
        
        // Create thread via API (legacy endpoint: POST /api/v1/chat)
        const newThread = await createThread();
        actualThreadId = newThread.id;
        
        // Replace optimistic thread with real one
        const optimisticIndex = threads.findIndex(t => t._isOptimistic);
        if (optimisticIndex >= 0) {
          threads[optimisticIndex] = {
            ...newThread,
            title: titlePreview, // Set title from first message
            roster_card_id: currentRosterId || null, // Preserve roster association
          };
        } else {
          // Fallback: add real thread
          threads.unshift({
            ...newThread,
            title: titlePreview,
            roster_card_id: currentRosterId || null, // Preserve roster association
          });
        }
        
        // Dedupe by ID (remove optimistic if real thread exists)
        const seen = new Set();
        threads = threads.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
        
        renderThreads();
      }
      
      // Step 2: Send message using legacy endpoint (handles user + assistant response atomically)
      // POST /api/v1/chat/message expects {message: str, chat_id: int}
      // Returns {response: str, thread_id: int}
      let data;
      try {
        data = await apiRequest(`${API_BASE_LEGACY}/message`, {
          method: 'POST',
          body: JSON.stringify({
            message: messageText,
            chat_id: actualThreadId,
          }),
        });
      } catch (messageError) {
        // Handle 402 Plan Limit errors for message sending
        if (messageError.status === 402) {
          const errorCode = messageError.code || (messageError.detail && typeof messageError.detail === 'object' ? messageError.detail.code : null);
          if (errorCode === 'PLAN_MAX_CHATS' || errorCode === 'PLAN_MAX_MESSAGES') {
            const message = messageError.message || (messageError.detail && typeof messageError.detail === 'object' ? messageError.detail.message : 'Plan limit reached');
            showLimitModal(message);
            // Remove optimistic thread on error
            threads = threads.filter(t => !t._isOptimistic);
            renderThreads();
            throw messageError; // Stop normal flow
          }
        }
        throw messageError; // Re-throw other errors
      }
      
      // Backend returns ChatResponse with thread_id for new threads
      const returnedThreadId = data.thread_id || actualThreadId;
      
      // Associate new chat with active roster filter if set (fallback - backend should handle)
      if (currentRosterId && returnedThreadId) {
        setRosterAssociation(returnedThreadId, currentRosterId);
      }
      
      // Step 3: Update sidebar with server state
      // Reload threads to get updated title (backend auto-titles from first message)
      await loadThreads();
      
      // Step 4: Ensure active thread stays selected
      selectThread(returnedThreadId, false);
      
      // Dispatch event for cross-page updates (if other tabs/pages are open)
      window.dispatchEvent(new CustomEvent('sidebar:threads-updated', {
        detail: { threadId: returnedThreadId }
      }));
      
      return {
        response: data.response || 'message received',
        thread_id: returnedThreadId,
      };
    } catch (error) {
      console.error('[Sidebar] Error sending message:', error);
      
      // Handle 402 Plan Limit errors (already handled in try block, but check here too)
      if (error.status === 402) {
        const errorCode = error.code || (error.detail && typeof error.detail === 'object' ? error.detail.code : null);
        if (errorCode === 'PLAN_MAX_CHATS' || errorCode === 'PLAN_MAX_MESSAGES') {
          // Already handled in try block, just clean up
          threads = threads.filter(t => !t._isOptimistic);
          renderThreads();
          throw error; // Stop normal flow
        }
      }
      
      // Check if error occurred during thread creation (chat limit)
      if (error.message?.includes('CHAT_LIMIT') || error.code === 'CHAT_LIMIT' || 
          (error.status === 403 && error.message?.includes('chat'))) {
        // Error already handled in createThread(), just clean up optimistic thread
        threads = threads.filter(t => !t._isOptimistic);
        renderThreads();
        throw error; // Re-throw to prevent generic error toast
      }
      
      // Remove optimistic thread on error
      threads = threads.filter(t => !t._isOptimistic);
      renderThreads();
      
      showToast('Failed to send message', 'error');
      throw error;
    }
  }

  // =========================
  // Thread Selection
  // =========================
  function selectThread(threadId, saveToStorage = true) {
    activeThreadId = threadId;
    
    if (saveToStorage && threadId != null) {
      localStorage.setItem('cullen_active_thread_id', threadId.toString());
      
      // Update URL with chat ID (roster feature disabled - no roster params)
      const params = new URLSearchParams(window.location.search);
      params.set('chat', threadId.toString());
      params.delete('roster'); // Remove roster param if present
      const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.pushState({ chat: threadId }, '', newUrl);
    }

    renderThreads();
    
    // Dispatch custom event for other modules to listen
    window.dispatchEvent(new CustomEvent('thread:selected', {
      detail: { threadId, thread: threads.find(t => t.id === threadId) }
    }));
  }

  function clearActiveThread() {
    activeThreadId = null;
    localStorage.removeItem('cullen_active_thread_id');
    renderThreads();
    
    window.dispatchEvent(new CustomEvent('thread:cleared'));
  }

  function handleNewChat() {
    clearActiveThread();
    
    // If on roster page, navigate to chat page
    if (window.location.pathname === '/roster') {
      window.location.href = '/';
      return;
    }
    
    // Roster feature disabled - always use global mode
    window.history.pushState({}, '', '/');
  }

  // =========================
  // Rendering
  // =========================
  function renderThreads() {
    if (!chatListEl) return;

    // Store previous thread IDs for animation detection
    const previousIds = new Set(Array.from(chatListEl.children).map(el => {
      const id = el.dataset.threadId;
      return id ? parseInt(id, 10) : null;
    }).filter(id => id !== null));

    // Crossfade animation: fade out old list
    chatListEl.style.opacity = '0';
    chatListEl.style.transform = 'translateY(4px)';
    chatListEl.style.transition = 'opacity 120ms ease-out, transform 120ms ease-out';
    
    setTimeout(() => {
      chatListEl.innerHTML = '';
      
      // Reset transition for fade-in
      chatListEl.style.opacity = '0';
      chatListEl.style.transform = 'translateY(4px)';
      chatListEl.style.transition = 'opacity 160ms ease-out, transform 160ms ease-out';

      if (threads.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'chat-list-empty';
        const activeRosterId = getActiveRosterFilter();
        emptyMsg.textContent = activeRosterId ? 'No chats in this roster' : 'No chats yet';
        emptyMsg.style.cssText = 'padding: 12px; color: rgba(255,255,255,0.5); font-size: 14px; text-align: center;';
        chatListEl.appendChild(emptyMsg);
        
        // Fade in empty state
        requestAnimationFrame(() => {
          chatListEl.style.opacity = '1';
          chatListEl.style.transform = 'translateY(0)';
        });
        return;
      }

      // Dedupe again just to be safe (by ID)
      const rendered = new Set();
      
      threads.forEach(thread => {
        if (rendered.has(thread.id)) return;
        rendered.add(thread.id);
        
        const item = createThreadItem(thread);
        
        // Add animation class if this is a new thread or moved to top
        const isNew = !previousIds.has(thread.id);
        const isMovedToTop = previousIds.has(thread.id) && threads.indexOf(thread) === 0;
        
        if (isNew || isMovedToTop) {
          item.classList.add('chat-item-enter');
        }
        
        chatListEl.appendChild(item);
        
        // Trigger animation on next frame
        if (item.classList.contains('chat-item-enter')) {
          requestAnimationFrame(() => {
            item.classList.add('chat-item-enter-active');
          });
        }
      });
      
      // Fade in new list
      requestAnimationFrame(() => {
        chatListEl.style.opacity = '1';
        chatListEl.style.transform = 'translateY(0)';
      });
    }, 120); // Old list fade-out timing
  }

  /**
   * Create a summary of the first message for the title
   */
  function summarizeFirstMessage(content) {
    if (!content) return 'New chat';
    const trimmed = content.trim();
    if (trimmed.length <= 50) return trimmed;
    // Take first 50 chars and add ellipsis
    return trimmed.substring(0, 50) + '...';
  }

  function createThreadItem(thread) {
    const item = document.createElement('div');
    item.className = `chat-item ${thread.id === activeThreadId ? 'active' : ''}`;
    item.dataset.threadId = thread.id;

    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'chat-item-title-wrapper';

    const title = document.createElement('span');
    title.className = 'chat-item-title';
    
    // Title: first user message (or summary of it)
    let displayTitle = 'New chat';
    if (thread.messages && Array.isArray(thread.messages) && thread.messages.length > 0) {
      const firstUserMsg = thread.messages.find(m => m.role === 'user');
      if (firstUserMsg && firstUserMsg.content) {
        displayTitle = summarizeFirstMessage(firstUserMsg.content);
      }
    } else if (thread.title) {
      // Fallback to thread.title if no messages yet
      displayTitle = thread.title.trim();
    }
    
    title.textContent = displayTitle;
    title.title = displayTitle;

    // Menu wrapper (3-dots menu)
    const menuWrap = document.createElement('div');
    menuWrap.className = 'chat-item-menu';

    const menuBtn = document.createElement('button');
    menuBtn.className = 'chat-item-menu-btn';
    menuBtn.textContent = '⋯';
    menuBtn.setAttribute('aria-label', 'Chat menu');
    menuBtn.setAttribute('aria-expanded', 'false');

    // Unified menu UI (Edit/Delete) - preserves existing handlers
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (!window.CullenMenu || !window.CullenMenu.open) {
        console.error('[Sidebar] CullenMenu module not loaded');
        return;
      }

      window.CullenMenu.open(menuBtn, {
        onEdit: async () => {
          // Existing rename flow (labelled as "Edit" in the new menu)
          await handleRenameChat(thread.id, displayTitle);
        },
        onDelete: async () => {
          if (confirm('Delete this chat?')) {
            await deleteThreadById(thread.id);
          }
        },
      });
    });

    menuWrap.appendChild(menuBtn);
    titleWrapper.appendChild(title);
    titleWrapper.appendChild(menuWrap);
    item.appendChild(titleWrapper);

    // Preview: most recent message (last in array)
    if (thread.messages && Array.isArray(thread.messages) && thread.messages.length > 0) {
      // Get the last message (most recent)
      const lastMsg = thread.messages[thread.messages.length - 1];
      if (lastMsg && lastMsg.content) {
        const preview = document.createElement('div');
        preview.className = 'chat-item-preview';
        const previewText = lastMsg.content.trim();
        const truncated = previewText.length > 50 ? previewText.substring(0, 50) + '...' : previewText;
        preview.textContent = truncated;
        item.appendChild(preview);
      }
    }

    // Click handler (exclude menu button and menu)
    item.addEventListener('click', (e) => {
      if (e.target !== menuBtn && !menuWrap.contains(e.target)) {
        // If on roster page, navigate to chat page (roster feature disabled)
        if (window.location.pathname === '/roster') {
          const params = new URLSearchParams();
          params.set('chat', thread.id.toString());
          window.location.href = '/?' + params.toString();
          return;
        }
        selectThread(thread.id);
      }
    });

    return item;
  }

  /**
   * Handle renaming a chat thread
   */
  async function handleRenameChat(threadId, currentTitle) {
    const newTitle = prompt('Rename chat:', currentTitle);
    if (newTitle === null || newTitle.trim() === currentTitle.trim()) {
      return; // User cancelled or title unchanged
    }

    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      showToast('Chat title cannot be empty', 'error');
      return;
    }

    try {
      // Use PUT endpoint to update chat title
      await apiRequest(`${API_BASE_LEGACY}/${threadId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: trimmedTitle,
        }),
      });

      // Update local thread data
      const thread = threads.find(t => t.id === threadId);
      if (thread) {
        thread.title = trimmedTitle;
        renderThreads();
        showToast('Chat renamed', 'success');
      }
    } catch (error) {
      console.error('[Sidebar] Error renaming chat:', error);
      showToast('Failed to rename chat', 'error');
    }
  }

  async function deleteThreadById(threadId) {
    try {
      // Use legacy endpoint: DELETE /api/v1/chat/{id}
      await apiRequest(`${API_BASE_LEGACY}/${threadId}`, {
        method: 'DELETE',
      });

      // Remove from local array
      threads = threads.filter(t => t.id !== threadId);
      
      if (activeThreadId === threadId) {
        clearActiveThread();
      } else {
        renderThreads();
      }
      
      window.dispatchEvent(new CustomEvent('thread:deleted', {
        detail: { threadId }
      }));
      
      showToast('Chat deleted', 'success');
    } catch (error) {
      console.error('[Sidebar] Error deleting thread:', error);
      showToast('Failed to delete chat', 'error');
    }
  }

  // =========================
  // Update thread title (called after first message)
  // =========================
  function updateThreadTitle(threadId, newTitle) {
    const thread = threads.find(t => t.id === threadId);
    if (thread) {
      thread.title = newTitle;
      renderThreads();
    }
  }

  // =========================
  // Search Functionality
  // =========================
  /**
   * Open search modal and handle search functionality
   */
  function openSearchModal() {
    // Create search modal if it doesn't exist
    let searchModal = document.getElementById('searchChatModal');
    if (!searchModal) {
      searchModal = document.createElement('div');
      searchModal.id = 'searchChatModal';
      searchModal.className = 'modal-overlay';
      searchModal.innerHTML = `
        <div class="modal-content search-modal-content">
          <div class="modal-header">
            <h2>Search Chats</h2>
            <button class="modal-close" id="searchModalClose" type="button">&times;</button>
          </div>
          <div class="search-input-wrapper">
            <input type="text" id="searchChatInput" class="search-input" placeholder="Search chats by title or message content..." autocomplete="off">
          </div>
          <div class="search-results" id="searchResults"></div>
        </div>
      `;
      document.body.appendChild(searchModal);

      // Setup close button
      const closeBtn = searchModal.querySelector('#searchModalClose');
      closeBtn.addEventListener('click', () => {
        closeSearchModal();
      });

      // Close on overlay click
      searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
          closeSearchModal();
        }
      });

      // Setup search input
      const searchInput = searchModal.querySelector('#searchChatInput');
      searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value.trim());
      });

      // Close on Escape key
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeSearchModal();
        }
      });

      // Focus input when modal opens
      setTimeout(() => searchInput.focus(), 100);
    }

    // Show modal
    searchModal.classList.add('is-open');
    performSearch(''); // Show all chats initially
  }

  function closeSearchModal() {
    const searchModal = document.getElementById('searchChatModal');
    if (searchModal) {
      searchModal.classList.remove('is-open');
    }
  }

  async function performSearch(query) {
    const resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;

    if (!query) {
      // Show all chats if no query
      renderSearchResults(threads);
      return;
    }

    const queryLower = query.toLowerCase();
    const filtered = [];

    // Search through loaded threads
    for (const thread of threads) {
      let matches = false;

      // Search in title
      if (thread.title && thread.title.toLowerCase().includes(queryLower)) {
        matches = true;
      }

      // Search in messages (if already loaded)
      if (!matches && thread.messages && Array.isArray(thread.messages)) {
        matches = thread.messages.some(msg => 
          msg.content && msg.content.toLowerCase().includes(queryLower)
        );
      }

      // If messages not loaded, fetch them for search
      if (!matches && (!thread.messages || thread.messages.length === 0)) {
        try {
          const messages = await loadMessages(thread.id);
          thread.messages = messages; // Cache messages
          matches = messages.some(msg => 
            msg.content && msg.content.toLowerCase().includes(queryLower)
          );
        } catch (error) {
          // Skip if can't load messages
        }
      }

      if (matches) {
        filtered.push(thread);
      }
    }

    renderSearchResults(filtered);
  }

  function renderSearchResults(filteredThreads) {
    const resultsEl = document.getElementById('searchResults');
    if (!resultsEl) return;

    if (filteredThreads.length === 0) {
      resultsEl.innerHTML = '<div class="search-empty">No chats found</div>';
      return;
    }

    resultsEl.innerHTML = '';
    filteredThreads.forEach(thread => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.dataset.threadId = thread.id;

      const title = document.createElement('div');
      title.className = 'search-result-title';
      title.textContent = thread.title || 'New Chat';

      const preview = document.createElement('div');
      preview.className = 'search-result-preview';
      if (thread.messages && thread.messages.length > 0) {
        const lastMsg = thread.messages[thread.messages.length - 1];
        preview.textContent = lastMsg.content || '';
      } else {
        preview.textContent = 'No messages yet';
      }

      item.appendChild(title);
      item.appendChild(preview);

      item.addEventListener('click', () => {
        selectThread(thread.id);
        closeSearchModal();
      });

      resultsEl.appendChild(item);
    });
  }

  // =========================
  // Public API
  // =========================
  window.SidebarThreads = {
    init,
    loadThreads,
    createThread,
    loadMessages,
    sendMessage,
    selectThread,
    clearActiveThread,
    deleteThread: deleteThreadById,
    updateThreadTitle,
    getActiveThreadId: () => activeThreadId,
    getThreads: () => [...threads],
    getThread: (id) => threads.find(t => t.id === id),
  };

  /**
   * Load and render roster section in sidebar
   */
  async function loadRosterSection() {
    const interestListEl = document.getElementById('interestList');
    if (!interestListEl) return;

    // Check if logged in
    const isLoggedIn = (window.AuthClient && window.AuthClient.isLoggedIn()) || (typeof Auth !== 'undefined' && Auth.isLoggedIn());
    
    if (!isLoggedIn) {
      // Clear roster section for logged out users
      interestListEl.innerHTML = '';
      return;
    }

    // Use RosterStore if available
    if (typeof window.RosterStore !== 'undefined' && window.RosterStore.renderSidebar) {
      window.RosterStore.renderSidebar();
      return;
    }

    // Fallback: fetch roster from API
    try {
      const token = (window.AuthClient ? window.AuthClient.getToken() : null) || (typeof Auth !== 'undefined' ? Auth.getAuthToken() : null);
      if (!token) {
        interestListEl.innerHTML = '';
        return;
      }

      const response = await fetch('/api/v1/roster/cards', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        interestListEl.innerHTML = '';
        return;
      }

      const cards = await response.json();
      if (!Array.isArray(cards)) {
        interestListEl.innerHTML = '';
        return;
      }

      // Render roster cards
      if (cards.length === 0) {
        interestListEl.innerHTML = '<div style="padding: 8px; color: rgba(255,255,255,0.5); font-size: 12px;">No roster cards</div>';
      } else {
        interestListEl.innerHTML = cards.map(card => {
          const name = String(card.name || '').trim();
          if (!name) return '';
          return `<div class="interest-item" data-id="${card.id}">${name}</div>`;
        }).join('');
      }
    } catch (error) {
      console.error('[Sidebar] Error loading roster:', error);
      interestListEl.innerHTML = '';
    }
  }

  /**
   * Handle auth ready event
   */
  function handleAuthReady() {
    loadRosterSection();
  }

  /**
   * Handle auth changed event
   */
  function handleAuthChanged(event) {
    const { loggedIn } = event.detail || {};
    if (!loggedIn) {
      // Clear roster section on logout
      const interestListEl = document.getElementById('interestList');
      if (interestListEl) {
        interestListEl.innerHTML = '';
      }
    } else {
      // Load roster section on login
      loadRosterSection();
    }
  }

  /**
   * Handle roster changed event
   */
  function handleRosterChanged() {
    loadRosterSection();
  }

  // Close chat menus on outside click / ESC
  // (Handled globally by CullenMenu)

  // Listen for auth and roster events
  window.addEventListener('auth:ready', handleAuthReady);
  window.addEventListener('auth:changed', handleAuthChanged);
  window.addEventListener('auth:login', () => loadRosterSection());
  window.addEventListener('auth:logout', () => {
    const interestListEl = document.getElementById('interestList');
    if (interestListEl) interestListEl.innerHTML = '';
  });
  window.addEventListener('roster:changed', handleRosterChanged);

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// Upgrade Required Modal Functionality
function showUpgradeRequiredModal() {
  const modal = document.getElementById('upgradeRequiredModal');
  if (!modal) return;
  
  modal.classList.add('is-open');
}

function closeUpgradeRequiredModal() {
  const modal = document.getElementById('upgradeRequiredModal');
  if (modal) {
    modal.classList.remove('is-open');
  }
}

// Initialize upgrade required modal handlers
(function initUpgradeRequiredModal() {
  const modal = document.getElementById('upgradeRequiredModal');
  const closeBtn = document.getElementById('upgradeRequiredModalClose');
  const returnBtn = document.getElementById('upgradeRequiredReturnBtn');
  const upgradeBtn = document.getElementById('upgradeRequiredUpgradeBtn');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeUpgradeRequiredModal();
    });
  }
  
  if (returnBtn) {
    returnBtn.addEventListener('click', () => {
      closeUpgradeRequiredModal();
    });
  }
  
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
      closeUpgradeRequiredModal();
      // Open upgrade modal
      if (typeof window.openUpgradeModal === 'function') {
        window.openUpgradeModal();
      } else {
        const upgradeBtn = document.getElementById('upgradeBtn');
        if (upgradeBtn) {
          upgradeBtn.click();
        }
      }
    });
  }
  
  // Close modal on overlay click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeUpgradeRequiredModal();
      }
    });
  }
  
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('upgradeRequiredModal');
      if (modal && modal.classList.contains('is-open')) {
        closeUpgradeRequiredModal();
      }
    }
  });
})();

// Plan Limit Modal Functionality (402 errors)
function showLimitModal(message) {
  const modal = document.getElementById('planLimitModal');
  const messageEl = document.getElementById('planLimitMessage');
  
  if (!modal) return;
  
  if (messageEl) {
    messageEl.textContent = message || 'Plan limit reached. Please upgrade to continue.';
  }
  
  modal.classList.add('is-open');
}

function closeLimitModal() {
  const modal = document.getElementById('planLimitModal');
  if (modal) {
    modal.classList.remove('is-open');
  }
}

// Initialize plan limit modal handlers
(function initPlanLimitModal() {
  const modal = document.getElementById('planLimitModal');
  const closeBtn = document.getElementById('planLimitModalClose');
  const returnBtn = document.getElementById('planLimitReturnBtn');
  const upgradeBtn = document.getElementById('planLimitUpgradeBtn');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeLimitModal();
    });
  }
  
  if (returnBtn) {
    returnBtn.addEventListener('click', () => {
      closeLimitModal();
    });
  }
  
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
      closeLimitModal();
      // Open upgrade modal using global function
      if (typeof window.CullenUpgradeModal !== 'undefined' && window.CullenUpgradeModal.open) {
        window.CullenUpgradeModal.open();
      } else if (typeof window.openUpgradeModal === 'function') {
        window.openUpgradeModal();
      } else {
        // Fallback: try to trigger upgrade button click
        const upgradeBtn = document.getElementById('upgradeBtn');
        if (upgradeBtn) {
          upgradeBtn.click();
        }
      }
    });
  }
  
  // Close modal on overlay click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeLimitModal();
      }
    });
  }
  
  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('planLimitModal');
      if (modal && modal.classList.contains('is-open')) {
        closeLimitModal();
      }
    }
  });
})();
