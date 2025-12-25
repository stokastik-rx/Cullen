// Chat Management
let currentChatId = null;
let chats = [];
let isLoggedIn = false;

// Token Management
function getAuthToken() {
    return localStorage.getItem('access_token');
}

function setAuthToken(token, tokenType = 'bearer') {
    localStorage.setItem('access_token', token);
    localStorage.setItem('token_type', tokenType);
}

function clearAuthToken() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
}

// Auth State Management
async function checkAuthState() {
    const token = getAuthToken();
    isLoggedIn = token !== null;
    updateAuthButtons();
    
    if (isLoggedIn) {
        // Load user profile and update user card
        try {
            const profile = await getUserProfile();
            updateUserCard(profile.username, profile.subscription_tier);
            // Load user-specific chats
            await loadChats();
        } catch (error) {
            console.error('Error loading user profile:', error);
            updateUserCard('Guest', 'BASE');
        }
    } else {
        updateUserCard('Guest', 'BASE');
        chats = [];
        currentChatId = null;
        renderChatList();
        clearMessages();
    }
}

// User Card Management
function updateUserCard(username, tier) {
    const userNameEl = document.getElementById('userName');
    const userTierEl = document.getElementById('userTier');
    
    if (userNameEl) userNameEl.textContent = username;
    if (userTierEl) {
        userTierEl.textContent = tier;
        // Add tier-specific class for styling
        userTierEl.className = `user-tier tier-${tier.toLowerCase()}`;
    }
}

// Get user profile from API
async function getUserProfile() {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Not authenticated');
    }
    
    const response = await fetch('/api/v1/auth/me', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
    
    if (!response.ok) {
        throw new Error('Failed to get user profile');
    }
    
    return await response.json();
}

function updateAuthButtons() {
    const signupBtn = document.getElementById('signupBtn');
    const loginBtn = document.getElementById('loginBtn');
    
    if (isLoggedIn) {
        signupBtn.classList.add('hidden');
        loginBtn.textContent = 'Log Out';
    } else {
        signupBtn.classList.remove('hidden');
        loginBtn.textContent = 'Log In';
    }
}

// Modal Management
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        // Focus first input in modal
        const firstInput = modal.querySelector('input');
        if (firstInput) {
            firstInput.focus();
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        // Clear form errors
        const errorDiv = modal.querySelector('.error-message');
        if (errorDiv) {
            errorDiv.textContent = '';
            errorDiv.classList.remove('visible');
        }
        // Reset form
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }
}

// Helper function to extract error message from response
function extractErrorMessage(errorData) {
    if (typeof errorData === 'string') {
        return errorData;
    }
    if (errorData.detail) {
        return errorData.detail;
    }
    if (errorData.message) {
        return errorData.message;
    }
    if (errorData.details && Array.isArray(errorData.details)) {
        // Handle validation errors
        return errorData.details.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
    }
    return 'An error occurred';
}

// Auth API Calls
async function signup(email, username, password) {
    const response = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password }),
    });

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            throw new Error(`Signup failed: ${response.status} ${response.statusText}`);
        }
        throw new Error(extractErrorMessage(errorData));
    }

    return await response.json();
}

async function login(usernameOrEmail, password) {
    const formData = new URLSearchParams();
    formData.append('username', usernameOrEmail);
    formData.append('password', password);

    const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
    });

    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            throw new Error(`Login failed: ${response.status} ${response.statusText}`);
        }
        throw new Error(extractErrorMessage(errorData));
    }

    return await response.json();
}

// Auth Handlers
async function handleLogin() {
    if (isLoggedIn) {
        // Logout
        clearAuthToken();
        isLoggedIn = false;
        await checkAuthState();
    } else {
        // Open login modal
        openModal('loginModal');
    }
}

function handleSignup() {
    openModal('signupModal');
}

function handleUpgrade() {
    // Placeholder - replace with actual upgrade logic
    alert('Upgrade functionality coming soon!');
}

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const newChatBtn = document.getElementById('newChatBtn');
const chatList = document.getElementById('chatList');

// Initialize
(async () => {
    await checkAuthState();
})();

// Auth button event listeners
document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.getElementById('signupBtn').addEventListener('click', handleSignup);
document.getElementById('upgradeBtn').addEventListener('click', handleUpgrade);

// Modal event listeners
document.getElementById('signupModalClose').addEventListener('click', () => closeModal('signupModal'));
document.getElementById('loginModalClose').addEventListener('click', () => closeModal('loginModal'));

// Close modals when clicking overlay
document.getElementById('signupModal').addEventListener('click', (e) => {
    if (e.target.id === 'signupModal') {
        closeModal('signupModal');
    }
});
document.getElementById('loginModal').addEventListener('click', (e) => {
    if (e.target.id === 'loginModal') {
        closeModal('loginModal');
    }
});

