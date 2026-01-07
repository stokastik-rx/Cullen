(() => {
  'use strict';

  const els = {
    status: () => document.getElementById('adminStatus'),
    usersTbody: () => document.getElementById('usersTbody'),
    threadsTbody: () => document.getElementById('threadsTbody'),
    messagesBox: () => document.getElementById('messagesBox'),
    selectedUser: () => document.getElementById('selectedUser'),
    selectedThread: () => document.getElementById('selectedThread'),
    search: () => document.getElementById('userSearch'),
    refresh: () => document.getElementById('refreshUsers'),
  };

  let allUsers = [];
  let selectedUserId = null;
  let selectedThreadId = null;

  function setStatus(text) {
    const el = els.status();
    if (el) el.textContent = text;
  }

  function escapeText(s) {
    return String(s ?? '');
  }

  async function ensureAdmin() {
    if (!window.AuthClient || !window.AuthClient.isLoggedIn()) {
      setStatus('Not logged in. Please go back and log in.');
      throw new Error('Not logged in');
    }
    const me = await window.AuthClient.getMe();
    if (!me || !me.is_admin) {
      setStatus('Not an admin account.');
      throw new Error('Not admin');
    }
    setStatus(`Logged in as ${me.username} (admin)`);
  }

  async function apiGet(path) {
    if (!window.API || !window.API.request) {
      throw new Error('API client not loaded');
    }
    return await window.API.request(path, { method: 'GET' });
  }

  function renderUsers(users) {
    const tbody = els.usersTbody();
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const u of users) {
      const tr = document.createElement('tr');
      tr.style.borderTop = '1px solid rgba(255,255,255,0.06)';
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => selectUser(u.id));
      if (u.id === selectedUserId) {
        tr.style.background = 'rgba(255,255,255,0.06)';
      }
      tr.innerHTML = `
        <td style="padding:8px 6px;">${escapeText(u.id)}</td>
        <td style="padding:8px 6px;">${escapeText(u.username)}</td>
        <td style="padding:8px 6px;">${escapeText(u.email)}</td>
        <td style="padding:8px 6px;">${u.is_admin ? 'YES' : ''}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderThreads(threads) {
    const tbody = els.threadsTbody();
    if (!tbody) return;
    tbody.innerHTML = '';
    for (const t of threads) {
      const tr = document.createElement('tr');
      tr.style.borderTop = '1px solid rgba(255,255,255,0.06)';
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => selectThread(t.id));
      if (t.id === selectedThreadId) {
        tr.style.background = 'rgba(255,255,255,0.06)';
      }
      tr.innerHTML = `
        <td style="padding:8px 6px;">${escapeText(t.id)}</td>
        <td style="padding:8px 6px;">${escapeText(t.title || '(no title)')}</td>
        <td style="padding:8px 6px;">${escapeText(t.message_count)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderMessages(messages) {
    const box = els.messagesBox();
    if (!box) return;
    box.innerHTML = '';
    for (const m of messages) {
      const wrap = document.createElement('div');
      wrap.style.border = '1px solid rgba(255,255,255,0.08)';
      wrap.style.borderRadius = '12px';
      wrap.style.padding = '10px 12px';
      wrap.style.marginBottom = '10px';
      wrap.style.background = m.role === 'user' ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.06)';

      const meta = document.createElement('div');
      meta.style.fontSize = '12px';
      meta.style.color = 'rgba(255,255,255,0.70)';
      meta.style.marginBottom = '6px';
      meta.textContent = `${m.role} • ${m.created_at || ''} • id=${m.id}`;

      const content = document.createElement('div');
      content.style.whiteSpace = 'pre-wrap';
      content.textContent = m.content || '';

      wrap.appendChild(meta);
      wrap.appendChild(content);
      box.appendChild(wrap);
    }
  }

  async function loadUsers() {
    allUsers = await apiGet('/admin/users');
    filterAndRenderUsers();
  }

  function filterAndRenderUsers() {
    const q = (els.search()?.value || '').trim().toLowerCase();
    const filtered = q
      ? allUsers.filter((u) =>
          String(u.email || '').toLowerCase().includes(q) ||
          String(u.username || '').toLowerCase().includes(q) ||
          String(u.id || '').includes(q)
        )
      : allUsers;
    renderUsers(filtered);
  }

  async function selectUser(userId) {
    selectedUserId = userId;
    selectedThreadId = null;
    els.selectedUser().textContent = `user_id=${userId}`;
    els.selectedThread().textContent = '';
    renderThreads([]);
    renderMessages([]);

    // refresh selection highlight
    filterAndRenderUsers();

    const threads = await apiGet(`/admin/users/${userId}/threads`);
    renderThreads(threads);
  }

  async function selectThread(threadId) {
    selectedThreadId = threadId;
    els.selectedThread().textContent = `thread_id=${threadId}`;

    // refresh selection highlight
    const rows = els.threadsTbody()?.querySelectorAll('tr') || [];
    rows.forEach((tr) => (tr.style.background = ''));
    // best-effort highlight via re-render (cheap)
    const threads = await apiGet(`/admin/users/${selectedUserId}/threads`);
    renderThreads(threads);

    const detail = await apiGet(`/admin/threads/${threadId}`);
    renderMessages(detail.messages || []);
  }

  async function init() {
    try {
      await ensureAdmin();
      await loadUsers();
      els.search()?.addEventListener('input', filterAndRenderUsers);
      els.refresh()?.addEventListener('click', loadUsers);
    } catch (e) {
      console.error('[AdminPanel]', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


