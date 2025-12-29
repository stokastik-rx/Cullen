// /static/roster_shared.js (FULL REPLACE)

(() => {
  const API = {
    signup: "/api/v1/auth/signup",
    login: "/api/v1/auth/login",
    roster: "/api/v1/roster",
  };

  const TOKEN_KEY = "cullen_jwt_v1";
  const USER_KEY = "cullen_user_v1";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }
  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
    catch { return null; }
  }
  function setUser(u) {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  }

  async function apiFetch(url, opts = {}) {
    const headers = Object.assign({}, opts.headers || {});
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (!headers["Content-Type"] && opts.body) headers["Content-Type"] = "application/json";

    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) {
      let msg = "Request failed";
      try {
        const data = await res.json();
        msg = data?.detail || msg;
      } catch {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // ---------- UI helpers ----------
  function qs(id) { return document.getElementById(id); }

  function setTierBadge(tier) {
    const el = qs("userTier");
    if (!el) return;
    el.textContent = (tier || "BASE").toUpperCase();
    el.classList.remove("tier-base", "tier-pro", "tier-premium");
    // for now keep BASE styling
    el.classList.add("tier-base");
  }

  function setUserCard(user) {
    const nameEl = qs("userName");
    const logoutBtn = qs("logoutBtn");
    if (user?.username) {
      if (nameEl) nameEl.textContent = user.username;
      setTierBadge(user.tier || "BASE");
      if (logoutBtn) logoutBtn.style.display = "inline-flex";
    } else {
      if (nameEl) nameEl.textContent = "Guest";
      setTierBadge("BASE");
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  }

  // ---------- Sidebar roster render ----------
  function closeAllMiniMenus(root) {
    (root || document).querySelectorAll(".mini-menu.open").forEach(m => m.classList.remove("open"));
  }

  function makeSidebarRow(card) {
    const row = document.createElement("div");
    row.className = "interest-item";

    const label = document.createElement("button");
    label.type = "button";
    label.className = "interest-item-label";
    label.textContent = card.name;
    label.addEventListener("click", () => {
      // go to roster and focus this card
      window.location.href = `/roster?focus=${encodeURIComponent(card.id)}`;
    });

    const menuWrap = document.createElement("div");
    menuWrap.className = "mini-menu";

    const menuBtn = document.createElement("button");
    menuBtn.type = "button";
    menuBtn.className = "mini-menu-btn";
    menuBtn.textContent = "⋯";
    menuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeAllMiniMenus(document);
      menuWrap.classList.toggle("open");
    });

    const pop = document.createElement("div");
    pop.className = "mini-menu-pop";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "mini-menu-item";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => {
      window.location.href = `/roster?edit=${encodeURIComponent(card.id)}`;
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "mini-menu-item danger";
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      await apiFetch(`${API.roster}/${card.id}`, { method: "DELETE" });
      await renderSidebarRoster();
      window.dispatchEvent(new CustomEvent("roster:changed"));
    });

    pop.appendChild(edit);
    pop.appendChild(del);

    menuWrap.appendChild(menuBtn);
    menuWrap.appendChild(pop);

    row.appendChild(label);
    row.appendChild(menuWrap);

    return row;
  }

  async function renderSidebarRoster() {
    const list = qs("interestList");
    if (!list) return;

    list.innerHTML = "";

    const token = getToken();
    if (!token) return;

    try {
      const cards = await apiFetch(API.roster, { method: "GET" });
      cards.forEach(c => list.appendChild(makeSidebarRow(c)));
    } catch (e) {
      // if token invalid, auto logout
      setToken("");
      setUser(null);
      setUserCard(null);
    }
  }

  document.addEventListener("click", () => closeAllMiniMenus(document));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllMiniMenus(document); });

  // expose for other scripts
  window.CullenAuth = {
    getToken,
    setToken,
    getUser,
    setUser,
    apiFetch,
    renderSidebarRoster,
    setUserCard,
  };

  // initial paint
  setUserCard(getUser());
  renderSidebarRoster();

  // re-render if roster changed (from roster page)
  window.addEventListener("roster:changed", renderSidebarRoster);
})();
