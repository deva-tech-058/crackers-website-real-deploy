const MOBILE_REGEX = /^\d{10}$/;
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginTabBtn = document.getElementById("loginTabBtn");
const registerTabBtn = document.getElementById("registerTabBtn");
const formMessage = document.getElementById("formMessage");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const registerSubmitBtn = document.getElementById("registerSubmitBtn");

document.addEventListener("DOMContentLoaded", () => {
  if (window.AuthSession && window.AuthSession.isLoggedIn()) {
    const session = window.AuthSession.get();
    const role = String(session?.role || "user").trim().toLowerCase();
    window.location.replace(role === "admin" ? "/admin/admin-dashboard.html" : "/");
    return;
  }

  // if a returnUrl is present we notify the user why they are on this page
  const params = new URLSearchParams(window.location.search);
  const returnUrl = params.get("returnUrl");
  if (returnUrl) {
    showMessage("info", "Please login to continue.");
  }

  enforceNumericMobileInput("loginMobile");
  enforceNumericMobileInput("registerMobile");
  setupRealTimeValidation();
  bindAuthTabSwitching();
  bindAuthForms();
});

function bindAuthTabSwitching() {
  loginTabBtn.addEventListener("click", () => setActiveTab("login"));
  registerTabBtn.addEventListener("click", () => setActiveTab("register"));
}

function bindAuthForms() {
  loginForm.addEventListener("submit", handleLoginSubmit);
  registerForm.addEventListener("submit", handleRegisterSubmit);
}

function setupRealTimeValidation() {
  // Login form real-time validation
  const loginMobile = document.getElementById("loginMobile");
  const loginPassword = document.getElementById("loginPassword");

  if (loginMobile) {
    loginMobile.addEventListener("input", () => validateLoginMobile());
    loginMobile.addEventListener("blur", () => validateLoginMobile());
  }

  if (loginPassword) {
    loginPassword.addEventListener("input", () => validateLoginPasswordField());
    loginPassword.addEventListener("blur", () => validateLoginPasswordField());
  }

  // Register form real-time validation
  const registerName = document.getElementById("registerName");
  const registerMobile = document.getElementById("registerMobile");
  const registerPassword = document.getElementById("registerPassword");
  const registerConfirmPassword = document.getElementById("registerConfirmPassword");

  if (registerName) {
    registerName.addEventListener("input", () => validateRegisterName());
    registerName.addEventListener("blur", () => validateRegisterName());
  }

  if (registerMobile) {
    registerMobile.addEventListener("input", () => validateRegisterMobile());
    registerMobile.addEventListener("blur", () => validateRegisterMobile());
  }

  if (registerPassword) {
    registerPassword.addEventListener("input", () => validateRegisterPasswordField());
    registerPassword.addEventListener("blur", () => validateRegisterPasswordField());
  }

  if (registerConfirmPassword) {
    registerConfirmPassword.addEventListener("input", () => validateRegisterConfirmPasswordField());
    registerConfirmPassword.addEventListener("blur", () => validateRegisterConfirmPasswordField());
  }
}

function validateLoginMobile() {
  const mobileInput = document.getElementById("loginMobile");
  const mobile = mobileInput.value.trim();

  if (!mobile) {
    setFieldError(mobileInput, "Mobile number is required");
    return false;
  }

  if (!MOBILE_REGEX.test(mobile)) {
    setFieldError(mobileInput, "Enter a valid 10 digit mobile number");
    return false;
  }

  clearFieldError(mobileInput);
  return true;
}

function validateLoginPasswordField() {
  const passwordInput = document.getElementById("loginPassword");
  const password = passwordInput.value;

  if (!password) {
    clearFieldError(passwordInput);
    return true;
  }

  clearFieldError(passwordInput);
  return true;
}

function validateRegisterName() {
  const nameInput = document.getElementById("registerName");
  const name = nameInput.value.trim().replace(/\s+/g, " ");

  if (!name) {
    clearFieldError(nameInput);
    return true;
  }

  if (name.length < 2 || name.length > 80) {
    setFieldError(nameInput, "Name must be between 2 and 80 characters");
    return false;
  }

  clearFieldError(nameInput);
  return true;
}

function validateRegisterMobile() {
  const mobileInput = document.getElementById("registerMobile");
  const mobile = mobileInput.value.trim();

  if (!mobile) {
    clearFieldError(mobileInput);
    return true;
  }

  if (!MOBILE_REGEX.test(mobile)) {
    setFieldError(mobileInput, "Enter a valid 10 digit mobile number");
    return false;
  }

  clearFieldError(mobileInput);
  return true;
}

function validateRegisterPasswordField() {
  const passwordInput = document.getElementById("registerPassword");
  const password = passwordInput.value;

  if (!password) {
    setFieldError(passwordInput, "Password is required");
    return false;
  }

  const passwordError = validateStrongPassword(password);
  if (passwordError) {
    setFieldError(passwordInput, passwordError);
    return false;
  }

  clearFieldError(passwordInput);
  return true;
}

