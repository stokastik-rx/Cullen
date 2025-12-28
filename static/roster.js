// =========================
// /static/roster.js
// Roster page: cards + modal + menus + persistence (FIXED)
// =========================

(() => {
  const store = window.RosterStore;
  const STORAGE_KEY = store?.STORAGE_KEY || "cullen_roster_cards_v1";

  const container = document.getElementById("rosterCards");
  const modal = document.getElementById("rosterModal");
  const modalForm = document.getElementById("rosterModalForm");
  const nameInput = document.getElementById("interestNameInput");
  const bgInput = document.getElementById("interestBgInput");
  const closeBtn = document.getElementById("rosterModalClose");
  const cancelBtn = document.getElementById("rosterModalCancel");
  const deleteBtn = document.getElementById("rosterModalDelete");
  const saveBtn = document.getElementById("rosterModalSave");
  const titleEl = document.getElementById("rosterModalTitle");

  if (!container || !modal || !modalForm || !nameInput || !bgInput) {
    console.error("[Roster] Missing required DOM elements.");
    return;
  }

  // ---------- state ----------
  let activeCardId = null;
  let modalMode = "create"; // create | edit
  let isSubmitting = false;

  // ---------- utils ----------
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const uuid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function spacedUpper(str) {
    return str.trim().toUpperCase().split("").join(" ");
  }

  function loadCards() {
    if (store?.loadCards) return store.loadCards();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((x) => x && typeof x.id === "string")
        .map((x) => ({
          id: x.id,
          name: String(x.name || "").trim(),
          bg: String(x.bg || "").trim(),
        }))
        .filter((x) => x.name.length > 0);
    } catch {
      return [];
    }
  }

  function saveCards(cards) {
    if (store?.saveCards) store.saveCards(cards);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));

    // Sync sidebar across pages
    store?.renderSidebar?.();
    window.dispatchEvent(new CustomEvent("roster:changed"));
  }

  function getCardById(id) {
    return loadCards().find((c) => c.id === id) || null;
  }

  // ---------- modal ----------
  function openModal({ mode, id, name = "", bg = "" }) {
    modalMode = mode;
    activeCardId = id || null;

    nameInput.value = name;
    bgInput.value = bg;

    if (titleEl) titleEl.textContent = mode === "edit" ? "Edit Card" : "Create Card";
    if (saveBtn) saveBtn.textContent = mode === "edit" ? "Save" : "Create";
    if (deleteBtn) deleteBtn.style.display = mode === "edit" ? "inline-flex" : "none";

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.classList.add("is-visible");
        setTimeout(() => nameInput.focus(), 120);
      });
    });
  }

  function closeModal() {
    if (!modal.classList.contains("is-open")) return;

    modal.classList.remove("is-visible");
    modal.setAttribute("aria-hidden", "true");

    const dialog = modal.querySelector(".modal-dialog");
    const done = () => {
      modal.classList.remove("is-open");
      activeCardId = null;
      modalMode = "create";
    };

    if (dialog) {
      dialog.addEventListener("transitionend", done, { once: true });
      setTimeout(done, 320);
    } else {
      setTimeout(done, 260);
    }
  }

  // ---------- card menus ----------
  function closeAllCardMenus() {
    container.querySelectorAll(".card-menu.open").forEach((m) => m.classList.remove("open"));
  }

  document.addEventListener("click", () => closeAllCardMenus());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllCardMenus();
  });

  function buildCardMenu(cardId) {
    const wrap = document.createElement("div");
    wrap.className = "card-menu";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-menu-btn";
    btn.textContent = "⋯";
    btn.setAttribute("aria-label", "Card menu");

    const pop = document.createElement("div");
    pop.className = "card-menu-pop";
    pop.innerHTML = `
      <button type="button" class="card-menu-item" data-action="edit">Edit</button>
      <button type="button" class="card-menu-item danger" data-action="delete">Delete</button>
    `;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      closeAllCardMenus();
      wrap.classList.toggle("open");
    });

    pop.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = e.target.closest("[data-action]");
      if (!item) return;

      const action = item.dataset.action;

      if (action === "edit") {
        const c = getCardById(cardId);
        if (c) openModal({ mode: "edit", id: c.id, name: c.name, bg: c.bg });
      }

      if (action === "delete") {
        const cards = loadCards().filter((c) => c.id !== cardId);
        saveCards(cards);
        renderAll();
      }

      wrap.classList.remove("open");
    });

    wrap.appendChild(btn);
    wrap.appendChild(pop);
    return wrap;
  }

  // ---------- cards ----------
  function makeEmptyCard() {
    const card = document.createElement("div");
    card.className = "roster-card";
    card.dataset.state = "empty";

    const plus = document.createElement("div");
    plus.className = "plus";
    plus.textContent = "+";
    card.appendChild(plus);

    card.addEventListener("click", async () => {
      card.style.transform = "scale(1.03)";
      await wait(80);
      card.style.transform = "";
      openModal({ mode: "create", id: null });
    });

    return card;
  }

  function makeFilledCard({ id, name, bg }) {
    const card = document.createElement("div");
    card.className = "roster-card";
    card.dataset.state = "filled";
    card.dataset.cardId = id;

    const title = spacedUpper(name);
    const sub = bg ? `<div class="card-sub">${escapeHtml(bg)}</div>` : "";

    card.innerHTML = `
      <div class="card-content">
        <div class="card-title">${escapeHtml(title)}</div>
        ${sub}
      </div>
    `;

    // menu
    card.appendChild(buildCardMenu(id));

    // click to edit
    card.addEventListener("click", () => {
      const c = getCardById(id);
      if (c) openModal({ mode: "edit", id: c.id, name: c.name, bg: c.bg });
    });

    return card;
  }

  function renderAll() {
    const cards = loadCards();
    container.innerHTML = "";

    cards.forEach((c) => container.appendChild(makeFilledCard(c)));

    // Exactly ONE empty card always
    container.appendChild(makeEmptyCard());

    // sidebar sync
    store?.renderSidebar?.();
  }

  // ---------- submit ----------
  modalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    const name = nameInput.value.trim();
    const bg = bgInput.value.trim();

    if (!name) {
      nameInput.focus();
      isSubmitting = false;
      return;
    }

    const cards = loadCards();

    if (modalMode === "create") {
      cards.push({ id: uuid(), name, bg });
      saveCards(cards);
      renderAll();
      closeModal();
    } else if (modalMode === "edit" && activeCardId) {
      const idx = cards.findIndex((c) => c.id === activeCardId);
      if (idx !== -1) {
        cards[idx] = { ...cards[idx], name, bg };
        saveCards(cards);
        renderAll();
      }
      closeModal();
    }

    setTimeout(() => (isSubmitting = false), 60);
  });

  // delete (modal)
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      if (!activeCardId) return;
      const cards = loadCards().filter((c) => c.id !== activeCardId);
      saveCards(cards);
      renderAll();
      closeModal();
    });
  }

  // close controls
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target?.dataset?.close === "true") closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  // allow sidebar "edit" to open modal (roster page only)
  window.addEventListener("roster:edit", (e) => {
    const id = e.detail?.id;
    const c = id ? getCardById(id) : null;
    if (c) openModal({ mode: "edit", id: c.id, name: c.name, bg: c.bg });
  });

  // query support
  function handleQuery() {
    const sp = new URLSearchParams(window.location.search);
    const editId = sp.get("edit");
    const focusId = sp.get("focus");

    if (editId) {
      const c = getCardById(editId);
      if (c) openModal({ mode: "edit", id: c.id, name: c.name, bg: c.bg });
    } else if (focusId) {
      setTimeout(() => {
        const el = container.querySelector(`[data-card-id="${CSS.escape(focusId)}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    }
  }

  // init
  modal.classList.remove("is-open", "is-visible");
  modal.setAttribute("aria-hidden", "true");
  renderAll();
  handleQuery();
})();
