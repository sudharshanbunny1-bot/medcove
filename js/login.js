(function () {
  // If already signed in, skip straight to the dashboard.
  if (sessionStorage.getItem("hms_token") || localStorage.getItem("hms_token")) {
    window.location.href = "dashboard.html";
    return;
  }

  const form = document.getElementById("loginForm");
  const emailField = document.getElementById("emailField");
  const passwordField = document.getElementById("passwordField");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const rememberMe = document.getElementById("rememberMe");
  const banner = document.getElementById("loginBanner");
  const loginBtn = document.getElementById("loginBtn");
  const loginBtnLabel = document.getElementById("loginBtnLabel");
  const toggleBtn = document.getElementById("togglePw");

  toggleBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleBtn.textContent = isPassword ? "Hide" : "Show";
  });

  function setError(fieldEl, hasError) {
    fieldEl.classList.toggle("has-error", hasError);
  }

  function isValidUsername(value) {
    return value.trim().length >= 3;
  }

  function validate() {
    let valid = true;
    if (!isValidUsername(emailInput.value)) {
      setError(emailField, true);
      valid = false;
    } else {
      setError(emailField, false);
    }

    if (passwordInput.value.length < 6) {
      setError(passwordField, true);
      valid = false;
    } else {
      setError(passwordField, false);
    }
    return valid;
  }

  function showBanner(message) {
    banner.textContent = message;
    banner.classList.add("show");
  }
  function hideBanner() {
    banner.classList.remove("show");
  }

  // Clear a field's error state as the user starts fixing it.
  emailInput.addEventListener("input", () => setError(emailField, false));
  passwordInput.addEventListener("input", () => setError(passwordField, false));

  function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtnLabel.innerHTML = isLoading
      ? '<span class="spinner" aria-hidden="true"></span> Signing in&hellip;'
      : "Sign in";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBanner();

    if (!validate()) return;

    setLoading(true);
    try {
      const { token, user } = await Api.login(emailInput.value.trim(), passwordInput.value);
      const storage = rememberMe.checked ? localStorage : sessionStorage;
      storage.setItem("hms_token", token);
      storage.setItem("hms_user", JSON.stringify(user));
      window.location.href = "dashboard.html";
    } catch (err) {
      showBanner(err.message);
    } finally {
      setLoading(false);
    }
  });
})();
