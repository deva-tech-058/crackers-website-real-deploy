(function initNavbarAuth(global) {
  const SESSION_KEYS = ["authSession", "token", "username", "isLoggedIn", "mobile", "role", "isAdmin"];
  const USER_ID_KEY = "userId";
  const NAV_SELECTOR = ".navbar .nav-links";
  const LOGIN_SELECTOR =
    '[data-auth-login], #loginLink, .nav-auth-login, .nav-login-btn, a[href="/login.html"], a[href$="/login.html"]';
  const USER_SECTION_SELECTOR = '[data-auth-user], #userSection, .nav-auth-user, .user-section';
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
      mobile: localStorage.getItem("mobile") || "",
    };
  }

  function clearSession() {
    if (global.AuthSession && typeof global.AuthSession.clear === "function") {
      global.AuthSession.clear();
    } else {
      SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
      global.dispatchEvent(new CustomEvent("auth:changed", { detail: null }));
    }

    // clear user association used by per-user storage keys
    localStorage.removeItem(USER_ID_KEY);

    if (global.CartUtils && typeof global.CartUtils.clearCart === "function") {
      global.CartUtils.clearCart();
    } else {
      localStorage.removeItem("cart");
      global.dispatchEvent(new CustomEvent("cart:updated"));
    }

    // also clear orders so they are not visible after logging out
    localStorage.removeItem("orders");
    global.dispatchEvent(new CustomEvent("orders:changed", { detail: [] }));
  }

  function notifyServerLogout() {
    fetch("/api/auth/logout", { method: "POST", keepalive: true }).catch(() => {
      // no-op: local state will still be cleared
    });
  }

  function placeAuthNode(navLinks, node) {
    const cartNode = navLinks.querySelector(".cart");
    if (cartNode) {
      navLinks.insertBefore(node, cartNode);
      return;
    }
    navLinks.appendChild(node);
  }

  function parseArrayFromStorage(key) {
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getUserId() {
    const userId = localStorage.getItem(USER_ID_KEY);
    return userId ? String(userId).trim() : "";
  }

  function getOrderKeys(session) {
    const keys = [];
    const userId = getUserId();

    if (session && userId) {
      keys.push(`orders_${userId}`);
    }

    keys.push("orders");
    return Array.from(new Set(keys));
  }

  function getCartKeys(session) {
    const keys = [];
    const username = session && session.username ? String(session.username).trim() : "";
    const userId = getUserId();

    if (username) {
      keys.push(`cart_${encodeURIComponent(username)}`);
    }
    if (userId) {
      keys.push(`cart_${userId}`);
    }

    keys.push("cart");
    return Array.from(new Set(keys));
  }

  function getOrderCount(session) {
    const keys = getOrderKeys(session);
    for (const key of keys) {
      if (localStorage.getItem(key) === null) continue;
      return parseArrayFromStorage(key).length;
    }
    return 0;
  }

  function countCartItems(cart) {
    if (!Array.isArray(cart)) return 0;
    return cart.reduce((sum, item) => {
      const qty = Number.parseInt(item && item.quantity, 10);
      return sum + (Number.isFinite(qty) && qty > 0 ? qty : 1);
    }, 0);
  }

  function getCartCount(session) {
    if (
      global.CartUtils &&
      typeof global.CartUtils.getCart === "function" &&
      typeof global.CartUtils.getSummary === "function"
    ) {
      try {
        const summary = global.CartUtils.getSummary(global.CartUtils.getCart());
        const count = Number.parseInt(summary && summary.totalItems, 10);
        return Number.isFinite(count) && count >= 0 ? count : 0;
      } catch {
        // fallback to storage key parsing
      }
    }

    const keys = getCartKeys(session);
    for (const key of keys) {
      if (localStorage.getItem(key) === null) continue;
      return countCartItems(parseArrayFromStorage(key));
    }
    return 0;
  }

  function setElementVisible(element, visible, displayValue) {
    if (!element) return;
    element.hidden = !visible;
    element.setAttribute("aria-hidden", String(!visible));
    element.style.setProperty("display", visible ? displayValue : "none", "important");
  }

  function setCountBadge(badge, count) {
    if (!badge) return;
    const safeCount = Number.isFinite(count) && count > 0 ? count : 0;
    badge.textContent = String(safeCount);
    badge.style.setProperty("display", "inline-flex", "important");
  }

  function removeDuplicateNodes(nodes, keepNode) {
    nodes.forEach((node) => {
      if (node !== keepNode) {
        node.remove();
      }
    });
  }

  function ensureNavAuthMarkup(navLinks) {
    const loginNodes = Array.from(navLinks.querySelectorAll(LOGIN_SELECTOR)).filter(
      (node) => node && node.tagName === "A"
    );
    let loginLink =
      loginNodes.find((node) => node.hasAttribute("data-auth-login")) ||
      loginNodes.find((node) => node.id === "loginLink") ||
      loginNodes[0] ||
      null;

    const userSectionNodes = Array.from(navLinks.querySelectorAll(USER_SECTION_SELECTOR)).filter(
      (node) => node && node.tagName === "DIV"
    );
    let userSection =
      userSectionNodes.find((node) => node.hasAttribute("data-auth-user")) ||
      userSectionNodes.find((node) => node.id === "userSection") ||
      userSectionNodes[0] ||
      null;

    if (!loginLink) {
      loginLink = document.createElement("a");
      loginLink.href = "/login.html";
      loginLink.textContent = "Login";
      loginLink.className = "btn nav-auth-login nav-login-btn";
      loginLink.setAttribute("data-auth-login", "true");
      placeAuthNode(navLinks, loginLink);
    } else {
      loginLink.classList.add("nav-auth-login", "nav-login-btn");
      if (!loginLink.getAttribute("href")) {
        loginLink.setAttribute("href", "/login.html");
      }
      loginLink.setAttribute("data-auth-login", "true");
    }
    removeDuplicateNodes(loginNodes, loginLink);

    if (!userSection) {
      userSection = document.createElement("div");
      userSection.className = "nav-auth-user";
      userSection.setAttribute("data-auth-user", "true");
      userSection.hidden = true;

      const nameSpan = document.createElement("span");
      nameSpan.className = "nav-auth-name";
      nameSpan.setAttribute("data-auth-name", "true");

      const logoutBtn = document.createElement("button");
      logoutBtn.type = "button";
      logoutBtn.className = "btn nav-auth-logout";
      logoutBtn.textContent = "Logout";
      logoutBtn.setAttribute("data-auth-logout", "true");

      userSection.appendChild(nameSpan);
      userSection.appendChild(logoutBtn);
      placeAuthNode(navLinks, userSection);
    } else {
      userSection.classList.add("nav-auth-user");
      userSection.setAttribute("data-auth-user", "true");
    }
    removeDuplicateNodes(userSectionNodes, userSection);

    let usernameEl =
      userSection.querySelector("[data-auth-name]") ||
      userSection.querySelector("#welcomeUser") ||
      userSection.querySelector(".welcome-user") ||
      userSection.querySelector(".nav-auth-name");

    if (!usernameEl) {
      usernameEl = document.createElement("span");
      usernameEl.className = "nav-auth-name";
      usernameEl.setAttribute("data-auth-name", "true");
      userSection.insertBefore(usernameEl, userSection.firstChild);
    } else {
      usernameEl.classList.add("nav-auth-name");
      usernameEl.setAttribute("data-auth-name", "true");
    }

    let logoutBtn =
      userSection.querySelector("[data-auth-logout]") ||
      userSection.querySelector("#logoutBtn") ||
      userSection.querySelector(".nav-auth-logout");

    if (!logoutBtn) {
      logoutBtn = document.createElement("button");
      logoutBtn.type = "button";
      logoutBtn.className = "btn nav-auth-logout nav-logout-btn";
      logoutBtn.textContent = "Logout";
      logoutBtn.setAttribute("data-auth-logout", "true");
      userSection.appendChild(logoutBtn);
    } else {
      logoutBtn.classList.add("nav-auth-logout", "nav-logout-btn");
      logoutBtn.setAttribute("data-auth-logout", "true");
    }

    if (!logoutBtn.dataset.boundLogout) {
      logoutBtn.addEventListener("click", () => {
        notifyServerLogout();
        clearSession();
        if (global.location && global.location.pathname !== "/") {
          global.location.replace("/");
          return;
        }
        renderAll();
      });
      logoutBtn.dataset.boundLogout = "true";
    }

    // ensure an order icon/link is present
    const orderNodes = Array.from(navLinks.querySelectorAll(".orders"));
    let orderLink = orderNodes[0] || null;
    if (!orderLink) {
      orderLink = document.createElement("a");
      orderLink.href = "/order-details.html";
      orderLink.className = "orders";
      orderLink.setAttribute("aria-label", "Orders");
      orderLink.innerHTML = '<i class="fa-solid fa-box-open"></i>';
      placeAuthNode(navLinks, orderLink);
    }
    removeDuplicateNodes(orderNodes, orderLink);

    // make sure order count badge exists
    let orderCount = orderLink.querySelector(".orders-count");
    if (!orderCount) {
      orderCount = document.createElement("span");
      orderCount.className = "orders-count";
      orderCount.style.display = "none"; // hide until we have a positive count
      orderLink.appendChild(orderCount);
    }

    // ensure cart count badge reference so navbar can keep it synced
    const cartNode = navLinks.querySelector(".cart");
    let cartCount = null;
    if (cartNode) {
      cartCount =
        cartNode.querySelector(".cart-count") ||
        cartNode.querySelector("#cartCount") ||
        cartNode.querySelector("#headerCartCount");

      if (!cartCount) {
        cartCount = document.createElement("span");
        cartCount.className = "cart-count";
        cartCount.textContent = "0";
        cartNode.appendChild(cartCount);
      } else {
        cartCount.classList.add("cart-count");
      }
    }

    return {
      loginLink,
      userSection,
      usernameEl,
      orderLink,
      orderCount,
      cartCount,
    };
  }

  function renderNav(navLinks) {
    const ui = ensureNavAuthMarkup(navLinks);
    const session = getSession();
    const username = session && session.username ? session.username.trim() : "";
    const role = String(session && session.role ? session.role : "user")
      .trim()
      .toLowerCase();
    const isAdmin = role === "admin";

    // update order count badge every time nav rerenders
    if (ui.orderCount) {
      const orderCount = getOrderCount(session);
      setCountBadge(ui.orderCount, orderCount);
    }

    // update cart count badge using CartUtils if available, else fallback storage keys
    if (ui.cartCount) {
      const cartCount = getCartCount(session);
      setCountBadge(ui.cartCount, cartCount);
    }

    if (username) {
      setElementVisible(ui.loginLink, false, "inline-flex");
      setElementVisible(ui.userSection, true, "flex");
      ui.usernameEl.textContent = `Hi, ${username}`;
      return;
    }

    setElementVisible(ui.loginLink, true, "inline-flex");
    setElementVisible(ui.userSection, false, "flex");
    ui.usernameEl.textContent = "";
  }

  function renderAll() {
    const navLinksList = document.querySelectorAll(NAV_SELECTOR);
    navLinksList.forEach((navLinks) => {
      renderNav(navLinks);
    });
  }

  function bindGlobalListeners() {
    if (listenersBound) return;
    listenersBound = true;

    global.addEventListener("auth:changed", renderAll);
    global.addEventListener("orders:changed", renderAll);
    global.addEventListener("cart:updated", renderAll);
    global.addEventListener("storage", (event) => {
      const key = event.key || "";
      if (
        key === "" ||
        SESSION_KEYS.includes(key) ||
        key === "authSession" ||
        key === USER_ID_KEY ||
        key === "orders" ||
        key.startsWith("orders_") ||
        key === "cart" ||
        key.startsWith("cart_")
      ) {
        renderAll();
      }
    });
  }

  function mount() {
    bindGlobalListeners();
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  global.NavbarAuth = Object.freeze({
    mount,
    render: renderAll,
  });
})(window);
