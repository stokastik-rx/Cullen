// Chat Management (using SidebarThreads module)
let currentChatId = null;

// Auth State Management
// Note: SharedState.init() handles auth buttons and user card initialization
// This function is kept for backward compatibility and chat-specific logic
async function checkAuthState() {
    const isLoggedIn = Auth.isLoggedIn();
    
    if (isLoggedIn) {
        // Load user profile and update user card
        // Also validates token is still valid
        try {
            const profile = await Auth.getUserProfile();
            Auth.updateUserCard(profile.username, profile.subscription_tier);
            // SidebarThreads will load threads automatically
        } catch (error) {
            console.error('Error loading user profile:', error);
            // If token is invalid, clear it and show guest state
            if (error.message && (error.message.includes('Unauthorized') || error.message.includes('401'))) {
                Auth.clearAuthToken();
                Auth.updateAuthButtons();
            }
            Auth.updateUserCard('Guest', 'BASE');
            currentChatId = null;
            clearMessages();
        }
    } else {
        Auth.updateUserCard('Guest', 'BASE');
        currentChatId = null;
        clearMessages();
    }
    
    // Refresh shared state to ensure consistency
    if (window.SharedState && window.SharedState.refresh) {
        await window.SharedState.refresh();
    }
}

// Helper function to extract error message from response
function extractErrorMessage(errorData) {
    return Auth.extractErrorMessage(errorData);
}

// Upgrade Modal Functionality
let currentPlan = 'base'; // Default to base

async function fetchCurrentPlan() {
    try {
        const token = Auth.getAuthToken();
        if (!token) {
            return null; // No token = not authenticated
        }
        
        const response = await fetch('/api/v1/billing/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (response.status === 401) {
            return null; // Not authenticated (invalid token)
        }
        
        if (!response.ok) {
            // If endpoint doesn't exist (404) or other errors, default to 'base' plan
            // This allows the modal to work even if billing endpoint isn't implemented yet
            if (response.status === 404) {
                console.warn('[Upgrade] Billing endpoint not found, defaulting to base plan');
                return 'base';
            }
            // For other errors, still default to base but log the error
            console.error('[Upgrade] Error fetching plan:', response.status, response.statusText);
            return 'base';
        }
        
        const data = await response.json();
        return data.plan || 'base';
    } catch (error) {
        // Network errors or other exceptions - check if user is logged in
        // If logged in, default to base plan; if not, return null
        console.error('[Upgrade] Error fetching plan:', error);
        const isLoggedIn = Auth.isLoggedIn();
        return isLoggedIn ? 'base' : null;
    }
}

function updatePlanUI(plan) {
    currentPlan = plan || 'base';
    
    // Remove active class from all cards
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // Update buttons
    const baseButton = document.getElementById('planButtonBase');
    const premiumButton = document.getElementById('planButtonPremium');
    
    if (currentPlan === 'base') {
        document.getElementById('planCardBase')?.classList.add('active');
        if (baseButton) {
            baseButton.textContent = 'Current Plan';
            baseButton.disabled = true;
        }
        if (premiumButton) {
            premiumButton.textContent = 'Upgrade';
            premiumButton.disabled = false;
        }
    } else if (currentPlan === 'premium') {
        document.getElementById('planCardPremium')?.classList.add('active');
        if (baseButton) {
            baseButton.textContent = 'Downgrade';
            baseButton.disabled = true; // Disabled for now
        }
        if (premiumButton) {
            premiumButton.textContent = 'Current Plan';
            premiumButton.disabled = true;
        }
    }
}

// Expose upgrade modal globally
window.CullenUpgradeModal = {
  open: async function() {
    const modal = document.getElementById('upgradeModal');
    const errorMessage = document.getElementById('upgradeErrorMessage');
    
    if (!modal) return;
    
    // Hide error message
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
    
    // Check if user is logged in first
    const isLoggedIn = Auth.isLoggedIn();
    
    if (!isLoggedIn) {
      // User not authenticated - show error message
      if (errorMessage) {
        errorMessage.textContent = 'Please log in to upgrade';
        errorMessage.style.display = 'block';
      }
      // Still show modal but disable upgrade button
      updatePlanUI('base');
      const premiumButton = document.getElementById('planButtonPremium');
      if (premiumButton) {
        premiumButton.disabled = true;
      }
    } else {
      // User is logged in - fetch and update plan
      const plan = await fetchCurrentPlan();
      // If fetchCurrentPlan returns null (shouldn't happen if logged in), default to 'base'
      updatePlanUI(plan || 'base');
    }
    
    // Open modal
    modal.classList.add('is-open');
  }
};

