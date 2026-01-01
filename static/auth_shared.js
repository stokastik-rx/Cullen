/**
 * Shared authentication logic for all pages
 */

const Auth = (() => {
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
        // Clear roster cards when logging out
        if (typeof window.RosterStore !== 'undefined' && window.RosterStore.STORAGE_KEY) {
            localStorage.removeItem(window.RosterStore.STORAGE_KEY);
            localStorage.removeItem('cullen_roster_cards_meta_v1');
            // Re-render sidebar to reflect cleared cards
            if (window.RosterStore.renderSidebar) {
                window.RosterStore.renderSidebar();
            }
        } else {
            // Fallback: clear roster storage even if RosterStore isn't loaded yet
            localStorage.removeItem('cullen_roster_cards_v1');
            localStorage.removeItem('cullen_roster_cards_meta_v1');
        }
    }

    function isLoggedIn() {
        return getAuthToken() !== null;
    }

    async function getUserProfile() {
        if (!getAuthToken()) throw new Error('Not authenticated');
        
        // Use centralized API client if available, otherwise fallback
        if (typeof window.API !== 'undefined' && window.API.request) {
            return await window.API.request('/auth/me', { method: 'GET' });
        }
        
        // Fallback to direct fetch
        const token = getAuthToken();
        const response = await fetch('/api/v1/auth/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to get user profile');
        return await response.json();
    }

    async function signup(email, username, password) {
        // Use centralized API client if available
        if (typeof window.API !== 'undefined' && window.API.public) {
            return await window.API.public('/auth/signup', {
                method: 'POST',
                body: JSON.stringify({ email, username, password }),
            });
        }
        
        // Fallback to direct fetch
        const response = await fetch('/api/v1/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Signup failed');
        }
        return await response.json();
    }

    async function login(usernameOrEmail, password) {
        const formData = new URLSearchParams();
        formData.append('username', usernameOrEmail);
        formData.append('password', password);

        // Use centralized API client if available
        if (typeof window.API !== 'undefined' && window.API.public) {
            return await window.API.public('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });
        }
        
        // Fallback to direct fetch
        const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Login failed');
        }
        return await response.json();
    }

    function extractErrorMessage(errorData) {
        if (typeof errorData === 'string') return errorData;
        if (errorData.detail) return errorData.detail;
        if (errorData.message) return errorData.message;
        return 'An error occurred';
    }

    // Modal management (assumes modals exist in DOM)
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('is-open');
            const firstInput = modal.querySelector('input');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('is-open');
            const errorDiv = modal.querySelector('.error-message');
            if (errorDiv) {
                errorDiv.textContent = '';
                errorDiv.classList.remove('visible');
            }
            const form = modal.querySelector('form');
            if (form) form.reset();
        }
    }

    function updateAuthButtons() {
        const signupBtn = document.getElementById('signupBtn');
        const loginBtn = document.getElementById('loginBtn');
        const loggedIn = isLoggedIn();

        if (signupBtn) {
            if (loggedIn) signupBtn.classList.add('hidden');
            else signupBtn.classList.remove('hidden');
        }
        if (loginBtn) {
            loginBtn.textContent = loggedIn ? 'Log Out' : 'Log In';
        }
    }

    function updateUserCard(username, tier) {
        const userNameEl = document.getElementById('userName');
        const userTierEl = document.getElementById('userTier');
        if (userNameEl) userNameEl.textContent = username || 'Guest';
        if (userTierEl) {
            userTierEl.textContent = tier || 'BASE';
            userTierEl.className = `user-tier tier-${(tier || 'BASE').toLowerCase()}`;
        }
    }

    return {
        getAuthToken,
        setAuthToken,
        clearAuthToken,
        isLoggedIn,
        getUserProfile,
        signup,
        login,
        extractErrorMessage,
        openModal,
        closeModal,
        updateAuthButtons,
        updateUserCard
    };
})();