function validateRegisterConfirmPasswordField() {
  const passwordInput = document.getElementById("registerPassword");
  const confirmPasswordInput = document.getElementById("registerConfirmPassword");
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!confirmPassword) {
    clearFieldError(confirmPasswordInput);
    return true;
  }

  if (password !== confirmPassword) {
    setFieldError(confirmPasswordInput, "Passwords do not match");
    return false;
  }

  clearFieldError(confirmPasswordInput);
  return true;
}

function validateRegisterForm() {
  const nameValid = validateRegisterName();
  const mobileValid = validateRegisterMobile();
  const passwordValid = validateRegisterPasswordField();
  const confirmValid = validateRegisterConfirmPasswordField();

  if (!nameValid || !mobileValid || !passwordValid || !confirmValid) {
    showMessage("error", "Please correct the highlighted fields.");
    return false;
  }

  return true;
}

function validateLoginForm() {
  const mobileValid = validateLoginMobile();
  const passwordInput = document.getElementById("loginPassword");
  const password = passwordInput.value;

  if (!password) {
    setFieldError(passwordInput, "Password is required");
  } else {
    clearFieldError(passwordInput);
  }

  if (!mobileValid || !password) {
    showMessage("error", "Please correct the highlighted fields.");
    return false;
  }

  return true;
}

function setActiveTab(tabName) {
  const showLogin = tabName === "login";

  loginTabBtn.classList.toggle("active", showLogin);
  registerTabBtn.classList.toggle("active", !showLogin);

  loginTabBtn.setAttribute("aria-selected", String(showLogin));
  registerTabBtn.setAttribute("aria-selected", String(!showLogin));

  loginForm.classList.toggle("active", showLogin);
  registerForm.classList.toggle("active", !showLogin);

  clearMessage();
  clearFormErrors(loginForm);
  clearFormErrors(registerForm);
}

function enforceNumericMobileInput(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 10);
  });

  input.addEventListener("paste", () => {
    setTimeout(() => {
      input.value = input.value.replace(/\D/g, "").slice(0, 10);
    }, 0);
  });
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearMessage();
  clearFormErrors(loginForm);

  if (!validateLoginForm()) {
    return;
  }

  const mobileInput = document.getElementById("loginMobile");
  const passwordInput = document.getElementById("loginPassword");

  const mobile = mobileInput.value.trim();
  const password = passwordInput.value;

  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = "Logging in...";

  try {
    const payload = await apiRequest("/api/auth/login", {
      mobile,
      password,
    });

    if (!payload.token || !payload.username) {
      throw new Error("Invalid login response from server");
    }

    const role = String(payload.role || "user").trim().toLowerCase() === "admin" ? "admin" : "user";
    const isAdmin = role === "admin";
    const normalizedUserId = Number.parseInt(String(payload.userId || ""), 10);
    const userId = Number.isInteger(normalizedUserId) && normalizedUserId > 0
      ? normalizedUserId
      : null;

    if (window.AuthSession) {
      window.AuthSession.set({
        token: payload.token,
        username: payload.username,
        mobile,
        loggedInAt: new Date().toISOString(),
        role,
        userId,
      });
    } else {
      localStorage.setItem("token", payload.token);
      localStorage.setItem("username", payload.username);
      localStorage.setItem("role", role);
      localStorage.setItem("isAdmin", isAdmin ? "true" : "false");
      localStorage.setItem("isLoggedIn", "true");
      window.dispatchEvent(new CustomEvent("auth:changed"));
    }

    // Store userId for order history association
    if (userId) {
      localStorage.setItem("userId", String(userId));
    }

    // after successful login redirect back to caller if returnUrl was provided
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get("returnUrl");
    if (returnUrl) {
      try {
        const dest = new URL(returnUrl, window.location.origin);
        if (dest.origin === window.location.origin) {
          if (dest.pathname.startsWith("/admin") && !isAdmin) {
            showMessage("error", "This account does not have admin access.");
            window.location.replace("/");
            return;
          }

          window.location.replace(dest.href);
          return;
        }
      } catch {
        // ignore malformed URL
      }
    }

    window.location.replace(isAdmin ? "/admin/admin-dashboard.html" : "/");
  } catch (err) {
    const errorMessage = err.message || "Login failed. Try again.";
    
    if (errorMessage.toLowerCase().includes("mobile") || errorMessage.toLowerCase().includes("not found") || errorMessage.toLowerCase().includes("not registered")) {
      setFieldError(mobileInput, "Mobile number not registered. Please create an account.");
      showMessage("error", "Mobile not registered.");
    } else if (errorMessage.toLowerCase().includes("password") || errorMessage.toLowerCase().includes("incorrect") || errorMessage.toLowerCase().includes("invalid")) {
      setFieldError(passwordInput, "Incorrect password. Please check your password.");
      showMessage("error", "Password is incorrect.");
    } else {
      showMessage("error", errorMessage);
    }
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.textContent = "Login";
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  clearMessage();
  clearFormErrors(registerForm);

  const nameInput = document.getElementById("registerName");
  const mobileInput = document.getElementById("registerMobile");
  const passwordInput = document.getElementById("registerPassword");
  const confirmPasswordInput = document.getElementById("registerConfirmPassword");

  const name = nameInput.value.trim().replace(/\s+/g, " ");
  const mobile = mobileInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Run the unified validator which sets field errors and messages
  if (!validateRegisterForm()) {
    return;
  }

  registerSubmitBtn.disabled = true;
  registerSubmitBtn.textContent = "Creating...";

  try {
    await apiRequest("/api/auth/register", {
      name,
      mobile,
      password,
    });

    setActiveTab("login");

    const loginMobile = document.getElementById("loginMobile");
    const loginPassword = document.getElementById("loginPassword");
    loginMobile.value = mobile;
    loginPassword.value = password;

    showMessage("success", "Registration successful. Please login to continue.");
  } catch (err) {
    const errorMessage = err.message || "Registration failed. Try again.";
    
    // Map API errors to specific fields
    if (errorMessage.toLowerCase().includes("mobile") || errorMessage.toLowerCase().includes("already")) {
      setFieldError(mobileInput, "This mobile number is already registered. Please use a different number or login.");
      showMessage("error", "Mobile number already registered.");
    } else if (errorMessage.toLowerCase().includes("password")) {
      const defaultMessage = validateStrongPassword(password);
      setFieldError(passwordInput, defaultMessage || "Password does not meet requirements. Please include uppercase, lowercase, number, special character.");
      showMessage("error", "Password validation error.");
    } else if (errorMessage.toLowerCase().includes("name")) {
      setFieldError(nameInput, errorMessage);
      showMessage("error", "Name field validation error.");
    } else {
      showMessage("error", errorMessage);
    }
  } finally {
    registerSubmitBtn.disabled = false;
    registerSubmitBtn.textContent = "Create Account";
  }
}

