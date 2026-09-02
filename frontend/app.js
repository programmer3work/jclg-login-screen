const api = (
    window.JCLG_CONFIG?.apiBaseUrl ||
    "http://127.0.0.1:16000"
).replace(/\/$/, "");

const app = document.querySelector("#app");
const error = document.querySelector("#error");
const bar = document.querySelector("#bar");


/*
 * ============================================================
 * EC2 MODULE APPLICATIONS
 * ============================================================
 */

const MODULE_LINKS = {
    STUDENT_PROFILE: "http://16.112.236.67:15001",
    STUDENT_WELFARE: "http://16.112.236.67:15002",
    ACADEMICS: "http://16.112.236.67:15003",
    AI_ANALYSIS: "http://16.112.236.67:15004",
    CAREER_GUIDANCE: "http://16.112.236.67:15005",
    PROGRESS_ALERTS: "http://16.112.236.67:15006",
    REPORTS_COMMUNICATION: "http://16.112.236.67:15007"
};


/*
 * ============================================================
 * MODULE DESCRIPTIONS
 * ============================================================
 */

const MODULE_DESCRIPTIONS = {
    STUDENT_PROFILE:
        "Student profile, admission, parent information and Day Scholar overview.",

    STUDENT_WELFARE:
        "Attendance, leave, assignments, study support, welfare and AI alerts.",

    ACADEMICS:
        "MPC, BiPC, MEC, CEC, HEC, sections, subjects, faculty and timetable.",

    AI_ANALYSIS:
        "AI analysis of attendance, marks, results and student risk indicators.",

    CAREER_GUIDANCE:
        "Personalized programme and career recommendations using student data.",

    PROGRESS_ALERTS:
        "Progress trends, early-warning indicators and intervention tracking.",

    REPORTS_COMMUNICATION:
        "AI reports, notices, notifications, communication and audit information."
};


/*
 * ============================================================
 * COMMON FUNCTIONS
 * ============================================================
 */

function setStep(number) {

    if (bar) {
        bar.style.width =
            `${number * 33.333}%`;
    }
}


function showError(message = "") {

    if (error) {
        error.textContent = message;
    }
}


/*
 * ============================================================
 * API REQUEST
 * ============================================================
 *
 * credentials: "include" is required because
 * jclg_session is stored as an HttpOnly cookie.
 * ============================================================
 */

async function request(path, options = {}) {

    try {

        const response = await fetch(
            `${api}${path}`,
            {
                ...options,

                credentials: "include",

                headers: {
                    "Content-Type": "application/json",
                    ...(options.headers || {})
                }
            }
        );


        const data =
            await response
                .json()
                .catch(() => ({}));


        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Request could not be completed."
            );
        }


        showError("");

        return data;

    } catch (exception) {

        console.error(
            `${path}:`,
            exception
        );


        showError(
            exception.name === "TypeError"
                ? "The login service is unavailable. Please try again in a moment."
                : exception.message
        );


        return null;
    }
}


function post(path, body) {

    return request(
        path,
        {
            method: "POST",
            body: JSON.stringify(body)
        }
    );
}


/*
 * ============================================================
 * STEP 1 - LOGIN OPTIONS
 * ============================================================
 *
 * Google Login and Mobile OTP are completely independent.
 * ============================================================
 */