// Expose openUpgradeModal globally so sidebar.js can call it (backward compatibility)
window.openUpgradeModal = async function openUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    const errorMessage = document.getElementById('upgradeErrorMessage');
    
    if (!modal) return;
    
    // Hide error message
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
    
    // Check if user is logged in first
    const isLoggedIn = Auth.isLoggedIn();
    
    if (!isLoggedIn) {
        // User not authenticated - show error message
        if (errorMessage) {
            errorMessage.textContent = 'Please log in to upgrade';
            errorMessage.style.display = 'block';
        }
        // Still show modal but disable upgrade button
        updatePlanUI('base');
        const premiumButton = document.getElementById('planButtonPremium');
        if (premiumButton) {
            premiumButton.disabled = true;
        }
    } else {
        // User is logged in - fetch and update plan
        const plan = await fetchCurrentPlan();
        // If fetchCurrentPlan returns null (shouldn't happen if logged in), default to 'base'
        updatePlanUI(plan || 'base');
    }
    
    // Open modal
    modal.classList.add('is-open');
}

function closeUpgradeModal() {
    const modal = document.getElementById('upgradeModal');
    if (modal) {
        modal.classList.remove('is-open');
    }
}

async function handleUpgrade() {
    const premiumButton = document.getElementById('planButtonPremium');
    if (premiumButton && premiumButton.disabled) {
        return; // Button is disabled
    }
    
    // Check if user is logged in
    if (!Auth.isLoggedIn()) {
        const errorMessage = document.getElementById('upgradeErrorMessage');
        if (errorMessage) {
            errorMessage.textContent = 'Please log in to upgrade';
            errorMessage.style.display = 'block';
        }
        return;
    }
    
    // Disable button during request
    if (premiumButton) {
        premiumButton.disabled = true;
        premiumButton.textContent = 'Processing...';
    }
    
    try {
        const token = Auth.getAuthToken();
        const response = await fetch('/api/v1/billing/create-checkout-session', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (response.status === 401) {
            const errorMessage = document.getElementById('upgradeErrorMessage');
            if (errorMessage) {
                errorMessage.textContent = 'Please log in to upgrade';
                errorMessage.style.display = 'block';
            }
            if (premiumButton) {
                premiumButton.disabled = false;
                premiumButton.textContent = 'Upgrade';
            }
            return;
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.message || 'Failed to create checkout session');
}
        
        const data = await response.json();
        
        if (data.url) {
            // Redirect to Stripe checkout
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL received');
        }
    } catch (error) {
        console.error('[Upgrade] Error:', error);
        const errorMessage = document.getElementById('upgradeErrorMessage');
        if (errorMessage) {
            errorMessage.textContent = error.message || 'Failed to start checkout. Please try again.';
            errorMessage.style.display = 'block';
        }
        if (premiumButton) {
            premiumButton.disabled = false;
            premiumButton.textContent = 'Upgrade';
        }
    }
}

// Initialize upgrade modal handlers
(function initUpgradeModal() {
    const upgradeBtn = document.getElementById('upgradeBtn');
    const upgradeModalClose = document.getElementById('upgradeModalClose');
    const planButtonPremium = document.getElementById('planButtonPremium');
    
    if (upgradeBtn) {
        upgradeBtn.addEventListener('click', () => {
            openUpgradeModal();
        });
    }
    
    if (upgradeModalClose) {
        upgradeModalClose.addEventListener('click', () => {
            closeUpgradeModal();
        });
    }
    
    // Close modal on overlay click
    const upgradeModal = document.getElementById('upgradeModal');
    if (upgradeModal) {
        upgradeModal.addEventListener('click', (e) => {
            if (e.target === upgradeModal) {
                closeUpgradeModal();
            }
        });
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('upgradeModal');
            if (modal && modal.classList.contains('is-open')) {
                closeUpgradeModal();
            }
        }
    });
    
    if (planButtonPremium) {
        planButtonPremium.addEventListener('click', () => {
            handleUpgrade();
        });
    }
})();

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
// newChatBtn and chatList are now handled by SidebarThreads module