// Form submissions
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('signupEmail').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const errorDiv = document.getElementById('signupError');
    const submitBtn = e.target.querySelector('.modal-submit-btn');

    // Clear previous error
    errorDiv.textContent = '';
    errorDiv.classList.remove('visible');

    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing up...';

    try {
        await signup(email, username, password);
        closeModal('signupModal');
        // Auto-login after signup
        try {
            const tokenData = await login(username, password);
            setAuthToken(tokenData.access_token, tokenData.token_type);
            isLoggedIn = true;
            await checkAuthState();
        } catch (loginError) {
            // Signup succeeded but auto-login failed - show success message
            alert('Account created successfully! Please log in.');
        }
    } catch (error) {
        console.error('Signup error:', error);
        const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
        errorDiv.textContent = errorMessage;
        errorDiv.classList.add('visible');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameOrEmail = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const submitBtn = e.target.querySelector('.modal-submit-btn');

    // Clear previous error
    errorDiv.textContent = '';
    errorDiv.classList.remove('visible');

    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
        const tokenData = await login(usernameOrEmail, password);
        setAuthToken(tokenData.access_token, tokenData.token_type);
        isLoggedIn = true;
        closeModal('loginModal');
        await checkAuthState();
    } catch (error) {
        console.error('Login error:', error);
        const errorMessage = error.message || 'An unexpected error occurred. Please try again.';
        errorDiv.textContent = errorMessage;
        errorDiv.classList.add('visible');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In';
    }
});

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
});

// New chat button
newChatBtn.addEventListener('click', () => {
    createNewChat();
});

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message to chat (optimistically)
    addMessage('user', message, false);
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Disable input while processing
    messageInput.disabled = true;
    sendButton.disabled = false;
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    try {
        if (isLoggedIn) {
            // Logged in: use authenticated endpoint
            const token = getAuthToken();
            
            // Create new chat if none exists
            if (!currentChatId) {
                await createNewChat();
                if (!currentChatId) {
                    removeTypingIndicator(typingId);
                    messageInput.disabled = false;
                    sendButton.disabled = false;
                    return;
                }
            }
            
            // Send message to API (this already updates the chat on the server)
            const response = await fetch('/api/v1/chat/message', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: message,
                    chat_id: currentChatId,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to send message');
            }
            
            const data = await response.json();
            
            // Remove typing indicator
            removeTypingIndicator(typingId);
            
            // Add assistant response (don't reload - just add the new message)
            addMessage('assistant', data.response || 'I received your message, but I\'m not configured to respond yet.', false);
            
            // Update local chat object with new messages (for sidebar display)
            const chat = chats.find(c => c.id === currentChatId);
            if (chat) {
                // Get current messages from DOM to update local chat object
                const messageElements = chatMessages.querySelectorAll('.message');
                chat.messages = [];
                messageElements.forEach(msgEl => {
                    const role = msgEl.classList.contains('user') ? 'user' : 'assistant';
                    const content = msgEl.querySelector('.message-content').textContent.trim();
                    if (content) {
                        chat.messages.push({ role, content });
                    }
                });
                renderChatList();
            }
        } else {
            // Guest: use unauthenticated endpoint (messages won't be saved)
            const response = await fetch('/api/v1/chat/message/guest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: message,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to send message');
            }
            
            const data = await response.json();
            
            // Remove typing indicator
            removeTypingIndicator(typingId);
            
            // Add assistant response
            addMessage('assistant', data.response || 'I received your message, but I\'m not configured to respond yet.', false);
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
    if (!isLoggedIn) {
        alert('Please log in to create a chat');
        return;
    }
    
    const token = getAuthToken();
    try {
        const response = await fetch('/api/v1/chat', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            throw new Error('Failed to create chat');
        }
        
        const newChat = await response.json();
        chats.unshift(newChat);
        currentChatId = newChat.id;
        renderChatList();
        clearMessages();
    } catch (error) {
        console.error('Error creating chat:', error);
        alert('Failed to create chat. Please try again.');
    }
}

async function loadChat(chatId) {
    if (!isLoggedIn) return;
    
    const token = getAuthToken();
    try {
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
        
        // Update local chats array
        const index = chats.findIndex(c => c.id === chat.id);
        if (index !== -1) {
            chats[index] = chat;
        } else {
            chats.unshift(chat);
        }
        
        // Display messages
        chat.messages.forEach(msg => {
            addMessage(msg.role, msg.content, false);
        });
        
        renderChatList();
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
    if (!isLoggedIn) return;
    
    const token = getAuthToken();
    try {
        const response = await fetch(`/api/v1/chat/${chatId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete chat');
        }
        
        chats = chats.filter(c => c.id !== chatId);
        
        if (currentChatId === chatId) {
            if (chats.length > 0) {
                await loadChat(chats[0].id);
            } else {
                currentChatId = null;
                clearMessages();
            }
        }
        
        renderChatList();
    } catch (error) {
        console.error('Error deleting chat:', error);
        alert('Failed to delete chat. Please try again.');
    }
}

function renderChatList() {
    chatList.innerHTML = '';
    
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        chatItem.addEventListener('click', () => loadChat(chat.id));
        
        const title = document.createElement('span');
        title.className = 'chat-item-title';
        title.textContent = chat.title;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'chat-item-delete';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
        });
        
        chatItem.appendChild(title);
        chatItem.appendChild(deleteBtn);
        chatList.appendChild(chatItem);
    });
}

async function loadChats() {
    if (!isLoggedIn) {
        chats = [];
        renderChatList();
        return;
    }
    
    const token = getAuthToken();
    try {
        const response = await fetch('/api/v1/chat', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        
        if (!response.ok) {
            throw new Error('Failed to load chats');
        }
        
        chats = await response.json();
        renderChatList();
        
        // Load the first chat if available
        if (chats.length > 0 && !currentChatId) {
            await loadChat(chats[0].id);
        }
    } catch (error) {
        console.error('Error loading chats:', error);
        chats = [];
        renderChatList();
    }
}

// Message Functions
function addMessage(role, content, save = true) {
    // Remove welcome message if it exists
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
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
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (save) {
        saveCurrentChat();
    }
}

function clearMessages() {
    chatMessages.innerHTML = '';
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

