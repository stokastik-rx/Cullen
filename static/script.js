// /static/script.js (FULL REPLACE)

(() => {
  const auth = window.CullenAuth;
  if (!auth) return;

  const signupBtn = document.getElementById("signupBtn");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const signupModal = document.getElementById("signupModal");
  const loginModal = document.getElementById("loginModal");
  const signupClose = document.getElementById("signupModalClose");
  const loginClose = document.getElementById("loginModalClose");

  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");

  const signupError = document.getElementById("signupError");
  const loginError = document.getElementById("loginError");

  function openModal(el) {
    if (!el) return;
    el.classList.add("active");
  }
  function closeModal(el) {
    if (!el) return;
    el.classList.remove("active");
  }
  function setErr(el, msg) {
    if (!el) return;
    if (!msg) {
      el.classList.remove("visible");
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.classList.add("visible");
  }

  signupBtn?.addEventListener("click", () => {
    setErr(signupError, "");
    openModal(signupModal);
  });

  loginBtn?.addEventListener("click", () => {
    setErr(loginError, "");
    openModal(loginModal);
  });

  signupClose?.addEventListener("click", () => closeModal(signupModal));
  loginClose?.addEventListener("click", () => closeModal(loginModal));

  signupModal?.addEventListener("click", (e) => {
    if (e.target === signupModal) closeModal(signupModal);
  });
  loginModal?.addEventListener("click", (e) => {
    if (e.target === loginModal) closeModal(loginModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal(signupModal);
      closeModal(loginModal);
    }
  });

  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setErr(signupError, "");

    const email = document.getElementById("signupEmail")?.value?.trim() || "";
    const username = document.getElementById("signupUsername")?.value?.trim() || "";
    const password = document.getElementById("signupPassword")?.value || "";

    try {
      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Signup failed");
      }
      const data = await res.json();
      auth.setToken(data.access_token);
      auth.setUser({ username: data.username, tier: data.tier });
      auth.setUserCard(auth.getUser());
      await auth.renderSidebarRoster();
      closeModal(signupModal);
    } catch (err) {
      setErr(signupError, err.message || "Signup failed");
    }
  });

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setErr(loginError, "");

    const username = document.getElementById("loginUsername")?.value?.trim() || "";
    const password = document.getElementById("loginPassword")?.value || "";

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Login failed");
      }
      const data = await res.json();
      auth.setToken(data.access_token);
      auth.setUser({ username: data.username, tier: data.tier });
      auth.setUserCard(auth.getUser());
      await auth.renderSidebarRoster();
      closeModal(loginModal);
    } catch (err) {
      setErr(loginError, err.message || "Login failed");
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    auth.setToken("");
    auth.setUser(null);
    auth.setUserCard(null);
    await auth.renderSidebarRoster();
  });
})();