// Initialize
(async () => {
    await checkAuthState();
    // Welcome message is already shown by clearMessages() in checkAuthState()
    // No need to call it again here
})();

// Auth button event listeners
// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
});

// New chat button - handled by SidebarThreads
// Listen for thread selection events
window.addEventListener('thread:selected', async (e) => {
    const { threadId } = e.detail;
    if (threadId) {
        currentChatId = threadId;
        await loadChat(threadId);
    } else {
        currentChatId = null;
        clearMessages();
    }
});

window.addEventListener('thread:cleared', () => {
    currentChatId = null;
    clearMessages();
});

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    const hasImages = uploadedImages.length > 0;
    
    // Allow submission if there's a message OR images
    if (!message && !hasImages) return;
    
    // Add user message to chat (optimistically)
    // If only images, show placeholder text or empty
    const displayMessage = message || '';
    addMessage('user', displayMessage, false);
    
    // If there are images, display them in the message
    if (hasImages) {
        const lastUserMessage = chatMessages.querySelector('.message.user:last-child');
        if (lastUserMessage) {
            const messageContent = lastUserMessage.querySelector('.message-content');
            if (messageContent) {
                // Clear any existing paragraphs if no text message
                if (!message) {
                    messageContent.innerHTML = '';
                }
                
                // Add images
                uploadedImages.forEach((file) => {
                    const imageUrl = URL.createObjectURL(file);
                    const img = document.createElement('img');
                    img.src = imageUrl;
                    img.className = 'message-image';
                    img.style.maxWidth = '100%';
                    img.style.maxHeight = '400px';
                    img.style.borderRadius = '8px';
                    img.style.marginTop = message ? '8px' : '0';
                    img.style.display = 'block';
                    img.style.objectFit = 'contain';
                    messageContent.appendChild(img);
                });
            }
        }
    }
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Disable input while processing
    messageInput.disabled = true;
    sendButton.disabled = true;
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    try {
        const isLoggedIn = Auth.isLoggedIn();
        
        if (isLoggedIn) {
            // Use SidebarThreads module
            if (!window.SidebarThreads) {
                throw new Error('SidebarThreads module not loaded');
            }

            // Prepare message content - include images if any
            // For now, send placeholder text if only images
            // TODO: Upload images to backend and include URLs/IDs in message
            let messageContent = message;
            if (uploadedImages.length > 0 && !message) {
                // If only images, send placeholder text
                messageContent = uploadedImages.length === 1 
                    ? '[Image]' 
                    : `[${uploadedImages.length} images]`;
            } else if (uploadedImages.length > 0 && message) {
                // If message + images, append note
                const imageNote = uploadedImages.length === 1 
                    ? ' [Image attached]' 
                    : ` [${uploadedImages.length} images attached]`;
                messageContent = message + imageNote;
            }
            
            // Send message - backend will create thread atomically if currentChatId is null
            // This prevents race conditions between create and send
            const data = await window.SidebarThreads.sendMessage(currentChatId, messageContent || '[Image]');
            
            // Update currentChatId if a new thread was created
            if (!currentChatId && data.thread_id) {
                currentChatId = data.thread_id;
                window.SidebarThreads.selectThread(currentChatId);
            } else if (!currentChatId) {
                // Fallback: reload threads to get the newly created thread
                await window.SidebarThreads.loadThreads();
                const threads = window.SidebarThreads.getThreads();
                if (threads.length > 0) {
                    currentChatId = threads[0].id;
                    window.SidebarThreads.selectThread(currentChatId);
            }
            } else {
                // Ensure active thread stays selected after sidebar reload
                window.SidebarThreads.selectThread(currentChatId, false);
            }
            
            // Remove typing indicator
            removeTypingIndicator(typingId);
            
            // Clear uploaded images after successful send
            clearImagePreviews();
            
            // Add assistant response
            addMessage('assistant', data.response || 'message received', false);
            
            // Reload current chat to get updated messages
            if (currentChatId) {
                await loadChat(currentChatId);
            }
        } else {
            // Guest: use unauthenticated endpoint (messages won't be saved)
            // Prepare message content for guest endpoint
            let guestMessage = message;
            if (uploadedImages.length > 0 && !message) {
                guestMessage = uploadedImages.length === 1 
                    ? '[Image]' 
                    : `[${uploadedImages.length} images]`;
            } else if (uploadedImages.length > 0 && message) {
                const imageNote = uploadedImages.length === 1 
                    ? ' [Image attached]' 
                    : ` [${uploadedImages.length} images attached]`;
                guestMessage = message + imageNote;
            }
            
            const response = await fetch('/api/v1/chat/message/guest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: guestMessage || '[Image]',
                }),
            });
            
            if (!response.ok) {
                // Improved error logging: parse and log full error details
                let errorMsg = `Failed to send message: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.detail || errorData.message || errorMsg;
                    console.error('[Chat] Guest message error:', {
                        status: response.status,
                        statusText: response.statusText,
                        body: errorData,
                    });
                } catch {
                    try {
                        const text = await response.text();
                        console.error('[Chat] Guest message error (non-JSON):', {
                            status: response.status,
                            statusText: response.statusText,
                            body: text,
                        });
                    } catch {
                        console.error('[Chat] Guest message error:', {
                            status: response.status,
                            statusText: response.statusText,
                        });
                    }
                }
                throw new Error(errorMsg);
            }
            
            const data = await response.json();
            
            // Remove typing indicator
            removeTypingIndicator(typingId);
            
            // Clear uploaded images after successful send
            clearImagePreviews();
            
            // Add assistant response
            addMessage('assistant', data.response || 'message received', false);
        }
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator(typingId);
        addMessage('assistant', 'Sorry, there was an error processing your message. Please try again.', false);
    } finally {
        // Re-enable input
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
});

// Chat Management Functions - API-based
async function createNewChat() {
    const isLoggedIn = Auth.isLoggedIn();
    
    if (!isLoggedIn) {
        alert('Please log in to create a chat');
        return;
    }
    
    if (!window.SidebarThreads) {
        alert('Sidebar module not loaded');
        return;
        }
        
    try {
        const newThread = await window.SidebarThreads.createThread();
        currentChatId = newThread.id;
        window.SidebarThreads.selectThread(currentChatId);
        await loadChat(currentChatId);
    } catch (error) {
        console.error('Error creating chat:', error);
        alert('Failed to create chat. Please try again.');
    }
}

async function loadChat(chatId) {
    const isLoggedIn = Auth.isLoggedIn();
    if (!isLoggedIn) return;
    
    try {
        if (window.SidebarThreads) {
            const messages = await window.SidebarThreads.loadMessages(chatId);
            currentChatId = chatId;
            clearMessages();
            
            if (messages && messages.length > 0) {
                // Display messages
                messages.forEach(msg => {
                    addMessage(msg.role, msg.content, false);
                });
            } else {
                // No messages - show welcome message
                showWelcomeMessage();
            }
        } else {
            // Fallback to direct API call
            const token = Auth.getAuthToken();
        const response = await fetch(`/api/v1/chat/${chatId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        if (!response.ok) {
            throw new Error('Failed to load chat');
        }
        
        const chat = await response.json();
        currentChatId = chat.id;
        clearMessages();
        
        // Display messages
            if (chat.messages && chat.messages.length > 0) {
        chat.messages.forEach(msg => {
            addMessage(msg.role, msg.content, false);
        });
            } else {
                // No messages - show welcome message
                showWelcomeMessage();
            }
        }
    } catch (error) {
        console.error('Error loading chat:', error);
        alert('Failed to load chat. Please try again.');
    }
}

