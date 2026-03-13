(function initAdminNavbar(global) {
  const NAV_LINKS_SELECTOR = ".navbar .nav-links";
  const WELCOME_SELECTOR = "[data-admin-welcome], #adminWelcome, .admin-welcome";
  const LOGOUT_SELECTOR = ".logout-btn, [data-auth-logout], #logoutBtn";
  const STYLE_ID = "admin-navbar-style";
  let listenersBound = false;

  function getSession() {
    if (global.AuthSession && typeof global.AuthSession.get === "function") {
      return global.AuthSession.get();
    }

    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    if (!token || !username) return null;

    return {
      token,
      username,
      role: localStorage.getItem("role") || "user",
    };
  }

  function normalizeRole(value) {
    const role = String(value || "user").trim().toLowerCase();
    return role === "admin" ? "admin" : "user";
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .admin-welcome {
        display: inline-flex;
        align-items: center;
        color: #ffd699;
        font-size: 13px;
        font-weight: 600;
        background: rgba(255, 215, 0, 0.12);
        border: 1px solid rgba(255, 215, 0, 0.25);
        border-radius: 999px;
        padding: 6px 12px;
        line-height: 1;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureWelcomeNode(navLinks) {
    let welcomeNode = navLinks.querySelector(WELCOME_SELECTOR);
    if (!welcomeNode) {
      welcomeNode = document.createElement("span");
      welcomeNode.className = "admin-welcome";
      welcomeNode.setAttribute("data-admin-welcome", "true");
      const logoutBtn = navLinks.querySelector(LOGOUT_SELECTOR);
      if (logoutBtn && logoutBtn.parentNode === navLinks) {
        navLinks.insertBefore(welcomeNode, logoutBtn);
      } else {
        navLinks.appendChild(welcomeNode);
      }
    } else {
      welcomeNode.classList.add("admin-welcome");
      welcomeNode.setAttribute("data-admin-welcome", "true");
    }

    return welcomeNode;
  }

  function render() {
    const navLinks = document.querySelector(NAV_LINKS_SELECTOR);
    if (!navLinks) return;

    ensureStyle();
    const welcomeNode = ensureWelcomeNode(navLinks);
    const session = getSession();

    if (!session || !session.username) {
      welcomeNode.hidden = true;
      welcomeNode.textContent = "";
      return;
    }

    const role = normalizeRole(session.role);
    const username = String(session.username).trim();

    welcomeNode.hidden = false;
    welcomeNode.textContent = role === "admin" ? `Admin: ${username}` : `User: ${username}`;
  }

  function bindListeners() {
    if (listenersBound) return;
    listenersBound = true;

    global.addEventListener("auth:changed", render);
    global.addEventListener("storage", (event) => {
      const key = String(event.key || "");
      if (
        key === "" ||
        key === "authSession" ||
        key === "username" ||
        key === "role" ||
        key === "token"
      ) {
        render();
      }
    });
  }

  function mount() {
    bindListeners();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  global.AdminNavbar = Object.freeze({
    mount,
    render,
  });
})(window);
