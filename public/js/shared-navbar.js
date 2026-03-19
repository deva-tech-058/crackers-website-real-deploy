(function initSharedNavbar(global) {
  const NAVBAR_SELECTOR = ".navbar";
  const NAV_LINKS_SELECTOR = ".nav-links";
  const LOGO_SELECTOR = ".logo";
  const MOBILE_BREAKPOINT = 960;
  const BRAND_NAME = "Mr.A Crackers";

  function createToggleButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-toggle";
    button.setAttribute("aria-label", "Open menu");
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
    return button;
  }

  function setOpenState(navbar, button, isOpen) {
    navbar.classList.toggle("nav-open", isOpen);
    button.setAttribute("aria-expanded", String(isOpen));
    button.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
    const icon = button.querySelector("i");
    if (icon) {
      icon.className = isOpen ? "fa-solid fa-xmark" : "fa-solid fa-bars";
    }
  }

  function normalizeLogo(logo) {
    if (!logo || logo.dataset.brandNormalized === "true") return;

    logo.innerHTML = `
      <span class="brand-icon" aria-hidden="true">
        <i class="fa-solid fa-fire-flame-curved"></i>
      </span>
      <span class="brand-text">${BRAND_NAME}</span>
    `;

    logo.setAttribute("aria-label", BRAND_NAME);
    logo.dataset.brandNormalized = "true";
  }

  function closeOnNavClick(navbar, button, navLinks) {
    navLinks.addEventListener("click", (event) => {
      const clickable = event.target.closest("a, button");
      if (!clickable) return;
      if (global.innerWidth > MOBILE_BREAKPOINT) return;
      if (clickable.classList.contains("nav-toggle")) return;
      setOpenState(navbar, button, false);
    });
  }

  function closeOnOutsideClick(navbar, button) {
    document.addEventListener("click", (event) => {
      if (global.innerWidth > MOBILE_BREAKPOINT) return;
      if (!navbar.classList.contains("nav-open")) return;
      if (navbar.contains(event.target)) return;
      setOpenState(navbar, button, false);
    });
  }

  function setupNavbar(navbar) {
    if (!navbar || navbar.dataset.mobileReady === "true") return;

    const navLinks = navbar.querySelector(NAV_LINKS_SELECTOR);
    if (!navLinks) return;

    const logo = navbar.querySelector(LOGO_SELECTOR);
    normalizeLogo(logo);

    const toggle = createToggleButton();
    const hasExistingToggle = navbar.querySelector(".nav-toggle");
    if (!hasExistingToggle) {
      navbar.insertBefore(toggle, navLinks);
    }

    const menuButton = hasExistingToggle || toggle;
    navbar.classList.add("nav-mobile-ready");

    menuButton.addEventListener("click", () => {
      const isOpen = !navbar.classList.contains("nav-open");
      setOpenState(navbar, menuButton, isOpen);
    });

    closeOnNavClick(navbar, menuButton, navLinks);
    closeOnOutsideClick(navbar, menuButton);

    navbar.dataset.mobileReady = "true";
  }

  function syncForViewport() {
    document.querySelectorAll(`${NAVBAR_SELECTOR}.nav-mobile-ready`).forEach((navbar) => {
      if (global.innerWidth > MOBILE_BREAKPOINT) {
        const toggle = navbar.querySelector(".nav-toggle");
        if (toggle) {
          setOpenState(navbar, toggle, false);
        }
      }
    });
  }

  function mount() {
    document.querySelectorAll(NAVBAR_SELECTOR).forEach(setupNavbar);
    syncForViewport();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  global.addEventListener("resize", syncForViewport);

  global.SharedNavbar = Object.freeze({
    mount,
  });
})(window);