function renderLogin() {

    setStep(1);


    app.innerHTML = `

        <div class="eyebrow">
            WELCOME TO JCLG
        </div>


        <h1>
            Access your workspace
        </h1>


        <p class="lead">
            Choose how you want to sign in to JCLG.
        </p>


        <div class="auth-cards">


            <!-- =================================================
                 GOOGLE LOGIN
                 ================================================= -->

            <article class="auth-card active">

                <div class="card-heading">

                    <span class="card-number">
                        01
                    </span>


                    <div>

                        <strong>
                            Login with Google
                        </strong>


                        <small>
                            Use your approved Google account
                        </small>

                    </div>


                    <span class="card-status">
                        GOOGLE
                    </span>

                </div>


                <div
                    class="google"
                    id="google"
                >

                    <b>
                        G
                    </b>


                    <span>
                        Continue with Google
                    </span>


                    <strong>
                        ↗
                    </strong>

                </div>


                <p class="note">

                    <i></i>

                    Your password is handled securely by Google

                </p>

            </article>



            <!-- =================================================
                 MOBILE OTP LOGIN
                 ================================================= -->

            <article class="auth-card">

                <div class="card-heading">

                    <span class="card-number">
                        02
                    </span>


                    <div>

                        <strong>
                            Login with Mobile OTP
                        </strong>


                        <small>
                            Use your registered Indian mobile number
                        </small>

                    </div>


                    <span class="card-status">
                        OTP
                    </span>

                </div>


                <div class="phone-preview">

                    <span>
                        +91
                    </span>


                    <input
                        type="tel"
                        placeholder="10-digit mobile number"
                        disabled
                    >

                </div>


                <button
                    class="primary"
                    id="mobileLogin"
                    type="button"
                >

                    Login with Mobile OTP

                    <span>
                        →
                    </span>

                </button>


                <p class="note">

                    <i></i>

                    A verification code will be sent to your registered mobile

                </p>

            </article>



            <!-- =================================================
                 ROLE PREVIEW
                 ================================================= -->

            <article class="auth-card locked">

                <div class="card-heading">

                    <span class="card-number">
                        03
                    </span>


                    <div>

                        <strong>
                            Choose your role
                        </strong>


                        <small>
                            Select your JCLG workspace
                        </small>

                    </div>


                    <span class="lock">
                        LOCKED
                    </span>

                </div>


                <select
                    id="rolePreview"
                    disabled
                >

                    <option>
                        Admin
                    </option>

                    <option>
                        Principal
                    </option>

                    <option>
                        Faculty
                    </option>

                    <option>
                        Student
                    </option>

                    <option>
                        Parent
                    </option>

                </select>


                <small class="locked-note">

                    Available after authentication

                </small>

            </article>

        </div>
    `;


    /*
     * ========================================================
     * GOOGLE LOGIN
     * ========================================================
     */

    const googleButton =
        document.querySelector(
            "#google"
        );


    googleButton.onclick =
        async () => {

            if (
                !window.google?.accounts?.id
            ) {

                showError(
                    "Google login library is still loading. Try again."
                );

                return;
            }


            const config =
                await request(
                    "/api/config"
                );


            if (!config) {
                return;
            }


            window.google.accounts.id.initialize({

                client_id:
                    config.google_client_id,

                ux_mode:
                    "popup",


                callback:
                    async ({
                        credential
                    }) => {

                        const result =
                            await post(
                                "/api/auth/google/token",
                                {
                                    credential
                                }
                            );


                        if (result) {

                            /*
                             * Google login is independent
                             * of Mobile OTP.
                             *
                             * Backend MUST return:
                             *
                             * /?step=role
                             */

                            window.location.href =
                                result.next;
                        }
                    },


                error_callback:
                    () => {

                        showError(
                            "Google rejected this Client ID. Ask the administrator for a valid Web application Client ID."
                        );

                    }

            });


            googleButton.replaceChildren();


            window.google.accounts.id.renderButton(
                googleButton,
                {
                    theme: "outline",
                    size: "large",
                    width: 380,
                    text: "continue_with"
                }
            );
        };


    /*
     * ========================================================
     * MOBILE OTP LOGIN
     * ========================================================
     */

    const mobileLoginButton =
        document.querySelector(
            "#mobileLogin"
        );


    mobileLoginButton.onclick =
        () => {

            renderPhone();

        };
}


/*
 * ============================================================
 * STEP 2 - MOBILE NUMBER
 * ============================================================
 */

