(function initRuntimeConfig(global) {
  // Update these values during frontend deployment when API is on a different domain.
  const defaults = {
    API_BASE_URL: "",
    ASSET_BASE_URL: "",
    FRONTEND_BASE_URL: "",
  };

  const current = global.__APP_CONFIG__ && typeof global.__APP_CONFIG__ === "object"
    ? global.__APP_CONFIG__
    : {};

  global.__APP_CONFIG__ = {
    ...defaults,
    ...current,
  };
})(window);