// Initialize Auth listeners if they exist in DOM
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const loginModalClose = document.getElementById('loginModalClose');
    const signupModalClose = document.getElementById('signupModalClose');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const isLoggedIn = window.AuthClient ? window.AuthClient.isLoggedIn() : Auth.isLoggedIn();
            
            if (isLoggedIn) {
                // Use AuthClient if available
                if (window.AuthClient) {
                    window.AuthClient.logout();
                    // AuthClient.clearToken() already emits 'auth:changed' event
                } else {
                    Auth.clearAuthToken();
                    Auth.updateAuthButtons();
                    Auth.updateUserCard('Guest', 'BASE');
                    // Emit legacy event
                    window.dispatchEvent(new CustomEvent('auth:changed', {
                        detail: { loggedIn: false }
                    }));
                }
                
                // Dispatch auth:logout event for roster sync
                window.dispatchEvent(new CustomEvent('auth:logout'));
                
                // Clear sidebar threads
                if (window.SidebarThreads && window.SidebarThreads.clearActiveThread) {
                    window.SidebarThreads.clearActiveThread();
                }
                if (window.SidebarThreads && window.SidebarThreads.loadThreads) {
                    await window.SidebarThreads.loadThreads();
                }
                
                // Dispatch event to clear roster cards
                window.dispatchEvent(new CustomEvent('roster:changed'));
            } else {
                Auth.openModal('loginModal');
            }
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', () => Auth.openModal('signupModal'));
    }

    if (loginModalClose) loginModalClose.addEventListener('click', () => Auth.closeModal('loginModal'));
    if (signupModalClose) signupModalClose.addEventListener('click', () => Auth.closeModal('signupModal'));

    // Form submissions
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = loginForm.querySelector('[name="username"]').value;
            const password = loginForm.querySelector('[name="password"]').value;
            const errorDiv = document.getElementById('loginError');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            if (errorDiv) errorDiv.classList.remove('visible');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Logging in...';
            }

            try {
                // Use AuthClient if available, otherwise fallback to Auth
                if (window.AuthClient) {
                    await window.AuthClient.login(username, password);
                } else {
                    const data = await Auth.login(username, password);
                    Auth.setAuthToken(data.access_token, data.token_type);
                    Auth.updateAuthButtons();
                    try {
                        const profile = await Auth.getUserProfile();
                        Auth.updateUserCard(profile.username, profile.subscription_tier);
                    } catch (profileError) {
                        Auth.updateUserCard('Guest', 'BASE');
                    }
                    // Emit auth:changed for backward compatibility
                    window.dispatchEvent(new CustomEvent('auth:changed', {
                        detail: { loggedIn: true }
                    }));
                }
                
                // Dispatch auth:login event for roster sync
                window.dispatchEvent(new CustomEvent('auth:login'));
                
                // Refresh sidebar threads
                if (window.SidebarThreads && window.SidebarThreads.loadThreads) {
                    await window.SidebarThreads.loadThreads();
                }
                
                // Dispatch roster:changed to ensure roster syncs
                window.dispatchEvent(new CustomEvent('roster:changed'));
                
                // Close modal
                Auth.closeModal('loginModal');
            } catch (err) {
                if (errorDiv) {
                    errorDiv.textContent = err.message;
                    errorDiv.classList.add('visible');
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Log In';
                }
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = signupForm.querySelector('[name="email"]').value;
            const username = signupForm.querySelector('[name="username"]').value;
            const password = signupForm.querySelector('[name="password"]').value;
            const errorDiv = document.getElementById('signupError');
            const submitBtn = signupForm.querySelector('button[type="submit"]');

            if (errorDiv) errorDiv.classList.remove('visible');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing up...';
            }

            try {
                // Use AuthClient if available, otherwise fallback to Auth
                if (window.AuthClient) {
                    await window.AuthClient.signup(email, username, password);
                    await window.AuthClient.login(username, password);
                } else {
                    await Auth.signup(email, username, password);
                    const data = await Auth.login(username, password);
                    Auth.setAuthToken(data.access_token, data.token_type);
                    Auth.updateAuthButtons();
                    try {
                        const profile = await Auth.getUserProfile();
                        Auth.updateUserCard(profile.username, profile.subscription_tier);
                    } catch (profileError) {
                        Auth.updateUserCard('Guest', 'BASE');
                    }
                    // Emit auth:changed for backward compatibility
                    window.dispatchEvent(new CustomEvent('auth:changed', {
                        detail: { loggedIn: true }
                    }));
                }
                
                // Dispatch auth:login event for roster sync
                window.dispatchEvent(new CustomEvent('auth:login'));
                
                // Refresh sidebar threads
                if (window.SidebarThreads && window.SidebarThreads.loadThreads) {
                    await window.SidebarThreads.loadThreads();
                }
                
                // Dispatch roster:changed to ensure roster syncs
                window.dispatchEvent(new CustomEvent('roster:changed'));
                
                // Close modal
                Auth.closeModal('signupModal');
            } catch (err) {
                if (errorDiv) {
                    errorDiv.textContent = err.message;
                    errorDiv.classList.add('visible');
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign Up';
                }
            }
        });
    }

    // Update initial UI state
    Auth.updateAuthButtons();
    if (Auth.isLoggedIn()) {
        Auth.getUserProfile()
            .then(profile => Auth.updateUserCard(profile.username, profile.subscription_tier))
            .catch(() => Auth.updateUserCard('Guest', 'BASE'));
    }
});
