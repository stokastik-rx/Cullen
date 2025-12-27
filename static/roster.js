(() => {
  // ---------- Grab elements (safe) ----------
  const container = document.getElementById("rosterCards");
  const interestList = document.getElementById("interestList");

  const modal = document.getElementById("rosterModal");
  const modalForm = document.getElementById("rosterModalForm");
  const nameInput = document.getElementById("interestNameInput");
  const bgInput = document.getElementById("interestBgInput");
  const closeBtn = document.getElementById("rosterModalClose");
  const cancelBtn = document.getElementById("rosterModalCancel");

  // If core things are missing, stop cleanly (no silent failure)
  if (!container || !modal || !modalForm || !nameInput || !bgInput) {
    console.error("[Roster] Missing required DOM elements. Check IDs in roster.html.");
    return;
  }

  // ---------- State ----------
  let activeCard = null;
  let isSubmitting = false;

  // ---------- Utilities ----------
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function spacedUpper(str) {
    return str.trim().toUpperCase().split("").join(" ");
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- Modal open/close (reliable animation) ----------
  function openModalForCard(card) {
    activeCard = card;

    nameInput.value = "";
    bgInput.value = "";

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    // Two frames ensures CSS transition always triggers
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

    // Hide after transition (fallback timer)
    const dialog = modal.querySelector(".modal-dialog");
    const done = () => {
      modal.classList.remove("is-open");
      activeCard = null;
    };

    if (dialog) {
      const onEnd = () => done();
      dialog.addEventListener("transitionend", onEnd, { once: true });
      setTimeout(done, 300); // fallback
    } else {
      setTimeout(done, 250);
    }
  }

  // ---------- Cards ----------
  function makeCard(state = "empty") {
    const card = document.createElement("div");
    card.className = "roster-card";
    card.dataset.state = state;

    const plus = document.createElement("div");
    plus.className = "plus";
    plus.textContent = "+";
    card.appendChild(plus);

    card.addEventListener("click", async () => {
      if (card.dataset.state !== "empty") return;

      // small click feedback
      card.style.transform = "scale(1.03)";
      await wait(80);
      card.style.transform = "";

      openModalForCard(card);
    });

    return card;
  }

  function fillCard(card, name, bg) {
    card.dataset.state = "filled";
    card.dataset.name = name;

    const title = spacedUpper(name);
    const sub =
      bg && bg.trim()
        ? `<div class="card-sub">${escapeHtml(bg.trim())}</div>`
        : "";

    card.innerHTML = `
      <div class="card-content">
        <div class="card-title">${escapeHtml(title)}</div>
        ${sub}
      </div>
    `;
  }

  // ---------- Sidebar roster list ----------
  function addToRosterList(name, card) {
    if (!interestList) return; // ✅ no crash if missing

    const item = document.createElement("div");
    item.className = "interest-item";
    item.textContent = name;

    item.addEventListener("click", () => {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    interestList.appendChild(item);
  }

  // ---------- Form submit (fix Enter glitch) ----------
  modalForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    isSubmitting = true;

    const name = nameInput.value.trim();
    const bg = bgInput.value;

    if (!name) {
      nameInput.focus();
      isSubmitting = false;
      return;
    }

    if (activeCard) {
      fillCard(activeCard, name, bg);
      addToRosterList(name, activeCard);

      // Add one new empty card
      container.appendChild(makeCard("empty"));
    }

    closeModal();
    setTimeout(() => (isSubmitting = false), 50);
  });

  // Prevent Enter in textarea from accidentally submitting (optional safety)
  bgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      modalForm.requestSubmit();
    }
  });

  // ---------- Close controls ----------
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target?.dataset?.close === "true") closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  // ---------- Init ----------
  modal.classList.remove("is-open", "is-visible");
  modal.setAttribute("aria-hidden", "true");

  container.innerHTML = "";
  if (interestList) interestList.innerHTML = "";
  container.appendChild(makeCard("empty"));
})();
