// Chat Management
let currentChatId = null;
let chats = [];
let isLoggedIn = false;

// Auth State Management
function checkAuthState() {
    const savedAuth = localStorage.getItem('isLoggedIn');
    isLoggedIn = savedAuth === 'true';
    updateAuthButtons();
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

function handleLogin() {
    if (isLoggedIn) {
        // Logout
        isLoggedIn = false;
        localStorage.setItem('isLoggedIn', 'false');
    } else {
        // Login (placeholder - replace with actual auth)
        isLoggedIn = true;
        localStorage.setItem('isLoggedIn', 'true');
    }
    updateAuthButtons();
}

function handleSignup() {
    // Placeholder - replace with actual signup logic
    alert('Sign up functionality coming soon!');
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
checkAuthState();
loadChats();
if (chats.length > 0) {
    loadChat(chats[0].id);
} else {
    // Create a new chat but don't show welcome message
    const chatId = 'chat-' + Date.now();
    const newChat = {
        id: chatId,
        title: 'New chat',
        messages: [],
        createdAt: new Date().toISOString()
    };
    
    chats.unshift(newChat);
    currentChatId = chatId;
    saveChats();
    renderChatList();
    clearMessages();
}

// Auth button event listeners
document.getElementById('loginBtn').addEventListener('click', handleLogin);
document.getElementById('signupBtn').addEventListener('click', handleSignup);
document.getElementById('upgradeBtn').addEventListener('click', handleUpgrade);

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
    
    // Create new chat if none exists
    if (!currentChatId) {
        createNewChat();
    }
    
    // Add user message to chat
    addMessage('user', message);
    saveCurrentChat();
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Disable input while processing
    messageInput.disabled = true;
    sendButton.disabled = true;
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    try {
        // Send message to API
        const response = await fetch('/api/v1/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message }),
        });
        
        const data = await response.json();
        
        // Remove typing indicator
        removeTypingIndicator(typingId);
        
        // Add assistant response
        addMessage('assistant', data.response || 'I received your message, but I\'m not configured to respond yet.');
        saveCurrentChat();
        
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator(typingId);
        addMessage('assistant', 'Sorry, there was an error processing your message. Please try again.');
        saveCurrentChat();
    } finally {
        // Re-enable input
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }
});

// Chat Management Functions
function createNewChat() {
    const chatId = 'chat-' + Date.now();
    const newChat = {
        id: chatId,
        title: 'New chat',
        messages: [],
        createdAt: new Date().toISOString()
    };
    
    chats.unshift(newChat);
    currentChatId = chatId;
    saveChats();
    renderChatList();
    clearMessages();
}

function loadChat(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
    currentChatId = chatId;
    clearMessages();
    
    chat.messages.forEach(msg => {
        addMessage(msg.role, msg.content, false);
    });
    
    renderChatList();
}

function saveCurrentChat() {
    if (!currentChatId) return;
    
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    
    // Get all messages from DOM
    const messageElements = chatMessages.querySelectorAll('.message');
    chat.messages = [];
    
    messageElements.forEach(msgEl => {
        const role = msgEl.classList.contains('user') ? 'user' : 'assistant';
        const content = msgEl.querySelector('.message-content').textContent.trim();
        if (content) {
            chat.messages.push({ role, content });
        }
    });
    
    // Update title from first user message
    const firstUserMessage = chat.messages.find(m => m.role === 'user');
    if (firstUserMessage) {
        chat.title = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
    }
    
    saveChats();
    renderChatList();
}

function deleteChat(chatId) {
    chats = chats.filter(c => c.id !== chatId);
    saveChats();
    
    if (currentChatId === chatId) {
        if (chats.length > 0) {
            loadChat(chats[0].id);
        } else {
            createNewChat();
        }
    } else {
        renderChatList();
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

function saveChats() {
    localStorage.setItem('chats', JSON.stringify(chats));
    localStorage.setItem('currentChatId', currentChatId);
}

function loadChats() {
    const saved = localStorage.getItem('chats');
    if (saved) {
        chats = JSON.parse(saved);
    }
    
    const savedCurrentId = localStorage.getItem('currentChatId');
    if (savedCurrentId && chats.find(c => c.id === savedCurrentId)) {
        currentChatId = savedCurrentId;
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