function renderPhone() {

    setStep(2);


    app.innerHTML = `

        <div class="eyebrow">
            STEP 02 OF 03
        </div>


        <h1>
            Login with Mobile OTP
        </h1>


        <p class="lead">
            Enter your registered Indian mobile number to receive a verification code.
        </p>


        <div class="completed-step">

            <span>
                ✓
            </span>


            <div>

                <strong>
                    Mobile OTP Login
                </strong>


                <small>
                    Your mobile number will be verified securely
                </small>

            </div>

        </div>


        <form id="phone">

            <label for="phoneNumber">
                Indian mobile number
            </label>


            <div class="phone-input">

                <span>
                    +91
                </span>


                <input
                    id="phoneNumber"
                    name="phone"
                    type="text"
                    inputmode="numeric"
                    autocomplete="tel"
                    pattern="[6-9][0-9]{9}"
                    minlength="10"
                    maxlength="10"
                    placeholder="9876586131"
                    required
                >

            </div>


            <p class="field-hint">

                Enter exactly 10 digits.
                Numbers only.
                No spaces or symbols.

            </p>


            <button
                class="primary"
                type="submit"
            >

                Send verification code

                <span>
                    →
                </span>

            </button>

        </form>


        <button
            class="link"
            id="backToLogin"
            type="button"
        >

            ← Back to login options

        </button>

    `;


    const phoneInput =
        document.querySelector(
            "#phoneNumber"
        );


    phoneInput.addEventListener(
        "input",
        () => {

            phoneInput.value =
                phoneInput.value
                    .replace(
                        /[^0-9]/g,
                        ""
                    )
                    .slice(
                        0,
                        10
                    );

        }
    );


    /*
     * Back to login options
     */

    document.querySelector(
        "#backToLogin"
    ).onclick =
        renderLogin;


    /*
     * ========================================================
     * REQUEST OTP
     * ========================================================
     */

    document.querySelector(
        "#phone"
    ).onsubmit =
        async (event) => {

            event.preventDefault();


            const phone =
                phoneInput.value;


            if (
                !/^[6-9][0-9]{9}$/.test(
                    phone
                )
            ) {

                showError(
                    "Enter exactly 10 digits starting with 6, 7, 8, or 9."
                );


                phoneInput.focus();


                return;
            }


            /*
             * IMPORTANT:
             *
             * This request creates an
             * independent OTP session.
             */

            const result =
                await post(
                    "/api/auth/otp/request",
                    {
                        phone
                    }
                );


            if (result) {

                renderCode();

            }
        };
}


/*
 * ============================================================
 * STEP 2 - OTP VERIFICATION
 * ============================================================
 */

function renderCode() {

    setStep(2);


    app.innerHTML = `

        <div class="eyebrow">
            STEP 02 OF 03
        </div>


        <h1>
            Enter your code
        </h1>


        <p class="lead">
            Type the one-time code sent to your mobile number.
        </p>


        <div class="completed-step">

            <span>
                ✓
            </span>


            <div>

                <strong>
                    Verification code sent
                </strong>


                <small>
                    Check your SMS messages
                </small>

            </div>

        </div>


        <form id="code">

            <label for="verificationCode">
                6-digit verification code
            </label>


            <input
                id="verificationCode"
                name="code"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9]{4,10}"
                maxlength="10"
                placeholder="000000"
                required
            >


            <button
                class="primary"
                type="submit"
            >

                Verify mobile

                <span>
                    →
                </span>

            </button>

        </form>


        <button
            class="link"
            id="change"
            type="button"
        >

            Use a different number

        </button>

    `;


    const codeInput =
        document.querySelector(
            "#verificationCode"
        );


    codeInput.addEventListener(
        "input",
        () => {

            codeInput.value =
                codeInput.value
                    .replace(
                        /[^0-9]/g,
                        ""
                    )
                    .slice(
                        0,
                        10
                    );

        }
    );


    /*
     * ========================================================
     * VERIFY OTP
     * ========================================================
     */

    document.querySelector(
        "#code"
    ).onsubmit =
        async (event) => {

            event.preventDefault();


            const code =
                new FormData(
                    event.target
                ).get("code");


            const result =
                await post(
                    "/api/auth/otp/verify",
                    {
                        code
                    }
                );


            if (result) {

                loadRoles();

            }
        };


    /*
     * Change mobile number
     */

    document.querySelector(
        "#change"
    ).onclick =
        renderPhone;
}


