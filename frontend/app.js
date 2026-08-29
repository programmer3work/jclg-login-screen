const api = (window.JCLG_CONFIG?.apiBaseUrl || "http://127.0.0.1:16000").replace(/\/$/, "");
const app = document.querySelector("#app");
const error = document.querySelector("#error");
const bar = document.querySelector("#bar");

function setStep(number) {
    if (bar) {
        bar.style.width = `${number * 33.333}%`;
    }
}
function showError(message = "") { error.textContent = message; }
async function request(path, options = {}) {
    try {
        const response = await fetch(`${api}${path}`, { ...options, credentials: "include", headers: { "Content-Type": "application/json", ...options.headers } });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || "Request could not be completed.");
        showError("");
        return data;
    } catch (exception) {
        showError(exception.name === "TypeError" ? "The login service is unavailable. Please try again in a moment." : exception.message);
        return null;
    }
}
function post(path, body) { return request(path, { method: "POST", body: JSON.stringify(body) }); }

function renderLogin() {
    setStep(1);
    app.innerHTML = `<div class="eyebrow">WELCOME TO JCLG</div><h1>Access your workspace</h1><p class="lead">Sign in once to reach the workspace assigned to you.</p><div class="auth-cards"><article class="auth-card active"><div class="card-heading"><span class="card-number">01</span><div><strong>Login with Google</strong><small>Use your approved Google account</small></div><span class="card-status">REQUIRED</span></div><div class="google" id="google"><b>G</b><span>Continue with Google</span><strong>↗</strong></div><p class="note"><i></i> Your password is handled securely by Google</p></article><article class="auth-card locked"><div class="card-heading"><span class="card-number">02</span><div><strong>Verify mobile number</strong><small>Enter your Indian mobile number</small></div><span class="lock">LOCKED</span></div><div class="phone-preview"><span>+91</span><input type="tel" placeholder="10-digit mobile number" disabled></div><small class="locked-note">Available after Google account confirmation</small></article><article class="auth-card locked"><div class="card-heading"><span class="card-number">03</span><div><strong>Choose your role</strong><small>Select your JCLG workspace</small></div><span class="lock">LOCKED</span></div><select id="rolePreview" disabled><option>Admin</option><option>Principal</option><option>Faculty</option><option>Student</option><option>Parent</option></select><small class="locked-note">Available after Google and mobile confirmation</small></article></div>`;
    const googleButton = document.querySelector("#google");
    googleButton.onclick = async () => { if (!window.google?.accounts?.id) { showError("Google login library is still loading. Try again."); return; } const config = await request("/api/config"); if (!config) return; window.google.accounts.id.initialize({ client_id: config.google_client_id, ux_mode: "popup", callback: async ({ credential }) => { const result = await post("/api/auth/google/token", { credential }); if (result) window.location.href = result.next; }, error_callback: () => showError("Google rejected this Client ID. Ask the administrator for a valid Web application Client ID.") }); googleButton.replaceChildren(); window.google.accounts.id.renderButton(googleButton, { theme: "outline", size: "large", width: 380, text: "continue_with" }); };
}
function renderPhone() {
    setStep(2);
    app.innerHTML = `<div class="eyebrow">STEP 02 OF 03</div><h1>Confirm your mobile</h1><p class="lead">One quick check keeps your JCLG account protected.</p><div class="completed-step"><span>✓</span><div><strong>Google account connected</strong><small>Identity confirmed successfully</small></div></div><form id="phone"><label for="phoneNumber">Indian mobile number</label><div class="phone-input"><span>+91</span><input id="phoneNumber" name="phone" type="text" inputmode="numeric" autocomplete="tel" pattern="[6-9][0-9]{9}" minlength="10" maxlength="10" placeholder="9876586131" required></div><p class="field-hint">Enter exactly 10 digits. Numbers only. No spaces or symbols.</p><button class="primary">Send verification code <span>→</span></button></form>`;
    const phoneInput = document.querySelector("#phoneNumber");
    phoneInput.addEventListener("input", () => { phoneInput.value = phoneInput.value.replace(/[^0-9]/g, "").slice(0, 10); });
    document.querySelector("#phone").onsubmit = async (event) => { event.preventDefault(); const phone = phoneInput.value; if (!/^[6-9][0-9]{9}$/.test(phone)) { showError("Enter exactly 10 digits starting with 6, 7, 8, or 9."); phoneInput.focus(); return; } const result = await post("/api/auth/otp/request", { phone }); if (result) renderCode(); };
}
function renderCode() {
    setStep(2);
    app.innerHTML = `<div class="eyebrow">STEP 02 OF 03</div><h1>Enter your code</h1><p class="lead">Type the one-time code sent to your mobile number.</p><div class="completed-step"><span>✓</span><div><strong>Verification code sent</strong><small>Check your SMS messages</small></div></div><form id="code"><label for="verificationCode">6-digit verification code</label><input id="verificationCode" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,10}" placeholder="000000" required><button class="primary">Verify mobile <span>→</span></button></form><button class="link" id="change">Use a different number</button>`;
    document.querySelector("#code").onsubmit = async (event) => { event.preventDefault(); const result = await post("/api/auth/otp/verify", { code: new FormData(event.target).get("code") }); if (result) loadRoles(); };
    document.querySelector("#change").onclick = renderPhone;
}
async function loadRoles() {
    const result = await request("/api/auth/roles");
    if (!result) return;
    setStep(3);
    app.innerHTML = `<div class="eyebrow">STEP 03 OF 03</div><h1>Select your role</h1><p class="lead">Choose the workspace assigned to you. You will land there immediately.</p><div class="completed-step"><span>✓</span><div><strong>Mobile number verified</strong><small>Your secure login is ready</small></div></div><form id="roleForm"><label for="roleSelect">Select your JCLG role</label><select id="roleSelect" name="role_id" required><option value="">Choose a role</option>${result.roles.map((role) => `<option value="${role.role_id}">${role.role_name}</option>`).join("")}</select><p class="field-hint">Your available roles are managed by JCLG access policy.</p><button class="primary">Open my workspace <span>→</span></button></form>`;
    document.querySelector("#roleForm").onsubmit = async (event) => { event.preventDefault(); const selected = await post("/api/auth/role", { role_id: Number(new FormData(event.target).get("role_id") || document.querySelector("#roleSelect").value) }); if (selected) renderLanding(selected.role, selected.landing_path); };
}
async function loadRolePath(roleCode) {
    const result = await request("/api/auth/roles");
    const role = result?.roles.find((item) => item.role_code.toLowerCase() === roleCode);
    if (role) renderLanding(role, `/role/${roleCode}`); else renderLogin();
}
function renderLanding(role, path) {
    setStep(3);
    history.pushState({ role: role.role_code }, "", path);
    app.innerHTML = `<div class="success">✓</div><div class="eyebrow">LOGIN COMPLETE</div><h1>Welcome, ${role.role_name}</h1><p class="lead">Your secure session is active and your workspace is ready.</p><div class="landing"><span>YOUR WORKSPACE</span><strong>${role.role_name}</strong><small>${path}</small></div><button class="primary" id="logout">Sign out <span>→</span></button>`;
    document.querySelector("#logout").onclick = () => post("/api/auth/logout").then(() => renderLogin());
}
const initialStep = new URLSearchParams(location.search).get("step");
const rolePath = location.pathname.match(/^\/role\/([^/]+)\/?$/);
if (initialStep === "phone") renderPhone(); else if (rolePath) loadRolePath(rolePath[1].toLowerCase()); else renderLogin();