async function saveCurrentChat() {
    if (!currentChatId || !isLoggedIn) return;
    
    const token = getAuthToken();
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    
    // Get all messages from DOM
    const messageElements = chatMessages.querySelectorAll('.message');
    const messages = [];
    
    messageElements.forEach(msgEl => {
        const role = msgEl.classList.contains('user') ? 'user' : 'assistant';
        const content = msgEl.querySelector('.message-content').textContent.trim();
        if (content) {
            messages.push({ role, content });
        }
    });
    
    // Update title from first user message
    const firstUserMessage = messages.find(m => m.role === 'user');
    let title = chat.title;
    if (firstUserMessage && chat.title === 'New chat') {
        title = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
    }
    
    try {
        const response = await fetch(`/api/v1/chat/${currentChatId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: title,
                messages: messages,
            }),
        });
        
        if (!response.ok) {
            throw new Error('Failed to save chat');
        }
        
        const updatedChat = await response.json();
        // Update local chats array
        const index = chats.findIndex(c => c.id === updatedChat.id);
        if (index !== -1) {
            chats[index] = updatedChat;
        }
        
        renderChatList();
    } catch (error) {
        console.error('Error saving chat:', error);
    }
}

async function deleteChat(chatId) {
    // Handled by SidebarThreads module
    if (window.SidebarThreads) {
        await window.SidebarThreads.deleteThread(chatId);
            }
        }
        
// renderChatList and loadChats are now handled by SidebarThreads module
// Keeping these as no-ops for compatibility
function renderChatList() {
    // Handled by SidebarThreads
}

async function loadChats() {
    // Handled by SidebarThreads
    if (window.SidebarThreads) {
        await window.SidebarThreads.loadThreads();
    }
}

// Message Functions
function addMessage(role, content, save = true) {
    // Remove welcome message if it exists
    hideWelcomeMessage();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role} message-enter`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Format message content (preserve line breaks)
    const formattedContent = content.split('\n').map(line => {
        const p = document.createElement('p');
        p.textContent = line || ' '; // Preserve empty lines
        return p;
    });
    
    formattedContent.forEach(p => messageContent.appendChild(p));
    
    messageDiv.appendChild(messageContent);
    
    chatMessages.appendChild(messageDiv);
    
    // Trigger animation
    requestAnimationFrame(() => {
        messageDiv.classList.add('message-enter-active');
    });
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (save) {
        saveCurrentChat();
    }
}

function clearMessages() {
    chatMessages.innerHTML = '';
    showWelcomeMessage();
}

function showWelcomeMessage() {
    // Only show if no messages exist AND no welcome message already exists
    if (chatMessages.querySelector('.message')) {
        return;
    }
    
    // Check if welcome message already exists
    if (chatMessages.querySelector('.welcome-message')) {
        return;
    }
    
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    
    const prompt = document.createElement('h2');
    prompt.className = 'welcome-prompt';
    prompt.textContent = "What's on your mind today?";
    
    welcomeDiv.appendChild(prompt);
    chatMessages.appendChild(welcomeDiv);
}

function hideWelcomeMessage() {
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
}

// Image preview functionality
let uploadedImages = [];

function displayImagePreviews(files) {
    const previewContainer = document.getElementById('imagePreviewContainer');
    if (!previewContainer) return;
    
    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    
    // Add to uploaded images array
    uploadedImages.push(...imageFiles);
    
    // Clear and rebuild preview
    previewContainer.innerHTML = '';
    
    uploadedImages.forEach((file, index) => {
        const previewCard = document.createElement('div');
        previewCard.className = 'image-preview-card';
        previewCard.dataset.index = index;
        
        const previewImage = document.createElement('img');
        previewImage.className = 'image-preview-img';
        previewImage.src = URL.createObjectURL(file);
        previewImage.alt = file.name;
        
        const previewOverlay = document.createElement('div');
        previewOverlay.className = 'image-preview-overlay';
        
        const editButton = document.createElement('button');
        editButton.className = 'image-preview-btn image-preview-edit';
        editButton.type = 'button';
        editButton.setAttribute('aria-label', 'Edit');
        editButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11.333 2.667C11.5084 2.49164 11.7163 2.35259 11.9441 2.25819C12.1719 2.16379 12.4151 2.11597 12.6667 2.11597C12.9182 2.11597 13.1614 2.16379 13.3892 2.25819C13.617 2.35259 13.8249 2.49164 14 2.667C13.8249 2.84236 13.617 2.98141 13.3892 3.07581C13.1614 3.17021 12.9182 3.21803 12.6667 3.21803C12.4151 3.21803 12.1719 3.17021 11.9441 3.07581C11.7163 2.98141 11.5084 2.84236 11.333 2.667ZM10 3.333L2.66667 10.6667V13.3333H5.33333L12.6667 6L10 3.333Z" fill="currentColor"/>
          </svg>
        `;
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'image-preview-btn image-preview-delete';
        deleteButton.type = 'button';
        deleteButton.setAttribute('aria-label', 'Delete');
        deleteButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4.66667L11.0667 3.73333L8 6.8L4.93333 3.73333L4 4.66667L7.06667 7.73333L4 10.8L4.93333 11.7333L8 8.66667L11.0667 11.7333L12 10.8L8.93333 7.73333L12 4.66667Z" fill="currentColor"/>
          </svg>
        `;
        
        // Edit button handler (placeholder)
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            // TODO: Implement edit functionality
            console.log('Edit image:', file.name);
        });
        
        // Delete button handler
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            removeImagePreview(index);
        });
        
        previewOverlay.appendChild(editButton);
        previewOverlay.appendChild(deleteButton);
        
        previewCard.appendChild(previewImage);
        previewCard.appendChild(previewOverlay);
        
        previewContainer.appendChild(previewCard);
    });
    
    // Show preview container
    previewContainer.style.display = 'flex';
}

