// =========================
// CullenMenu - shared "⋯" dropdown menu (Edit/Delete)
// - Dark rounded menu matching reference design
// - Anchored to an "⋯" button (right-aligned)
// - Closes on outside click, Escape, or item click
// =========================
(() => {
  'use strict';

  /** @type {HTMLDivElement | null} */
  let openMenuEl = null;
  /** @type {HTMLElement | null} */
  let openAnchorEl = null;
  /** @type {Array<() => void>} */
  let cleanup = [];

  function _cleanupAll() {
    for (const fn of cleanup) {
      try { fn(); } catch {}
    }
    cleanup = [];
  }

  function close() {
    if (!openMenuEl) return;
    const el = openMenuEl;
    openMenuEl = null;
    openAnchorEl = null;
    _cleanupAll();

    el.classList.remove('is-open');
    // Allow CSS transition to finish
    setTimeout(() => {
      try { el.remove(); } catch {}
    }, 120);
  }

  function _clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function _position(menuEl, anchorEl) {
    const rect = anchorEl.getBoundingClientRect();

    // Temporarily show for measurement
    menuEl.style.visibility = 'hidden';
    menuEl.style.left = '0px';
    menuEl.style.top = '0px';

    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const menuW = menuEl.offsetWidth || 200;
    const menuH = menuEl.offsetHeight || 120;

    const gap = 8;

    // Check if this is a chat sidebar item (has chat-item-menu-btn class or is in chat-item)
    const isChatItem = anchorEl.closest('.chat-item') !== null || anchorEl.classList.contains('chat-item-menu-btn');

    let left = rect.right - menuW;
    let top;

    // For chat sidebar items, always position ABOVE
    if (isChatItem) {
      top = rect.top - menuH - gap;
      // If top overflow, fall back to below
      if (top < 8) {
        top = rect.bottom + gap;
      }
    } else {
      // Default: below, right-aligned to the anchor
      top = rect.bottom + gap;
      // If bottom overflow, try above
      if (top + menuH > vh - 8) {
        top = rect.top - menuH - gap;
      }
    }

    // Clamp into viewport
    left = _clamp(left, 8, Math.max(8, vw - menuW - 8));
    top = _clamp(top, 8, Math.max(8, vh - menuH - 8));

    menuEl.style.left = `${Math.round(left)}px`;
    menuEl.style.top = `${Math.round(top)}px`;
    menuEl.style.visibility = 'visible';
  }

  /**
   * Open the shared menu.
   * @param {HTMLElement} anchorEl
   * @param {{ onEdit?: () => (void|Promise<void>), onDelete?: () => (void|Promise<void>) }} opts
   */
  function open(anchorEl, opts = {}) {
    if (!anchorEl) return;

    // Toggle if clicking the same anchor
    if (openAnchorEl === anchorEl && openMenuEl) {
      close();
      return;
    }

    close();

    const menuEl = document.createElement('div');
    menuEl.className = 'cullen-menu';
    menuEl.setAttribute('role', 'menu');

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'cullen-menu-item';
    editBtn.dataset.action = 'edit';
    editBtn.textContent = 'Edit';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cullen-menu-item is-danger';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.textContent = 'Delete';

    menuEl.appendChild(editBtn);
    menuEl.appendChild(deleteBtn);
    document.body.appendChild(menuEl);

    openMenuEl = menuEl;
    openAnchorEl = anchorEl;

    _position(menuEl, anchorEl);
    requestAnimationFrame(() => menuEl.classList.add('is-open'));

    // Focus first action for keyboard users
    setTimeout(() => {
      try { editBtn.focus(); } catch {}
    }, 0);

    // Prevent clicks inside the menu from bubbling to underlying UI
    const stop = (e) => { e.stopPropagation(); };
    menuEl.addEventListener('click', stop);
    menuEl.addEventListener('mousedown', stop);
    cleanup.push(() => {
      menuEl.removeEventListener('click', stop);
      menuEl.removeEventListener('mousedown', stop);
    });

    // Outside click closes
    const onDocMouseDown = (e) => {
      const t = e.target;
      if (openMenuEl && t instanceof Node) {
        if (openMenuEl.contains(t) || anchorEl.contains(t)) return;
      }
      close();
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    cleanup.push(() => document.removeEventListener('mousedown', onDocMouseDown, true));

    // Escape closes
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown, true);
    cleanup.push(() => document.removeEventListener('keydown', onKeyDown, true));

    // Reposition on scroll/resize (close if anchor disappears)
    const onReflow = () => {
      if (!openMenuEl || !openAnchorEl) return;
      _position(openMenuEl, openAnchorEl);
    };
    window.addEventListener('resize', onReflow, true);
    window.addEventListener('scroll', onReflow, true);
    cleanup.push(() => window.removeEventListener('resize', onReflow, true));
    cleanup.push(() => window.removeEventListener('scroll', onReflow, true));

    const invoke = async (fn) => {
      try {
        await fn?.();
      } finally {
        close();
      }
    };

    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void invoke(opts.onEdit);
    });
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      void invoke(opts.onDelete);
    });
  }

  window.CullenMenu = {
    open,
    close,
    isOpen: () => !!openMenuEl,
  };
})();