function validateStrongPassword(password) {
  if (!password) {
    return "Password is required";
  }

  const rules = [];

  if (password.length < 8) {
    rules.push("at least 8 characters");
  }
  if (!/[a-z]/.test(password)) {
    rules.push("at least one lowercase letter");
  }
  if (!/[A-Z]/.test(password)) {
    rules.push("at least one uppercase letter");
  }
  if (!/\d/.test(password)) {
    rules.push("at least one number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    rules.push("at least one special character (!@#$%^&*)");
  }

  if (rules.length === 0) {
    return "";
  }

  return `Password must contain ${rules.join(", ")}.`;
}

function setFieldError(inputElement, message) {
  inputElement.classList.add("invalid");
  inputElement.classList.add("invalid-animated");

  const parent = inputElement.parentElement;
  if (parent) {
    parent.classList.add("field-error-animation");
  }

  const errorEl = parent.querySelector(".field-error");
  if (errorEl) {
    errorEl.textContent = message;
  }
}

function clearFieldError(inputElement) {
  inputElement.classList.remove("invalid");
  inputElement.classList.remove("invalid-animated");

  const parent = inputElement.parentElement;
  if (parent) {
    parent.classList.remove("field-error-animation");
  }

  const errorEl = parent.querySelector(".field-error");
  if (errorEl) {
    errorEl.textContent = "";
  }
}

function clearFormErrors(formElement) {
  formElement.querySelectorAll("input").forEach((input) => {
    input.classList.remove("invalid");
  });
  formElement.querySelectorAll(".field-error").forEach((errorEl) => {
    errorEl.textContent = "";
  });
}

function showMessage(type, text) {
  formMessage.className = `form-message ${type}`;
  formMessage.textContent = text;
}

function clearMessage() {
  formMessage.className = "form-message";
  formMessage.textContent = "";
}

async function apiRequest(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error("Unable to reach server. Please check backend status and try again.");
  }

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : {
      message: await response.text().catch(() => ""),
    };

  if (!response.ok) {
    const apiMessage = String(data.message || data.error || "").trim();
    if (apiMessage) {
      throw new Error(apiMessage);
    }

    if (response.status === 502) {
      throw new Error("Backend unavailable (502 Bad Gateway). Please retry in a few seconds.");
    }
    if (response.status === 503) {
      throw new Error("Service unavailable (503). Please retry shortly.");
    }
    if (response.status === 504) {
      throw new Error("Gateway timeout (504). The server took too long to respond.");
    }
    if (response.status >= 500) {
      throw new Error(`Server error (${response.status}). Please try again.`);
    }

    throw new Error(`Request failed (${response.status})`);
  }

  return data;
}