/*
 * ============================================================
 * STEP 3 - LOAD ROLES
 * ============================================================
 */

async function loadRoles() {

    const result =
        await request(
            "/api/auth/roles"
        );


    if (!result) {
        return;
    }


    setStep(3);


    app.innerHTML = `

        <div class="eyebrow">
            STEP 03 OF 03
        </div>


        <h1>
            Select your role
        </h1>


        <p class="lead">
            Choose the workspace assigned to you.
        </p>


        <div class="completed-step">

            <span>
                ✓
            </span>


            <div>

                <strong>
                    Authentication successful
                </strong>


                <small>
                    Your secure JCLG login is ready
                </small>

            </div>

        </div>


        <form id="roleForm">

            <label for="roleSelect">
                Select your JCLG role
            </label>


            <select
                id="roleSelect"
                name="role_id"
                required
            >

                <option value="">
                    Choose a role
                </option>


                ${result.roles
                    .map(
                        (role) => `
                            <option
                                value="${role.role_id}"
                            >
                                ${role.role_name}
                            </option>
                        `
                    )
                    .join("")}

            </select>


            <p class="field-hint">

                Your available roles are managed by JCLG access policy.

            </p>


            <button
                class="primary"
                type="submit"
            >

                Continue to modules

                <span>
                    →
                </span>

            </button>

        </form>

    `;


    /*
     * ========================================================
     * ROLE SELECTION
     * ========================================================
     */

    document.querySelector(
        "#roleForm"
    ).onsubmit =
        async (event) => {

            event.preventDefault();


            const roleId =
                Number(
                    new FormData(
                        event.target
                    ).get(
                        "role_id"
                    )
                );


            if (!roleId) {

                showError(
                    "Please select a role."
                );

                return;
            }


            const selected =
                await post(
                    "/api/auth/role",
                    {
                        role_id: roleId
                    }
                );


            if (!selected) {
                return;
            }


            await loadModules(
                selected.role,
                selected.landing_path
            );
        };
}


/*
 * ============================================================
 * LOAD MODULES
 * ============================================================
 */

async function loadModules(
    role,
    path
) {

    const result =
        await request(
            "/api/auth/modules"
        );


    if (!result) {
        return;
    }


    const modules =
        result.modules || [];


    renderModuleSelection(
        role,
        path,
        modules
    );
}


/*
 * ============================================================
 * MODULE SELECTION
 * ============================================================
 */

function renderModuleSelection(
    role,
    path,
    modules
) {

    setStep(3);


    history.pushState(
        {
            role:
                role.role_code
        },
        "",
        path
    );


    const moduleCards =
        modules
            .map(
                (module) => {

                    const moduleCode =
                        module.module_code;


                    const moduleLink =
                        MODULE_LINKS[
                            moduleCode
                        ];


                    const description =
                        MODULE_DESCRIPTIONS[
                            moduleCode
                        ] ||
                        "Open this JCLG functional module.";


                    if (!moduleLink) {
                        return "";
                    }


                    return `

                        <article class="module-card">

                            <div class="module-card-content">

                                <div class="module-code">
                                    ${moduleCode}
                                </div>


                                <h3>
                                    ${module.module_name}
                                </h3>


                                <p>
                                    ${description}
                                </p>

                            </div>


                            <button
                                class="primary module-button"
                                data-module-code="${moduleCode}"
                                type="button"
                            >

                                Open Module

                                <span>
                                    →
                                </span>

                            </button>

                        </article>

                    `;
                }
            )
            .join("");


    app.innerHTML = `

        <div class="success">
            ✓
        </div>


        <div class="eyebrow">
            LOGIN COMPLETE
        </div>


        <h1>
            Welcome, ${role.role_name}
        </h1>


        <p class="lead">
            Select one of the modules available to your role.
        </p>


        <div class="landing">

            <span>
                YOUR ROLE
            </span>


            <strong>
                ${role.role_name}
            </strong>


            <small>
                ${modules.length} modules available
            </small>

        </div>


        <div class="modules-grid">

            ${
                moduleCards ||
                `
                    <div class="module-empty">

                        <h3>
                            No modules available
                        </h3>

                        <p>
                            No active modules are assigned to this role.
                        </p>

                    </div>
                `
            }

        </div>


        <button
            class="primary"
            id="logout"
            type="button"
        >

            Sign out

            <span>
                →
            </span>

        </button>

    `;


    /*
     * ========================================================
     * MODULE BUTTONS
     * ========================================================
     */

    document
        .querySelectorAll(
            ".module-button"
        )
        .forEach(
            (button) => {

                button.addEventListener(
                    "click",
                    () => {

                        const moduleCode =
                            button.dataset.moduleCode;


                        openModule(
                            moduleCode
                        );

                    }
                );

            }
        );


    /*
     * ========================================================
     * LOGOUT
     * ========================================================
     */

    document.querySelector(
        "#logout"
    ).onclick =
        async () => {

            await post(
                "/api/auth/logout"
            );


            history.pushState(
                {},
                "",
                "/"
            );


            renderLogin();
        };
}