function removeImagePreview(index) {
    uploadedImages.splice(index, 1);
    
    const previewContainer = document.getElementById('imagePreviewContainer');
    if (!previewContainer) return;
    
    // If no images left, hide container
    if (uploadedImages.length === 0) {
        previewContainer.style.display = 'none';
        previewContainer.innerHTML = '';
        return;
    }
    
    // Rebuild preview with updated indices
    previewContainer.innerHTML = '';
    uploadedImages.forEach((file, newIndex) => {
        const previewCard = document.createElement('div');
        previewCard.className = 'image-preview-card';
        previewCard.dataset.index = newIndex;
        
        const previewImage = document.createElement('img');
        previewImage.className = 'image-preview-img';
        previewImage.src = URL.createObjectURL(file);
        previewImage.alt = file.name;
        
        const previewOverlay = document.createElement('div');
        previewOverlay.className = 'image-preview-overlay';
        
        const editButton = document.createElement('button');
        editButton.className = 'image-preview-btn image-preview-edit';
        editButton.type = 'button';
        editButton.setAttribute('aria-label', 'Edit');
        editButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11.333 2.667C11.5084 2.49164 11.7163 2.35259 11.9441 2.25819C12.1719 2.16379 12.4151 2.11597 12.6667 2.11597C12.9182 2.11597 13.1614 2.16379 13.3892 2.25819C13.617 2.35259 13.8249 2.49164 14 2.667C13.8249 2.84236 13.617 2.98141 13.3892 3.07581C13.1614 3.17021 12.9182 3.21803 12.6667 3.21803C12.4151 3.21803 12.1719 3.17021 11.9441 3.07581C11.7163 2.98141 11.5084 2.84236 11.333 2.667ZM10 3.333L2.66667 10.6667V13.3333H5.33333L12.6667 6L10 3.333Z" fill="currentColor"/>
          </svg>
        `;
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'image-preview-btn image-preview-delete';
        deleteButton.type = 'button';
        deleteButton.setAttribute('aria-label', 'Delete');
        deleteButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4.66667L11.0667 3.73333L8 6.8L4.93333 3.73333L4 4.66667L7.06667 7.73333L4 10.8L4.93333 11.7333L8 8.66667L11.0667 11.7333L12 10.8L8.93333 7.73333L12 4.66667Z" fill="currentColor"/>
          </svg>
        `;
        
        editButton.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Edit image:', file.name);
        });
        
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            removeImagePreview(newIndex);
        });
        
        previewOverlay.appendChild(editButton);
        previewOverlay.appendChild(deleteButton);
        
        previewCard.appendChild(previewImage);
        previewCard.appendChild(previewOverlay);
        
        previewContainer.appendChild(previewCard);
    });
}

