// =========================
// /static/roster_shared.js
// Shared roster storage + sidebar rendering (all pages)
// =========================

(() => {
  const STORAGE_KEY = "cullen_roster_cards_v1";

  function safeParse(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  function loadCards() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.id === "string")
      .map((x) => ({
        id: String(x.id),
        name: String(x.name || "").trim(),
        bg: String(x.bg || "").trim(),
      }))
      .filter((x) => x.name.length > 0);
  }

  function saveCards(cards) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }

  function deleteCard(id) {
    const cards = loadCards().filter((c) => c.id !== id);
    saveCards(cards);
    renderSidebar(); // refresh sidebar everywhere
    // notify roster page (if open)
    window.dispatchEvent(new CustomEvent("roster:changed"));
  }

  function renderSidebar() {
    const list = document.getElementById("interestList");
    if (!list) return;

    const cards = loadCards();
    list.innerHTML = "";

    for (const c of cards) {
      const row = document.createElement("div");
      row.className = "interest-item";
      row.dataset.cardId = c.id;

      const label = document.createElement("button");
      label.type = "button";
      label.className = "interest-item-label";
      label.textContent = c.name;

      // If we're on roster page, scroll to it. Otherwise, go to roster and open edit.
      label.addEventListener("click", () => {
        const onRosterPage = !!document.getElementById("rosterCards");
        if (onRosterPage) {
          const el = document.querySelector(`[data-card-id="${CSS.escape(c.id)}"]`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          window.location.href = `/roster?focus=${encodeURIComponent(c.id)}`;
        }
      });

      const menuWrap = document.createElement("div");
      menuWrap.className = "mini-menu";

      const menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.className = "mini-menu-btn";
      menuBtn.textContent = "⋯";
      menuBtn.setAttribute("aria-label", "Roster item menu");

      const menu = document.createElement("div");
      menu.className = "mini-menu-pop";
      menu.innerHTML = `
        <button type="button" class="mini-menu-item" data-action="edit">Edit</button>
        <button type="button" class="mini-menu-item danger" data-action="delete">Delete</button>
      `;

      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        closeAllMiniMenus();
        menuWrap.classList.toggle("open");
      });

      menu.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === "edit") {
          // If roster page exists, let roster.js open modal directly via event.
          const onRosterPage = !!document.getElementById("rosterCards");
          if (onRosterPage) {
            window.dispatchEvent(new CustomEvent("roster:edit", { detail: { id: c.id } }));
          } else {
            window.location.href = `/roster?edit=${encodeURIComponent(c.id)}`;
          }
        }

        if (action === "delete") {
          deleteCard(c.id);
        }

        menuWrap.classList.remove("open");
      });

      menuWrap.appendChild(menuBtn);
      menuWrap.appendChild(menu);

      row.appendChild(label);
      row.appendChild(menuWrap);
      list.appendChild(row);
    }
  }

  function closeAllMiniMenus() {
    document.querySelectorAll(".mini-menu.open").forEach((el) => el.classList.remove("open"));
  }

  // Close menus on outside click / ESC
  document.addEventListener("click", () => closeAllMiniMenus());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllMiniMenus();
  });

  // Re-render if another tab changes localStorage
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) renderSidebar();
  });

  // Public API
  window.RosterStore = {
    STORAGE_KEY,
    loadCards,
    saveCards,
    deleteCard,
    renderSidebar,
  };

  // initial
  renderSidebar();
})();
