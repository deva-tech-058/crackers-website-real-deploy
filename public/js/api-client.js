(function initAppApi(global) {
  const config = global.__APP_CONFIG__ || {};
  const apiBaseUrl = String(config.API_BASE_URL || "").trim().replace(/\/+$/g, "");
  const assetBaseUrl = String(config.ASSET_BASE_URL || apiBaseUrl || "")
    .trim()
    .replace(/\/+$/g, "");

  function isAbsoluteUrl(url) {
    const value = String(url || "").trim();
    if (!value) return false;
    return /^[a-z][a-z\d+\-.]*:/i.test(value) || value.startsWith("//");
  }

  function normalizePath(pathname) {
    const value = String(pathname || "").trim();
    if (!value) return "/";
    return value.startsWith("/") ? value : `/${value}`;
  }

  function isApiPath(pathname) {
    const path = normalizePath(pathname);
    return path === "/api" || path.startsWith("/api/");
  }

  function isUploadPath(pathname) {
    return normalizePath(pathname).startsWith("/uploads/");
  }

  function toApiUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return raw;

    const parsed = new URL(raw, global.location.origin);
    const absoluteInput = isAbsoluteUrl(raw);

    if (absoluteInput && parsed.origin !== global.location.origin) {
      return raw;
    }

    if (!isApiPath(parsed.pathname) || !apiBaseUrl) {
      return raw;
    }

    return `${apiBaseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  function toAssetUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return raw;

    const parsed = new URL(raw, global.location.origin);
    const absoluteInput = isAbsoluteUrl(raw);

    if (absoluteInput && parsed.origin !== global.location.origin) {
      return raw;
    }

    if (!isUploadPath(parsed.pathname) || !assetBaseUrl) {
      return raw;
    }

    return `${assetBaseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  function rewriteUrl(url) {
    return toAssetUrl(toApiUrl(url));
  }

  function isApiOrUploadUrl(rawUrl) {
    const parsed = new URL(String(rawUrl || ""), global.location.origin);
    return isApiPath(parsed.pathname) || isUploadPath(parsed.pathname);
  }

  function rewriteFormActions() {
    const forms = document.querySelectorAll("form[action]");
    forms.forEach((form) => {
      const action = String(form.getAttribute("action") || "").trim();
      if (!action || !action.startsWith("/api/")) return;
      form.setAttribute("action", toApiUrl(action));
    });
  }

  function rewriteStaticAssetTags() {
    const selectors = [
      'img[src^="/uploads/"]',
      'video[src^="/uploads/"]',
      'source[src^="/uploads/"]',
    ];
    document.querySelectorAll(selectors.join(",")).forEach((element) => {
      const src = String(element.getAttribute("src") || "").trim();
      if (!src) return;
      element.setAttribute("src", toAssetUrl(src));
    });
  }

  if (typeof global.fetch === "function") {
    const originalFetch = global.fetch.bind(global);

    global.fetch = function patchedFetch(input, init) {
      let nextInput = input;
      let nextInit = init ? { ...init } : undefined;

      if (typeof nextInput === "string" || nextInput instanceof URL) {
        nextInput = rewriteUrl(String(nextInput));
      } else if (global.Request && nextInput instanceof Request) {
        const rewrittenRequestUrl = rewriteUrl(nextInput.url);
        if (rewrittenRequestUrl !== nextInput.url) {
          nextInput = new Request(rewrittenRequestUrl, nextInput);
        }
      }

      const currentRequestUrl =
        typeof nextInput === "string"
          ? nextInput
          : nextInput instanceof URL
            ? nextInput.toString()
            : nextInput?.url;

      if (currentRequestUrl && isApiOrUploadUrl(currentRequestUrl)) {
        const existingCredentials =
          nextInit?.credentials ||
          (global.Request && nextInput instanceof Request ? nextInput.credentials : undefined);

        if (!existingCredentials || existingCredentials === "same-origin") {
          nextInit = {
            ...(nextInit || {}),
            credentials: "include",
          };
        }
      }

      return originalFetch(nextInput, nextInit);
    };
  }

  const mount = () => {
    rewriteFormActions();
    rewriteStaticAssetTags();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  global.AppApi = Object.freeze({
    config: Object.freeze({
      apiBaseUrl,
      assetBaseUrl,
    }),
    toApiUrl,
    toAssetUrl,
    rewriteUrl,
  });
})(window);