function clearImagePreviews() {
    uploadedImages = [];
    const previewContainer = document.getElementById('imagePreviewContainer');
    if (previewContainer) {
        previewContainer.style.display = 'none';
        previewContainer.innerHTML = '';
    }
}

// Show typing indicator
function showTypingIndicator() {
    const typingId = 'typing-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.id = typingId;
    messageDiv.className = 'message assistant';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    
    messageContent.appendChild(typingIndicator);
    messageDiv.appendChild(messageContent);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return typingId;
}

// Remove typing indicator
function removeTypingIndicator(typingId) {
    const indicator = document.getElementById(typingId);
    if (indicator) {
        indicator.remove();
    }
}

// Allow Shift+Enter for new line, Enter to send
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Focus input on load
window.addEventListener('load', () => {
    messageInput.focus();
});

// Plus button menu functionality
const inputPlusButton = document.getElementById('inputPlusButton');
const inputPlusMenu = document.getElementById('inputPlusMenu');
const addFilesButton = document.getElementById('addFilesButton');

if (inputPlusButton && inputPlusMenu) {
    // Toggle menu on plus button click
    inputPlusButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = inputPlusMenu.classList.contains('is-open');
        
        // Close all other menus first
        document.querySelectorAll('.input-plus-menu.is-open').forEach(menu => {
            if (menu !== inputPlusMenu) {
                menu.classList.remove('is-open');
            }
        });
        
        // Toggle this menu
        inputPlusMenu.classList.toggle('is-open', !isOpen);
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!inputPlusButton.contains(e.target) && !inputPlusMenu.contains(e.target)) {
            inputPlusMenu.classList.remove('is-open');
        }
    });
    
    // Close menu on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && inputPlusMenu.classList.contains('is-open')) {
            inputPlusMenu.classList.remove('is-open');
        }
    });
    
    // Handle add files button click
    if (addFilesButton) {
        addFilesButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Create file input
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.multiple = true;
            fileInput.style.display = 'none';
            
            fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                    // Display image previews
                    displayImagePreviews(files);
                    // Close menu
                    inputPlusMenu.classList.remove('is-open');
                }
                document.body.removeChild(fileInput);
            });
            
            document.body.appendChild(fileInput);
            fileInput.click();
        });
    }
}
document.addEventListener("DOMContentLoaded", () => {
  const addInterestBtn = document.getElementById("addInterestBtn");
  const interestModal = document.getElementById("interestModal");
  const interestModalClose = document.getElementById("interestModalClose");
  const interestForm = document.getElementById("interestForm");
  const interestName = document.getElementById("interestName");
  const interestContext = document.getElementById("interestContext");
  const interestError = document.getElementById("interestError");
  const interestList = document.getElementById("interestList");

  if (!addInterestBtn || !interestModal) {
    console.warn("Add Interest elements not found. Check IDs in index.html.");
    return;
  }

  function openInterestModal() {
    if (interestError) interestError.textContent = "";
    if (interestName) interestName.value = "";
    if (interestContext) interestContext.value = "";
    interestModal.style.display = "flex";
    setTimeout(() => interestName?.focus(), 0);
  }

  function closeInterestModal() {
    interestModal.style.display = "none";
  }

  addInterestBtn.addEventListener("click", openInterestModal);
  interestModalClose?.addEventListener("click", closeInterestModal);

  interestModal.addEventListener("click", (e) => {
    if (e.target === interestModal) closeInterestModal();
  });

  interestForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = (interestName?.value || "").trim();
    const ctx = (interestContext?.value || "").trim();

    if (!name) {
      if (interestError) interestError.textContent = "Name of Interest is required.";
      return;
    }

    const item = document.createElement("div");
    item.className = "interest-item";
    item.textContent = name;
    item.title = ctx;

    interestList?.appendChild(item);
    closeInterestModal();
  });
});

