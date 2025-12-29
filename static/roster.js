// /static/roster.js (FULL REPLACE)

(() => {
  const auth = window.CullenAuth;
  if (!auth) return;

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

  if (!container || !modal || !modalForm || !nameInput || !bgInput) return;

  let modalMode = "create"; // create | edit
  let activeId = null;
  let isSubmitting = false;

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

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

  function openModal({ mode, card }) {
    modalMode = mode;
    activeId = card?.id ?? null;

    nameInput.value = card?.name ?? "";
    bgInput.value = card?.bg ?? "";

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
    modal.classList.remove("is-visible");
    modal.setAttribute("aria-hidden", "true");
    const dialog = modal.querySelector(".modal-dialog");
    const done = () => {
      modal.classList.remove("is-open");
      modalMode = "create";
      activeId = null;
    };
    if (dialog) {
      dialog.addEventListener("transitionend", done, { once: true });
      setTimeout(done, 320);
    } else setTimeout(done, 260);
  }

  function closeAllCardMenus() {
    container.querySelectorAll(".card-menu.open").forEach(m => m.classList.remove("open"));
  }
  document.addEventListener("click", () => closeAllCardMenus());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllCardMenus(); });

  function buildCardMenu(card) {
    const wrap = document.createElement("div");
    wrap.className = "card-menu";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-menu-btn";
    btn.textContent = "⋯";

    const pop = document.createElement("div");
    pop.className = "card-menu-pop";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "card-menu-item";
    edit.textContent = "Edit";
    edit.addEventListener("click", (e) => {
      e.stopPropagation();
      wrap.classList.remove("open");
      openModal({ mode: "edit", card });
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "card-menu-item danger";
    del.textContent = "Delete";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      wrap.classList.remove("open");
      await auth.apiFetch(`/api/v1/roster/${card.id}`, { method: "DELETE" });
      await renderAll();
      auth.renderSidebarRoster();
      window.dispatchEvent(new CustomEvent("roster:changed"));
    });

    pop.appendChild(edit);
    pop.appendChild(del);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAllCardMenus();
      wrap.classList.toggle("open");
    });

    wrap.appendChild(btn);
    wrap.appendChild(pop);
    return wrap;
  }

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
      openModal({ mode: "create", card: null });
    });

    return card;
  }

  function makeFilledCard(cardData) {
    const card = document.createElement("div");
    card.className = "roster-card";
    card.dataset.state = "filled";
    card.dataset.cardId = String(cardData.id);

    const title = spacedUpper(cardData.name);
    const sub = cardData.bg ? `<div class="card-sub">${escapeHtml(cardData.bg)}</div>` : "";

    card.innerHTML = `
      <div class="card-content">
        <div class="card-title">${escapeHtml(title)}</div>
        ${sub}
      </div>
    `;

    card.appendChild(buildCardMenu(cardData));

    card.addEventListener("click", () => openModal({ mode: "edit", card: cardData }));
    return card;
  }

  async function renderAll() {
    container.innerHTML = "";

    const token = auth.getToken();
    if (!token) {
      container.appendChild(makeEmptyCard());
      return;
    }

    const cards = await auth.apiFetch("/api/v1/roster", { method: "GET" });
    cards.forEach(c => container.appendChild(makeFilledCard(c)));

    // always exactly ONE empty card
    container.appendChild(makeEmptyCard());

    // keep sidebar synced
    auth.renderSidebarRoster();
  }

  modalForm.addEventListener("submit", async (e) => {
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

    try {
      if (modalMode === "create") {
        await auth.apiFetch("/api/v1/roster", {
          method: "POST",
          body: JSON.stringify({ name, bg }),
        });
      } else if (modalMode === "edit" && activeId) {
        await auth.apiFetch(`/api/v1/roster/${activeId}`, {
          method: "PUT",
          body: JSON.stringify({ name, bg }),
        });
      }
      closeModal();
      await renderAll();
      window.dispatchEvent(new CustomEvent("roster:changed"));
    } finally {
      setTimeout(() => (isSubmitting = false), 80);
    }
  });

  deleteBtn?.addEventListener("click", async () => {
    if (!activeId) return;
    await auth.apiFetch(`/api/v1/roster/${activeId}`, { method: "DELETE" });
    closeModal();
    await renderAll();
    window.dispatchEvent(new CustomEvent("roster:changed"));
  });

  closeBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target?.dataset?.close === "true") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });

  function handleQuery(cards) {
    const sp = new URLSearchParams(window.location.search);
    const editId = sp.get("edit");
    const focusId = sp.get("focus");

    if (editId) {
      const c = cards.find(x => String(x.id) === String(editId));
      if (c) openModal({ mode: "edit", card: c });
    } else if (focusId) {
      setTimeout(() => {
        const el = container.querySelector(`[data-card-id="${CSS.escape(String(focusId))}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
    }
  }

  // init
  (async () => {
    modal.classList.remove("is-open", "is-visible");
    modal.setAttribute("aria-hidden", "true");

    const token = auth.getToken();
    if (!token) {
      container.innerHTML = "";
      container.appendChild(makeEmptyCard());
      return;
    }

    const cards = await auth.apiFetch("/api/v1/roster", { method: "GET" });
    container.innerHTML = "";
    cards.forEach(c => container.appendChild(makeFilledCard(c)));
    container.appendChild(makeEmptyCard());
    auth.renderSidebarRoster();
    handleQuery(cards);
  })();
})();