/*
 * ============================================================
 * OPEN MODULE
 * ============================================================
 */

function openModule(
    moduleCode
) {

    const moduleUrl =
        MODULE_LINKS[
            moduleCode
        ];


    if (!moduleUrl) {

        showError(
            `No EC2 link configured for ${moduleCode}.`
        );

        return;
    }


    console.log(
        `Opening JCLG module ${moduleCode}: ${moduleUrl}`
    );


    window.open(
        moduleUrl,
        "_blank",
        "noopener,noreferrer"
    );
}


/*
 * ============================================================
 * HANDLE /role/admin
 * ============================================================
 */

async function loadRolePath(
    roleCode
) {

    const result =
        await request(
            "/api/auth/roles"
        );


    if (!result) {
        return;
    }


    const role =
        result.roles.find(
            (item) =>
                item.role_code
                    .toLowerCase() ===
                roleCode
        );


    if (!role) {

        renderLogin();

        return;
    }


    const modules =
        await request(
            "/api/auth/modules"
        );


    if (!modules) {
        return;
    }


    renderModuleSelection(
        role,
        `/role/${roleCode}`,
        modules.modules || []
    );
}


/*
 * ============================================================
 * BROWSER BACK / FORWARD
 * ============================================================
 */

window.addEventListener(
    "popstate",
    () => {

        const rolePath =
            location.pathname.match(
                /^\/role\/([^/]+)\/?$/
            );


        if (rolePath) {

            loadRolePath(
                rolePath[1].toLowerCase()
            );

            return;
        }


        const currentStep =
            new URLSearchParams(
                location.search
            ).get("step");


        /*
         * IMPORTANT:
         *
         * Handle ?step=role.
         */

        if (
            currentStep === "phone"
        ) {

            renderPhone();

        } else if (
            currentStep === "role"
        ) {

            loadRoles();

        } else {

            renderLogin();

        }
    }
);


/*
 * ============================================================
 * INITIAL PAGE
 * ============================================================
 */

const initialStep =
    new URLSearchParams(
        location.search
    ).get("step");


const rolePath =
    location.pathname.match(
        /^\/role\/([^/]+)\/?$/
    );


/*
 * ============================================================
 * INITIAL ROUTING
 * ============================================================
 */

if (
    initialStep === "phone"
) {

    /*
     * Mobile OTP flow
     */
    renderPhone();


} else if (
    initialStep === "role"
) {

    /*
     * Google flow arrives here.
     *
     * Google does NOT go to OTP.
     */
    loadRoles();


} else if (
    rolePath
) {

    loadRolePath(
        rolePath[1].toLowerCase()
    );


} else {

    /*
     * Normal login page
     */
    renderLogin();
}