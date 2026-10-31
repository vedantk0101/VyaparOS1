// ============================================================
// VYAPAROS FRONTEND
// Firebase authentication + persistent AI chat history.
// Fullscreen AI Chatbox + persistent conversation deletion.
// Autonomous Multi-Day Agent Operations, 0.5s Voice Mic & Dashboard Reader.
// ============================================================

import {
  registerUser,
  loginUser,
  logoutUser,
  resetPassword,
  watchAuthState
} from "./auth.js";

import { db } from "./firebase.js";

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

// ---------------- BASIC SETUP ----------------

const $ = selector => document.querySelector(selector);

const authScreen = $("#authScreen");
const appScreen = $("#appScreen");

let authMode = "login";
let authReady = false;
let currentUser = null;

const chatMessages = [];
let chatRequestId = 0;
let pendingPortal = null;

let activeConversationId = null;
let conversations = [];
let chatHistoryLoadedForUid = null;
let chatHistoryLoading = false;

const S = {
  f: {},
  dec: {},
  mdec: {},
  cat: "Business",
  cur: "overview"
};

// ---------------- FULLSCREEN CHAT STYLES ----------------

function installChatStyles() {
  if ($("#vosFullscreenChatStyles")) return;

  const style = document.createElement("style");
  style.id = "vosFullscreenChatStyles";

  style.textContent = `
    body.vos-chat-fullscreen {
      overflow: hidden !important;
    }

    body.vos-chat-fullscreen #side,
    body.vos-chat-fullscreen #scrim {
      display: none !important;
    }

    body.vos-chat-fullscreen #appScreen {
      overflow: visible !important;
    }

    body.vos-chat-fullscreen #pg {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: none !important;
    }

    .vos-chat-page.vos-chat-fullscreen {
      position: fixed !important;
      inset: 0 !important;
      z-index: 99999 !important;
      width: 100vw !important;
      height: 100vh !important;
      height: 100dvh !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      display: grid !important;
      grid-template-columns: 275px minmax(0, 1fr) !important;
      background: #ffffff !important;
      color: #24213a !important;
      overflow: hidden !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-sizing: border-box !important;
    }

    .vos-chat-history-rail {
      min-width: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #f8f7fb;
      border-right: 1px solid #e9e6f0;
      overflow: hidden;
    }

    .vos-chat-history-top {
      padding: 22px 17px 16px;
      border-bottom: 1px solid #e9e6f0;
    }

    .vos-chat-history-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 17px;
      font-weight: 750;
      color: #29243d;
      margin-bottom: 20px;
    }

    .vos-chat-history-brand-mark {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: #eeeaff;
      color: #765ed6;
      font-size: 21px;
    }

    .vos-chat-history-new {
      width: 100%;
      border: 1px solid #ded8f0;
      background: #ffffff;
      color: #5947a8;
      border-radius: 10px;
      padding: 11px 12px;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      font-weight: 650;
      text-align: left;
      transition: background .2s, border-color .2s;
    }

    .vos-chat-history-new:hover {
      background: #f0edff;
      border-color: #c8bdf1;
    }

    .vos-chat-history-label {
      padding: 18px 17px 9px;
      color: #817b91;
      font-size: 11px;
      font-weight: 750;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .vos-chat-history-list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 3px 9px 16px;
    }

    .vos-chat-history-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
      border-radius: 9px;
      transition: background .15s;
    }

    .vos-chat-history-row:hover {
      background: #efedf5;
    }

    .vos-chat-history-row.active {
      background: #ebe7fa;
    }

    .vos-chat-history-open {
      flex: 1;
      min-width: 0;
      border: 0;
      background: transparent;
      color: #454052;
      padding: 11px 9px;
      text-align: left;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .vos-chat-history-row.active .vos-chat-history-open {
      color: #5743a4;
      font-weight: 700;
    }

    .vos-chat-history-delete {
      flex: 0 0 30px;
      width: 30px;
      height: 30px;
      margin-right: 5px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #9690a0;
      cursor: pointer;
      font-size: 15px;
      opacity: .65;
    }

    .vos-chat-history-delete:hover {
      background: #feecec;
      color: #c03939;
      opacity: 1;
    }

    .vos-chat-history-empty {
      padding: 12px 9px;
      color: #928c9d;
      font-size: 12px;
      line-height: 1.6;
    }

    .vos-chat-main {
      min-width: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      overflow: hidden;
    }

    .vos-chat-header {
      flex: 0 0 auto;
      min-height: 76px;
      padding: 13px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      border-bottom: 1px solid #eeeaf3;
      background: rgba(255,255,255,.96);
    }

    .vos-chat-heading {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .vos-chat-mark {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      display: grid;
      place-items: center;
      border-radius: 13px;
      background: #eeeaff;
      color: #765ed6;
      font-size: 25px;
    }

    .vos-chat-heading h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 750;
      color: #29243d;
    }

    .vos-chat-heading p {
      margin: 3px 0 0;
      color: #8b8498;
      font-size: 12px;
    }

    .vos-chat-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .vos-chat-exit {
      border: 1px solid #e5e1ed;
      background: #ffffff;
      color: #5b5569;
      border-radius: 9px;
      padding: 9px 12px;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
    }

    .vos-chat-exit:hover {
      background: #f7f5fb;
    }

    .vos-chat-scroll {
      flex: 1;
      min-height: 0;
      width: 100%;
      overflow-y: auto;
      padding: 28px 22px 35px;
      scroll-behavior: smooth;
    }

    .vos-chat-content {
      width: 100%;
      max-width: 850px;
      margin: 0 auto;
    }

    .vos-chat-welcome {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 35px 15px;
    }

    .vos-chat-welcome-icon {
      width: 66px;
      height: 66px;
      display: grid;
      place-items: center;
      border-radius: 22px;
      background: #f0edff;
      color: #755bd6;
      font-size: 38px;
      margin-bottom: 20px;
    }

    .vos-chat-welcome h2 {
      color: #29243d;
      font-size: 25px;
      margin: 0 0 10px;
      font-weight: 750;
    }

    .vos-chat-welcome > p {
      max-width: 500px;
      color: #858092;
      line-height: 1.7;
      font-size: 14px;
      margin: 0;
    }

    .vos-chat-suggestions {
      width: 100%;
      max-width: 650px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 30px;
    }

    .vos-chat-suggestions button {
      min-height: 55px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border: 1px solid #e9e5f0;
      border-radius: 12px;
      background: #ffffff;
      color: #514b61;
      text-align: left;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
      transition: .2s;
    }

    .vos-chat-suggestions button:hover {
      border-color: #c9bdf0;
      background: #faf9ff;
      transform: translateY(-1px);
    }

    .vos-chat-suggestions button span {
      color: #7962d5;
      font-size: 17px;
    }

    .vos-chat-message {
      display: flex;
      align-items: flex-start;
      gap: 13px;
      margin: 0 auto 27px;
      max-width: 850px;
    }

    .vos-chat-avatar {
      flex: 0 0 34px;
      width: 34px;
      height: 34px;
      display: grid;
      place-items: center;
      border-radius: 11px;
      background: #eeeaff;
      color: #7058cf;
      font-size: 15px;
      font-weight: 750;
    }

    .vos-chat-message.user .vos-chat-avatar {
      background: #eaf0fa;
      color: #3c5e91;
    }

    .vos-chat-message-body {
      min-width: 0;
      flex: 1;
      padding-top: 2px;
    }

    .vos-chat-message-body strong {
      display: block;
      color: #393448;
      font-size: 12px;
      margin-bottom: 7px;
    }

    .vos-chat-message-body p {
      color: #4d4859;
      font-size: 14px;
      line-height: 1.8;
      margin: 0;
      overflow-wrap: anywhere;
    }

    .vos-chat-message.assistant .vos-chat-message-body p {
      white-space: normal;
    }

    .vos-chat-footer {
      flex: 0 0 auto;
      padding: 13px 22px 15px;
      background: #ffffff;
    }

    .vos-chat-composer {
      width: 100%;
      max-width: 850px;
      min-height: 58px;
      margin: 0 auto;
      padding: 8px 9px 8px 17px;
      display: flex;
      align-items: flex-end;
      gap: 10px;
      border: 1px solid #e3dfeb;
      border-radius: 17px;
      background: #ffffff;
      box-shadow: 0 3px 15px rgba(42,32,75,.045);
    }

    .vos-chat-composer:focus-within {
      border-color: #b9a9ed;
      box-shadow: 0 0 0 3px rgba(118,94,214,.08);
    }

    .vos-mic-btn {
      flex: 0 0 40px;
      width: 40px;
      height: 40px;
      border: 1px solid #e3dfeb;
      border-radius: 12px;
      background: #f8f7fb;
      color: #5947a8;
      font-size: 18px;
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background .2s, border-color .2s;
    }

    .vos-mic-btn:hover {
      background: #f0edff;
      border-color: #b9a9ed;
    }

    .vos-chat-composer textarea {
      flex: 1;
      min-width: 0;
      min-height: 39px;
      max-height: 150px;
      resize: vertical;
      border: 0 !important;
      outline: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      color: #302b3d;
      padding: 10px 0 !important;
      font: inherit;
      font-size: 14px;
    }

    .vos-chat-composer button[type="submit"] {
      flex: 0 0 40px;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 12px;
      background: #765ed6;
      color: #ffffff;
      font-size: 23px;
      cursor: pointer;
      transition: background .2s;
    }

    .vos-chat-composer button[type="submit"]:hover {
      background: #6048c0;
    }

    .vos-chat-disclaimer {
      max-width: 850px;
      margin: 9px auto 0;
      color: #a09aaa;
      text-align: center;
      font-size: 10px;
    }

    @media(max-width:700px) {
      .vos-chat-page.vos-chat-fullscreen {
        grid-template-columns: 205px minmax(0, 1fr) !important;
      }

      .vos-chat-history-top {
        padding: 15px 10px 12px;
      }

      .vos-chat-history-label {
        padding-left: 11px;
      }

      .vos-chat-history-list {
        padding-left: 5px;
        padding-right: 5px;
      }

      .vos-chat-header {
        padding: 11px 13px;
      }

      .vos-chat-scroll {
        padding: 20px 13px;
      }

      .vos-chat-footer {
        padding: 10px 12px;
      }

      .vos-chat-exit {
        padding: 8px;
        font-size: 11px;
      }
    }

    @media(max-width:480px) {
      .vos-chat-page.vos-chat-fullscreen {
        grid-template-columns: 145px minmax(0, 1fr) !important;
      }

      .vos-chat-history-brand {
        font-size: 13px;
        gap: 6px;
      }

      .vos-chat-history-brand-mark {
        width: 27px;
        height: 27px;
      }

      .vos-chat-history-new {
        padding: 9px 7px;
        font-size: 11px;
      }

      .vos-chat-history-open {
        font-size: 10px;
        padding: 9px 5px;
      }

      .vos-chat-history-delete {
        flex-basis: 24px;
        width: 24px;
        margin-right: 2px;
      }

      .vos-chat-heading {
        gap: 7px;
      }

      .vos-chat-mark {
        width: 32px;
        height: 32px;
        flex-basis: 32px;
        font-size: 20px;
      }

      .vos-chat-heading h1 {
        font-size: 13px;
      }

      .vos-chat-heading p {
        font-size: 10px;
      }

      .vos-chat-exit {
        font-size: 10px;
        padding: 7px 6px;
      }

      .vos-chat-suggestions {
        grid-template-columns: 1fr;
      }

      .vos-chat-welcome h2 {
        font-size: 19px;
      }

      .vos-chat-welcome > p {
        font-size: 12px;
      }

      .vos-chat-message {
        gap: 8px;
      }

      .vos-chat-avatar {
        width: 29px;
        height: 29px;
        flex-basis: 29px;
      }

      .vos-chat-message-body p {
        font-size: 13px;
      }
    }
  `;

  document.head.appendChild(style);
}

installChatStyles();

// ---------------- SAFE TEXT ----------------

function escapeChatText(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeHTML(value) {
  return escapeChatText(value);
}

// ---------------- AUTHENTICATION ----------------

function setAuthMode(mode) {
  authMode = mode;

  const register = mode === "register";

  $("#loginTab").classList.toggle("active", !register);
  $("#registerTab").classList.toggle("active", register);

  $("#authTitle").textContent = register
    ? "Create your account"
    : "Welcome back";

  $("#authSubtitle").textContent = register
    ? "Set up your business workspace in a few steps."
    : "Sign in to continue to your business workspace.";

  $("#nameField").hidden = !register;
  $("#confirmField").hidden = !register;

  $("#fullName").required = register;
  $("#confirmPassword").required = register;

  $("#password").autocomplete = register
    ? "new-password"
    : "current-password";

  $("#submitLabel").textContent = register
    ? "Create workspace"
    : "Sign in to VyaparOS";

  $("#forgotBtn").hidden = register;
  $("#formError").textContent = "";
}

$("#loginTab").addEventListener("click", () => {
  setAuthMode("login");
});

$("#registerTab").addEventListener("click", () => {
  setAuthMode("register");
});

$("#showPassword").addEventListener("click", () => {
  const input = $("#password");

  input.type = input.type === "password"
    ? "text"
    : "password";

  $("#showPassword").textContent =
    input.type === "password" ? "Show" : "Hide";
});

document.querySelectorAll("[data-static-link]").forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
  });
});

// ---------------- AUTH ERRORS ----------------

function getAuthError(error) {
  const messages = {
    "auth/email-already-in-use":
      "This email is already registered. Please log in.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/weak-password":
      "Your password must be at least 6 characters.",

    "auth/user-not-found":
      "No account found. Please register first.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/invalid-credential":
      "Invalid email or password.",

    "auth/network-request-failed":
      "Network error. Check your internet connection.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later.",

    "auth/operation-not-allowed":
      "Email/password sign-in is not enabled in Firebase."
  };

  return messages[error.code] ||
    error.message ||
    "Something went wrong.";
}

// ---------------- PASSWORD RESET ----------------

$("#forgotBtn").addEventListener("click", async () => {
  const email = $("#email").value.trim();
  const error = $("#formError");

  error.textContent = "";

  if (!email) {
    error.textContent = "Enter your email address first.";
    return;
  }

  try {
    await resetPassword(email);

    error.textContent =
      "Password reset email sent. Check your inbox.";

  } catch (err) {
    console.error("Password reset error:", err);
    error.textContent = getAuthError(err);
  }
});

// ---------------- LOGIN / REGISTER ----------------

$("#authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("#email").value.trim();
  const password = $("#password").value;
  const fullName = $("#fullName").value.trim();

  const business =
    $("#businessName").value.trim() || "My Business";

  const error = $("#formError");

  const submitButton = $("#authForm button[type='submit']");

  error.textContent = "";

  if (!email || password.length < 6) {
    error.textContent =
      "Enter a valid email and password with at least 6 characters.";
    return;
  }

  if (authMode === "register") {
    if (!fullName) {
      error.textContent = "Please enter your full name.";
      return;
    }

    if ($("#confirmPassword").value !== password) {
      error.textContent = "Your passwords do not match.";
      return;
    }
  }

  submitButton.disabled = true;
  $("#submitLabel").textContent = "Please wait...";

  try {
    sessionStorage.setItem("vyaparos_business", business);

    if (authMode === "register") {
      sessionStorage.setItem("vyaparos_name", fullName);
      await registerUser(email, password, fullName);
    } else {
      await loginUser(email, password);
    }

  } catch (err) {
    console.error("Firebase authentication error:", err);
    error.textContent = getAuthError(err);

  } finally {
    submitButton.disabled = false;

    $("#submitLabel").textContent =
      authMode === "register"
        ? "Create workspace"
        : "Sign in to VyaparOS";
  }
});

// ---------------- APPLICATION ----------------

function openApp() {
  authScreen.hidden = true;
  appScreen.hidden = false;

  $("#workspaceName").textContent =
    sessionStorage.getItem("vyaparos_business") ||
    "My Business";

  updateAvatarDisplay();
  route();
}

function updateAvatarDisplay() {
  const name = sessionStorage.getItem("vyaparos_name") || "Owner";
  const photo = sessionStorage.getItem("vyaparos_photo");
  const avtEl = $("#avt");

  if (!avtEl) return;

  if (photo) {
    avtEl.innerHTML = `<img src="${photo}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  } else {
    avtEl.textContent = name
      .split(/\s+/)
      .map(part => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
}

async function logout() {
  try {
    await logoutUser();

    sessionStorage.removeItem("vyaparos_business");
    sessionStorage.removeItem("vyaparos_email");
    sessionStorage.removeItem("vyaparos_name");
    sessionStorage.removeItem("vyaparos_photo");

    $("#authForm").reset();
    setAuthMode("login");

  } catch (err) {
    console.error("Logout error:", err);
    toast("Unable to log out. Please try again.");
  }
}

setAuthMode("login");

// ---------------- NAVIGATION DATA ----------------

const NAV = [
  ["overview", "Overview", "▦"],
  ["employee", "AI Employee", "◉"],
  ["chatbox", "AI Chatbox", "✧"],
  ["tasks", "Tasks & Workflows", "☰"],
  ["invoices", "Invoices & Documents", "❏"],
  ["recon", "Financial Reconciliation", "⇄"],
  ["gst", "GST Management", "₹"],
  ["customers", "Customers & Suppliers", "☺"],
  ["voice", "Voice Communications", "✆"],
  ["memory", "Business Memory", "◈"],
  ["approvals", "Approvals", "✓"],
  ["logs", "Activity & Audit Logs", "≡"],
  ["settings", "Settings", "⚙"]
];

// ---------------- SAMPLE BUSINESS DATA ----------------

const D = {
  tasks: [
    {
      id: 1,
      t: "October month-end close",
      d: "Pull invoices from WhatsApp & email, reconcile bank, file GST GSTR-3B, call overdue customers",
      c: "28 Oct",
      s: "Running",
      p: "High",
      pr: 85,
      u: "Just now",
      st: [
        "Collect invoices from WhatsApp & email (API sync active)",
        "Extract invoice fields via OCR & validate GSTIN",
        "Reconcile transactions with bank statement CSV",
        "Automated login & draft filing on GST portal via Computer Use",
        "Vernacular voice calls placed to overdue customers (Rahul Sharma in Hindi)",
        "Owner final review & sign-off"
      ],
      ok: 5
    },
    {
      id: 2,
      t: "Overdue payment follow-ups",
      d: "Automated outbound reminder calls in Hindi/Marathi",
      c: "29 Oct",
      s: "Pending Approval",
      p: "High",
      pr: 60,
      u: "1 hr ago",
      st: [
        "Identify overdue customers (>15 days)",
        "Draft vernacular call script",
        "Owner approves voice agent call",
        "Place automated calls via telephony API",
        "Update CRM follow-up records"
      ],
      ok: 3
    },
    {
      id: 3,
      t: "Supplier invoice intake",
      d: "Download new purchase invoices",
      c: "27 Oct",
      s: "Completed",
      p: "Medium",
      pr: 100,
      u: "Yesterday",
      st: [
        "Open supplier portal via browser automation",
        "Download PDFs & parse metadata",
        "Store in document vault"
      ],
      ok: 3
    },
    {
      id: 4,
      t: "GST portal session check",
      d: "Verify session & fetch GSTR-2B",
      c: "26 Oct",
      s: "Failed",
      p: "Medium",
      pr: 50,
      u: "2 days ago",
      st: [
        "Open portal via computer use",
        "Authenticate (needs owner OTP)",
        "Fetch GSTR-2B data"
      ],
      ok: 1,
      fail: 1
    }
  ],

  inv: [
    ["INV-2041", "Sharma Hardware, Pune", "Sales", "12 Oct 2026", "27AAACS1234F1Z5", 84746, 15254, "Verified"],
    ["PUR-7710", "Gupta Steel Works, Nashik", "Purchase", "14 Oct 2026", "27AABCG5678K1ZQ", 212000, 38160, "Verified"],
    ["INV-2044", "Patil Agro, Kolhapur", "Sales", "18 Oct 2026", "27AAFPP9012L1Z2", 45000, 8100, "Unverified"],
    ["PUR-7722", "Mehta Packaging, Mumbai", "Purchase", "20 Oct 2026", "27AAHCM3456P1Z8", 67800, 12204, "Unverified"],
    ["INV-2044", "Patil Agro, Kolhapur", "Sales", "18 Oct 2026", "27AAFPP9012L1Z2", 45000, 8100, "Duplicate"]
  ],

  rec: [
    ["02 Oct", "NEFT Sharma Hardware", "UTR4410021", "₹1,00,000", "INV-2041", "₹1,00,000", "Matched"],
    ["05 Oct", "RTGS Gupta Steel", "UTR4410877", "₹2,50,160", "PUR-7710", "₹2,50,160", "Matched"],
    ["09 Oct", "UPI Patil Agro", "UPI9981230", "₹50,000", "INV-2044", "₹53,100", "Mismatch"],
    ["13 Oct", "IMPS Mehta Pkg", "IMP0021457", "₹79,904", "PUR-7722 (suggested)", "₹79,904", "Uncertain"],
    ["16 Oct", "Cash deposit", "CD-00871", "₹12,000", "—", "—", "Unmatched"]
  ],

  cus: [
    ["Rahul Sharma", "+91 98200 11234", "rahul@sharmahw.example", 42, 18000, "12 Oct", "Overdue"],
    ["Anita Patil", "+91 98900 55671", "anita@patilagro.example", 27, 53100, "18 Oct", "Pending"],
    ["Vikram Gupta", "+91 97300 44120", "vikram@guptasteel.example", 15, 0, "05 Oct", "Paid"],
    ["Sunita Mehta", "+91 99870 22345", "sunita@mehtapack.example", 9, 31500, "01 Oct", "Overdue"]
  ],

  app: [
    {
      t: "GST return submission (GSTR-3B, Oct 2026)",
      d: "Submit prepared return on the GST portal via computer use",
      r: "Month-end close reached final filing step",
      f: "Tax payable ₹58,420",
      e: "Reconciliation 91%; 2 open discrepancies resolved",
      w: "October month-end close",
      dt: "30 Oct 2026"
    },
    {
      t: "Vernacular call: Rahul Sharma (Hindi)",
      d: "Outbound AI voice reminder for ₹18,000 overdue",
      r: "Invoice INV-2041 overdue 19 days",
      f: "₹18,000 receivable secured",
      e: "Voice transcript & payment commitment logged",
      w: "Overdue payment follow-ups",
      dt: "30 Oct 2026"
    },
    {
      t: "Bank payment: Gupta Steel ₹2,12,000",
      d: "Initiate supplier payment via net banking portal",
      r: "PUR-7710 due 31 Oct",
      f: "₹2,12,000 outflow",
      e: "Verified invoice & matching PO",
      w: "Supplier payments",
      dt: "31 Oct 2026"
    }
  ],

  mem: [
    ["Business", "GSTIN & filing cadence", "ABC Traders files GSTR-3B monthly, quarterly QRMP not opted", "Owner onboarding", "12 Sep"],
    ["Financial", "Primary bank account", "Statements arrive by email on the 1st; format CSV", "Email", "01 Oct"],
    ["Customer", "Rahul Sharma payment habit", "Usually pays 2–3 days after reminder; prefers Hindi voice calls", "Voice Call AI", "19 Oct"],
    ["Task", "Last month-end close", "Closed autonomously on 2 Oct; background state persisted", "Workflow Agent", "02 Oct"],
    ["Supplier", "Gupta Steel terms", "Net 30, invoices sent via WhatsApp PDF parsed automatically", "WhatsApp Agent", "14 Oct"]
  ],

  log: [
    ["31 Oct 09:42", "Extracted fields from PUR-7722 via OCR", "Vyapar AI", "Month-end close", "Success", "Verified"],
    ["31 Oct 09:31", "Matched UTR4410877 to PUR-7710", "Vyapar AI", "Month-end close", "Success", "Verified"],
    ["31 Oct 09:20", "Placed Hindi voice call to Rahul Sharma", "Voice Agent", "Follow-ups", "Success", "Committed 2 Nov"],
    ["31 Oct 09:05", "Completed headless GST portal navigation", "Browser Agent", "GST check", "Success", "Session Active"],
    ["31 Oct 08:50", "Requested approval: GSTR-3B submit", "Vyapar AI", "Month-end close", "Pending", "Requires approval"]
  ],

  calls: [
    ["Rahul Sharma", "Outbound", "Hindi", "1m 42s", "Committed to pay by Nov 2"],
    ["Sunita Mehta", "Outbound", "English", "2m 10s", "Promised NEFT tomorrow"],
    ["Vikram Gupta", "Incoming", "Marathi", "1m 05s", "Order inquiry resolved"]
  ]
};

// ---------------- COMMON HELPERS ----------------

const fmt = number =>
  "₹" + Number(number).toLocaleString("en-IN");

function badge(status) {
  const value = String(status || "Pending");
  const lower = value.toLowerCase();

  const running = /running/.test(lower) ? "run" : "";

  const type =
    /complet|verified|success|matched|paid|approved/.test(lower)
      ? "d"
      : /pend|await|unverified|uncertain|sample|unmatched/.test(lower)
        ? "p"
        : /fail|mismatch|overdue|duplicate|rejected/.test(lower)
          ? "f"
          : "";

  return `<span class="st ${type} ${running}">
    <span class="dot"></span>${escapeHTML(value)}
  </span>`;
}

function bar(progress) {
  return `<div class="bar"><i style="width:${Number(progress) || 0}%"></i></div>`;
}

function chips(key, values, defaultValue) {
  const current = S.f[key] || defaultValue || values[0];

  return `<div class="chips">${
    values.map(value => `
      <button class="chip ${value === current ? "on" : ""}"
        data-act="flt"
        data-k="${escapeHTML(key)}"
        data-v="${escapeHTML(value)}">
        ${escapeHTML(value)}
      </button>
    `).join("")
  }</div>`;
}

function tbl(headers, rows) {
  return `
    <div class="tw">
      <table>
        <thead>
          <tr>${headers.map(x => `<th>${x}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.length
            ? rows.join("")
            : `<tr><td colspan="${headers.length}"
                style="text-align:center;color:var(--tx2);padding:30px">
                Nothing here yet.
              </td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function head(title, subtitle) {
  return `<h1>${escapeHTML(title)}</h1>
    <p class="sub">${escapeHTML(subtitle)}</p>`;
}

function modal(content) {
  $("#md").innerHTML = content + `
    <div style="margin-top:16px;text-align:right">
      <button class="btn s" data-act="close">Close</button>
    </div>
  `;

  $("#ov").classList.add("on");
}

function toast(message) {
  const element = $("#toast");

  element.textContent = message;
  element.style.display = "block";

  clearTimeout(toast.timer);

  toast.timer = setTimeout(() => {
    element.style.display = "none";
  }, 3200);
}

function pending() {
  return D.app.filter((item, index) => !S.dec[index]).length;
}

// Professional SVG Bar Chart
function chart() {
  const data = [
    [4, 2, 60],
    [6, 3, 64],
    [5, 4, 70],
    [8, 5, 78],
    [7, 5, 84],
    [10, 7, 95]
  ];

  const width = 520;
  const height = 190;

  const x = index => 30 + index * 88;
  const y = value => height - 20 - value * 1.6;

  let output = "";

  for (let grid = 0; grid < 4; grid++) {
    output += `<line x1="30" x2="510"
      y1="${height - 20 - grid * 40}"
      y2="${height - 20 - grid * 40}"
      stroke="var(--bd)" stroke-dasharray="3 3"/>`;
  }

  data.forEach((row, index) => {
    output += `
      <rect x="${x(index) - 14}"
        y="${y(row[0] * 8)}"
        width="12"
        height="${row[0] * 8 * 1.6}"
        rx="3"
        fill="var(--tx)" opacity="0.9"></rect>

      <rect x="${x(index) + 1}"
        y="${y(row[1] * 8)}"
        width="12"
        height="${row[1] * 8 * 1.6}"
        rx="3"
        fill="var(--tx2)" opacity="0.5"></rect>

      <text x="${x(index)}"
        y="${height - 4}"
        font-size="10"
        fill="var(--tx2)"
        text-anchor="middle">W${index + 1}</text>
    `;
  });

  return `
    <svg viewBox="0 0 ${width} ${height}"
      width="100%" role="img"
      aria-label="Operations chart">
      ${output}
    </svg>
    <div class="mut" style="display:flex;gap:15px;align-items:center;margin-top:8px;">
      <span>■ Tasks Completed</span>
      <span><span style="color:var(--tx2)">■</span> Invoices Processed</span>
    </div>
  `;
}

// Professional SVG Donut / Pie Chart for Financial Breakdown
function pieChart() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-around;padding:10px 0;">
      <svg width="130" height="130" viewBox="0 0 42 42" style="transform: rotate(-90deg);">
        <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="var(--bd)" stroke-width="5"></circle>
        <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="var(--tx)" stroke-width="5" stroke-dasharray="55 45" stroke-dashoffset="0"></circle>
        <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="var(--tx2)" stroke-width="5" stroke-dasharray="25 75" stroke-dashoffset="-55" opacity="0.6"></circle>
        <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#b42318" stroke-width="5" stroke-dasharray="20 80" stroke-dashoffset="-80" opacity="0.8"></circle>
      </svg>
      <div style="font-size:12px;display:grid;gap:6px;">
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;background:var(--tx);border-radius:2px;display:inline-block;"></span> <b>Verified Sales (55%)</b></div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;background:var(--tx2);opacity:0.6;border-radius:2px;display:inline-block;"></span> <b>Purchases (25%)</b></div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;background:#b42318;opacity:0.8;border-radius:2px;display:inline-block;"></span> <b>Pending/Overdue (20%)</b></div>
      </div>
    </div>
  `;
}

// ============================================================
// FIRESTORE CHAT HISTORY
// ============================================================

function getUserConversationsRef() {
  if (!currentUser) {
    throw new Error("You must be logged in to save chat history.");
  }

  return collection(db, "users", currentUser.uid, "conversations");
}

function getConversationRef(conversationId) {
  if (!currentUser || !conversationId) {
    throw new Error("Conversation is not available.");
  }

  return doc(
    db,
    "users",
    currentUser.uid,
    "conversations",
    conversationId
  );
}

function getConversationMessagesRef(conversationId) {
  return collection(
    getConversationRef(conversationId),
    "messages"
  );
}

function isConversationDeleted(data) {
  return Boolean(data?.isDeleted || data?.deletedAt);
}

function createConversationTitle(message) {
  const clean = String(message || "")
    .replace(/\s+/g, " ")
    .trim();

  return clean.length > 55
    ? clean.slice(0, 52) + "..."
    : clean || "New conversation";
}

function updateLocalConversation(conversationId, title) {
  const existing = conversations.find(
    conversation => conversation.id === conversationId
  );

  if (existing) {
    if (title) existing.title = title;
    existing.updatedAt = Date.now();

  } else {
    conversations.unshift({
      id: conversationId,
      title: title || "New conversation",
      updatedAt: Date.now()
    });
  }

  conversations.sort((a, b) => {
    const timeA = a.updatedAt?.toMillis
      ? a.updatedAt.toMillis()
      : Number(a.updatedAt || 0);

    const timeB = b.updatedAt?.toMillis
      ? b.updatedAt.toMillis()
      : Number(b.updatedAt || 0);

    return timeB - timeA;
  });
}

async function createChatConversation(firstMessage) {
  const title = createConversationTitle(firstMessage);

  const reference = await addDoc(
    getUserConversationsRef(),
    {
      title,
      isDeleted: false,
      deletedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );

  updateLocalConversation(reference.id, title);

  return reference.id;
}

async function verifyConversationIsActive(conversationId) {
  const reference = getConversationRef(conversationId);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    throw new Error("This conversation no longer exists.");
  }

  if (isConversationDeleted(snapshot.data())) {
    throw new Error("This conversation has been deleted.");
  }

  return reference;
}

async function saveChatMessage(
  role,
  message,
  conversationIdOverride = null
) {
  if (!currentUser) {
    throw new Error("No authenticated user is available.");
  }

  let conversationId =
    conversationIdOverride || activeConversationId;

  if (!conversationId) {
    if (role !== "user") {
      throw new Error("Cannot save an assistant message without a conversation.");
    }

    conversationId = await createChatConversation(message);
  }

  const conversationReference =
    await verifyConversationIsActive(conversationId);

  await addDoc(
    getConversationMessagesRef(conversationId),
    {
      role,
      text: String(message),
      createdAt: serverTimestamp()
    }
  );

  const updateData = {
    updatedAt: serverTimestamp()
  };

  if (role === "user") {
    const existing = conversations.find(
      conversation => conversation.id === conversationId
    );

    if (!existing || !existing.title) {
      updateData.title = createConversationTitle(message);
    }
  }

  await updateDoc(conversationReference, updateData);

  updateLocalConversation(
    conversationId,
    role === "user"
      ? createConversationTitle(message)
      : undefined
  );

  return conversationId;
}

async function loadChatConversation(
  conversationId,
  invalidateRequest = true
) {
  if (!currentUser || !conversationId) return;

  const uid = currentUser.uid;

  if (invalidateRequest) {
    chatRequestId++;
  }

  try {
    const conversationReference =
      getConversationRef(conversationId);

    const conversationSnapshot =
      await getDoc(conversationReference);

    if (!currentUser || currentUser.uid !== uid) return;

    if (
      !conversationSnapshot.exists() ||
      isConversationDeleted(conversationSnapshot.data())
    ) {
      conversations = conversations.filter(
        item => item.id !== conversationId
      );

      if (activeConversationId === conversationId) {
        activeConversationId = null;
        chatMessages.length = 0;
      }

      rerender();
      toast("This conversation has been deleted.");
      return;
    }

    const messagesQuery = query(
      getConversationMessagesRef(conversationId),
      orderBy("createdAt", "asc")
    );

    const snapshot = await getDocs(messagesQuery);

    if (!currentUser || currentUser.uid !== uid) return;

    activeConversationId = conversationId;
    pendingPortal = null;

    chatMessages.length = 0;

    snapshot.docs.forEach(item => {
      const data = item.data();

      if (
        (data.role === "user" || data.role === "assistant") &&
        typeof data.text === "string"
      ) {
        chatMessages.push({
          role: data.role,
          text: data.text
        });
      }
    });

    rerender();

    requestAnimationFrame(() => {
      const area = $("#vosChatScroll");

      if (area) {
        area.scrollTop = area.scrollHeight;
      }
    });

  } catch (error) {
    console.error("Unable to open conversation:", error);
    toast("Unable to open this conversation.");
  }
}

async function loadChatHistory() {
  if (!currentUser || chatHistoryLoading) return;

  const uid = currentUser.uid;

  if (chatHistoryLoadedForUid === uid) return;

  chatHistoryLoading = true;

  try {
    const historyQuery = query(
      getUserConversationsRef(),
      orderBy("updatedAt", "desc")
    );

    const snapshot = await getDocs(historyQuery);

    if (!currentUser || currentUser.uid !== uid) return;

    conversations = snapshot.docs
      .filter(item => !isConversationDeleted(item.data()))
      .map(item => ({
        id: item.id,
        title: item.data().title || "New conversation",
        updatedAt: item.data().updatedAt || null
      }));

    chatHistoryLoadedForUid = uid;

    if (
      activeConversationId &&
      !conversations.some(item => item.id === activeConversationId)
    ) {
      activeConversationId = null;
      chatMessages.length = 0;
    }

    if (!activeConversationId && conversations.length) {
      await loadChatConversation(conversations[0].id, false);
    } else {
      rerender();
    }

  } catch (error) {
    console.error("Chat history loading error:", error);
    toast("Unable to load chat history. Check your connection.");

  } finally {
    chatHistoryLoading = false;
  }
}

async function deleteChatConversation(conversationId) {
  if (!currentUser || !conversationId) return;

  const uid = currentUser.uid;

  const conversation = conversations.find(
    item => item.id === conversationId
  );

  if (!conversation) return;

  const confirmed = window.confirm(
    `Delete "${conversation.title}"?\n\nThis conversation will be removed from your Chat History and will not reappear.`
  );

  if (!confirmed) return;

  try {
    const reference = getConversationRef(conversationId);

    const snapshot = await getDoc(reference);

    if (!snapshot.exists()) {
      conversations = conversations.filter(
        item => item.id !== conversationId
      );

      rerender();
      return;
    }

    await updateDoc(reference, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    if (!currentUser || currentUser.uid !== uid) return;

    conversations = conversations.filter(
      item => item.id !== conversationId
    );

    if (activeConversationId === conversationId) {
      chatRequestId++;
      activeConversationId = null;
      chatMessages.length = 0;
      pendingPortal = null;
    }

    rerender();

    toast("Conversation deleted from Chat History.");

  } catch (error) {
    console.error("Unable to delete conversation:", error);

    toast(
      "Unable to delete this conversation. Check your Firestore permissions."
    );
  }
}

function startNewChat() {
  chatRequestId++;
  chatMessages.length = 0;
  pendingPortal = null;
  activeConversationId = null;

  rerender();
}

function clearChatStateForLogout() {
  chatRequestId++;

  chatMessages.length = 0;
  conversations = [];

  activeConversationId = null;
  pendingPortal = null;

  chatHistoryLoadedForUid = null;
  chatHistoryLoading = false;

  document.body.classList.remove("vos-chat-fullscreen");
}

// ============================================================
// GOVERNMENT PORTAL DETECTION
// ============================================================

const GOVERNMENT_PORTALS = [
  {
    name: "GST",
    url: "https://www.gst.gov.in/",
    pattern: /\b(gst|gstin|gstr[- ]?\d+|cgst|sgst|igst|utgst|input tax credit|e-?way bill)\b/i
  },
  {
    name: "Income Tax",
    url: "https://www.incometax.gov.in/iec/foportal/",
    pattern: /\b(itr|income[- ]tax|tax return|tax filing|income tax return)\b/i
  },
  {
    name: "Passport Seva",
    url: "https://www.passportindia.gov.in/",
    pattern: /\b(passport|passport seva)\b/i
  },
  {
    name: "UIDAI Aadhaar",
    url: "https://uidai.gov.in/",
    pattern: /\b(aadhaar|aadhar|uidai|e-aadhaar)\b/i
  }
];

function detectGovernmentPortal(message) {
  return GOVERNMENT_PORTALS.find(portal =>
    portal.pattern.test(message)
  ) || null;
}

function isExplanationRequest(message) {
  return /\b(explain|how|what|why|process|procedure|steps|guide|documents?|eligibility|requirements|fees|charges|benefits|difference|understand|tell me about|teach me|information|details)\b/i.test(message);
}

function isDirectPortalRequest(message) {
  if (isExplanationRequest(message)) return false;

  return /\b(open|visit|go to|take me to|redirect|launch|access|file|filing|submit|download|update|register|registration|login|log in|check status|track|pay|apply|book|start filing)\b/i.test(message);
}

function isPermissionYes(message) {
  return /^(yes|yes please|sure|okay|ok|allow|proceed|go ahead|open it|please open|do it|yeah|yep|yes open it|open the website)[.! ]*$/i.test(message.trim());
}

function isPermissionNo(message) {
  return /^(no|no thanks|not now|cancel|don't|do not|nope|not yet)[.! ]*$/i.test(message.trim());
}

function openGovernmentPortal(portal) {
  const newTab = window.open(portal.url, "_blank");

  if (newTab) {
    newTab.opener = null;
  }

  return Boolean(newTab);
}

async function addChatExchange(userText, assistantText) {
  chatMessages.push(
    { role: "user", text: userText },
    { role: "assistant", text: assistantText }
  );

  rerender();

  try {
    const conversationId = await saveChatMessage(
      "user",
      userText
    );

    await saveChatMessage(
      "assistant",
      assistantText,
      conversationId
    );

  } catch (error) {
    console.error("Unable to save chat exchange:", error);
    toast("Message shown, but chat history could not be saved.");
  }
}

// ---------------- DASHBOARD DATA CONTEXT HELPER ----------------

function getDashboardDataContext() {
  return `
[CURRENT LIVE DASHBOARD DATA CONTEXT]
- Business Name: ${sessionStorage.getItem("vyaparos_business") || "My Business"}
- Tasks Overview: ${JSON.stringify(D.tasks)}
- Invoices Summary: ${JSON.stringify(D.inv)}
- Bank Reconciliations: ${JSON.stringify(D.rec)}
- Customers & Dues: ${JSON.stringify(D.cus)}
- Pending Approvals: ${JSON.stringify(D.app)}
- Business Memory: ${JSON.stringify(D.mem)}
- Recent Activity Logs: ${JSON.stringify(D.log)}
- Voice Call History: ${JSON.stringify(D.calls)}
`;
}

// ============================================================
// DASHBOARD PAGES
// ============================================================

const P = {};

// ---------------- AI CHATBOX ----------------

P.chatbox = () => {
  const welcome = chatMessages.length === 0;

  return `
    <section class="vos-chat-page vos-chat-fullscreen">

      <aside class="vos-chat-history-rail">

        <div class="vos-chat-history-top">

          <div class="vos-chat-history-brand">
            <span class="vos-chat-history-brand-mark">✧</span>
            <span>VyaparOS</span>
          </div>

          <button type="button"
            class="vos-chat-history-new"
            data-act="chatnew">
            + &nbsp; New chat
          </button>

        </div>

        <div class="vos-chat-history-label">Chat History</div>

        <div class="vos-chat-history-list">

          ${
            conversations.length
              ? conversations.map(conversation => `
                  <div class="vos-chat-history-row ${
                    conversation.id === activeConversationId ? "active" : ""
                  }">

                    <button type="button"
                      class="vos-chat-history-open"
                      data-act="chatopen"
                      data-id="${escapeHTML(conversation.id)}"
                      title="${escapeHTML(conversation.title)}">

                      ${escapeHTML(conversation.title || "New conversation")}

                    </button>

                    <button type="button"
                      class="vos-chat-history-delete"
                      data-act="chatdelete"
                      data-id="${escapeHTML(conversation.id)}"
                      aria-label="Delete conversation"
                      title="Delete conversation">

                      ×

                    </button>

                  </div>
                `).join("")
              : `
                  <div class="vos-chat-history-empty">
                    Your conversations will appear here.
                  </div>
                `
          }

        </div>

      </aside>

      <div class="vos-chat-main">

        <header class="vos-chat-header">

          <div class="vos-chat-heading">
            <div class="vos-chat-mark">✧</div>

            <div>
              <h1>AI Chatbox</h1>
              <p>Your business assistant</p>
            </div>
          </div>

          <div class="vos-chat-header-actions">

            <button type="button"
              class="vos-chat-exit"
              data-act="chatexit">
              Back to workspace
            </button>

          </div>

        </header>

        <div class="vos-chat-scroll" id="vosChatScroll">

          <div class="vos-chat-content">

            ${
              welcome
                ? `
                  <div class="vos-chat-welcome">

                    <div class="vos-chat-welcome-icon">✧</div>

                    <h2>How can I help you today?</h2>

                    <p>
                      Ask Vyapar AI about business operations,
                      invoices, finances, GST or customers.
                    </p>

                    <div class="vos-chat-suggestions">

                      <button type="button"
                        data-act="chatsuggest"
                        data-text="Summarise my business operations">
                        <span>▦</span>
                        Summarise my business operations
                      </button>

                      <button type="button"
                        data-act="chatsuggest"
                        data-text="Explain the GST filing process">
                        <span>₹</span>
                        Explain the GST filing process
                      </button>

                      <button type="button"
                        data-act="chatsuggest"
                        data-text="How can I manage pending invoices?">
                        <span>▤</span>
                        Manage pending invoices
                      </button>

                      <button type="button"
                        data-act="chatsuggest"
                        data-text="Create a business task plan">
                        <span>✧</span>
                        Create a business task plan
                      </button>

                    </div>

                  </div>
                `
                : chatMessages.map(message => `
                    <article class="vos-chat-message ${message.role}">

                      <div class="vos-chat-avatar">
                        ${message.role === "user" ? "Y" : "✧"}
                      </div>

                      <div class="vos-chat-message-body">

                        <strong>
                          ${message.role === "user" ? "You" : "Vyapar AI"}
                        </strong>

                        <p>${
                          escapeHTML(message.text).replace(/\n/g, "<br>")
                        }</p>

                      </div>

                    </article>
                  `).join("")
            }

          </div>

        </div>

        <footer class="vos-chat-footer">

          <form class="vos-chat-composer" id="vosChatForm">
            
            <button type="button" id="vosMicBtn" class="vos-mic-btn" title="Click to speak command" aria-label="Voice command">
              🎙️
            </button>

            <textarea id="vosChatInput"
              rows="1"
              placeholder="Message Vyapar AI or use voice..."
              aria-label="Message Vyapar AI"></textarea>

            <button type="submit" aria-label="Send message">↑</button>

          </form>

          <p class="vos-chat-disclaimer">
            Vyapar AI can read your dashboard data to answer queries. Verify important information.
          </p>

        </footer>

      </div>

    </section>
  `;
};

// ---------------- OVERVIEW ----------------

P.overview = () => {
  return head(
    "Good morning, " +
      (sessionStorage.getItem("vyaparos_business") || "your business") + ".",
    "Autonomous agent workspace & professional financial overview."
  ) +

  '<div class="g g4">' +

  [
    ["Tasks Completed", "48", "◧"],
    ["Pending Tasks", "7", "◌"],
    ["Invoices Processed", "126", "❏"],
    ["Approvals Required", pending(), "✓"]
  ].map(item => `
    <div class="c">
      <div class="mut">${item[2]} ${item[0]}</div>
      <div class="big">${item[1]}</div>
    </div>
  `).join("") +

  '</div><div class="g g2" style="margin-top:16px">' +

  '<div class="c"><h3>Business Operations & Weekly Activity</h3>' +
  chart() +
  '</div>' +

  '<div class="c"><h3>Document & Revenue Breakdown</h3>' +
  pieChart() +
  '</div>' +

  '</div><div class="g g2" style="margin-top:16px">' +

  '<div class="c ai-employee-status"><h3>Autonomous Agent Status (Month-End Close)</h3>' +

  [
    ["Employee", "Vyapar AI"],
    ["Status", "Active (Multi-Day Execution)"],
    ["Current task", "Reconciling bank lines & verifying portal session"],
    ["Active Workflow", "October month-end close"],
    ["Channel Ingestion", "WhatsApp PDF + Email CSV sync"],
    ["Portal Automation", "Headless browser session active"],
    ["Voice Calls", "Vernacular (Hindi/Marathi) completed"]
  ].map(row => `
    <div class="row" style="border-color:rgba(255,255,255,0.18)">
      <span>${row[0]}</span>
      <span style="text-align:right">${row[1]}</span>
    </div>
  `).join("") +

  '</div>' +

  '<div class="c"><h3>Pending Approvals</h3>' +

  D.app.map((item, index) =>
    S.dec[index] ? "" : `
      <div class="row"><span>${item.t}</span></div>
    `
  ).join("") +

  '<a href="#approvals" class="btn sm" style="text-decoration:none;display:inline-block;margin-top:10px">Review Approvals</a></div>' +

  '</div>';
};

// ---------------- AI EMPLOYEE ----------------

P.employee = () => {
  const plan = S.plan;

  return head(
    "Meet your AI Employee.",
    "Autonomous multi-day orchestration: WhatsApp/email invoice ingestion, bank reconciliation, portal automation & vernacular voice calls."
  ) +

  '<div class="g g2">' +

  '<div class="c">' +
  '<div class="row"><div><b style="font-size:18px">Vyapar AI</b><div class="mut">Autonomous Operations Agent</div></div>' +
  badge("Running") +
  '</div>' +

  '<div class="row"><span class="mut">Objective</span><span>October month-end close (Multi-day)</span></div>' +
  '<div class="row"><span class="mut">Current Action</span><span>Computer use on GST portal + Vernacular calls</span></div>' +
  '<div class="row"><span class="mut">Workflow Progress</span><span style="width:50%">' +
  bar(85) +
  '</span></div>' +
  '<div class="row"><span class="mut">Vector Memory</span><span>Connected & Synchronized</span></div>' +
  '</div>' +

  '<div class="c"><h3>Autonomous Command</h3>' +
  '<textarea class="cmd" id="cmd" placeholder="Instruct agent (e.g. Run October month-end close, ingest WhatsApp invoices, reconcile bank, file GST, and call overdue customers)..."></textarea>' +
  '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
  '<button class="btn" data-act="plan">Generate autonomous plan</button>' +
  '<button class="btn s" data-act="ex">Use month-end example</button>' +
  '</div></div></div>' +

  (plan
    ? '<div class="c" style="margin-top:16px"><h3>Agent Task Orchestration Plan</h3><p>' +
      escapeHTML(plan.i) +
      '</p><div class="note">Multi-day agent pipeline active. Portal automation & voice calls staged.</div>' +
      plan.s.map((item, index) => `
        <div class="row">
          <span>${index + 1}. ${escapeHTML(item[0])}</span>
          ${badge(item[1])}
        </div>
      `).join("") +
      '</div>'
    : "");
};

// ---------------- TASKS ----------------

P.tasks = () => {
  const filter = S.f.tasks || "All Tasks";

  const rows = D.tasks
    .filter(task => filter === "All Tasks" || task.s === filter)
    .map(task => `
      <tr class="k" data-act="task" data-i="${task.id}">
        <td>
          <b>${escapeHTML(task.t)}</b>
          <div class="mut">${escapeHTML(task.d)}</div>
        </td>
        <td>${task.c}</td>
        <td>${badge(task.s)}</td>
        <td>${task.p}</td>
        <td>${bar(task.pr)}</td>
        <td>${task.u}</td>
      </tr>
    `);

  return head(
    "Tasks & Workflows",
    "Multi-day autonomous workflows executing across portals and channels."
  ) +

  '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
  chips("tasks", [
    "All Tasks",
    "Running",
    "Completed",
    "Pending Approval",
    "Failed"
  ]) +
  '<button class="btn" data-act="newtask">+ Create task</button></div>' +

  tbl(
    ["Task", "Created", "Status", "Priority", "Progress", "Updated"],
    rows
  );
};

// ---------------- INVOICES ----------------

P.invoices = () => {
  const filter = S.f.inv || "All Documents";

  const rows = D.inv
    .filter(item =>
      filter === "All Documents" ||
      (filter === "Purchase Invoices" && item[2] === "Purchase") ||
      (filter === "Sales Invoices" && item[2] === "Sales") ||
      (filter === "Unverified" && item[7] === "Unverified") ||
      (filter === "Duplicate Documents" && item[7] === "Duplicate")
    )
    .map(item => `
      <tr class="k" data-act="inv" data-i="${D.inv.indexOf(item)}">
        <td><b>${item[0]}</b></td>
        <td>${item[1]}</td>
        <td>${item[3]}</td>
        <td>${item[4]}</td>
        <td>${fmt(item[5])}</td>
        <td>${fmt(item[6])}</td>
        <td><b>${fmt(item[5] + item[6])}</b></td>
        <td>${badge(item[7])}</td>
      </tr>
    `);

  return head(
    "Invoices & Documents",
    "Invoices ingested automatically from WhatsApp and email attachments."
  ) +

  '<div class="dz" id="dz" data-act="pick">' +
  '<b>Drop invoices here or click to upload</b>' +
  '<div class="mut">PDF, JPG, PNG · Ingested via WhatsApp & Email APIs</div>' +
  '<input type="file" id="fi" multiple accept=".pdf,.jpg,.jpeg,.png" hidden>' +
  '</div><div id="up"></div>' +

  chips("inv", [
    "All Documents",
    "Purchase Invoices",
    "Sales Invoices",
    "Unverified",
    "Duplicate Documents"
  ]) +

  tbl(
    ["Invoice", "Party", "Date", "GSTIN", "Taxable", "GST", "Total", "Status"],
    rows
  ) +

  '<div class="c" style="margin-top:16px"><h3>AI OCR Extraction & Validation</h3>' +
  '<div class="mut">Fields automatically extracted and verified against government GSTIN registry.</div></div>';
};

// ---------------- RECONCILIATION ----------------

P.recon = () => {
  const rows = D.rec.map((item, index) => `
    <tr class="k" data-act="rec" data-i="${index}">
      <td>${item[0]}</td>
      <td>${item[1]}</td>
      <td>${item[2]}</td>
      <td>${item[3]}</td>
      <td>${item[4]}</td>
      <td>${item[5]}</td>
      <td>${badge(S.mdec[index] || item[6])}</td>
      <td>
        <button class="btn s sm" data-act="rec" data-i="${index}">
          Inspect
        </button>
      </td>
    </tr>
  `);

  const matched = D.rec.filter((item, index) =>
    (S.mdec[index] || item[6]) === "Matched"
  ).length;

  return head(
    "Financial Reconciliation",
    "Bank statement lines reconciled against parsed invoices automatically."
  ) +

  '<div class="g g4">' +

  [
    ["Total Transactions", D.rec.length],
    ["Matched", matched],
    ["Unmatched", 1],
    ["Amount Mismatches", 1]
  ].map(item => `
    <div class="c">
      <div class="mut">${item[0]}</div>
      <div class="big">${item[1]}</div>
    </div>
  `).join("") +

  '</div><div style="height:16px"></div>' +

  tbl(
    ["Date", "Description", "Bank Ref", "Bank Amt", "Invoice Ref", "Invoice Amt", "Status", "Action"],
    rows
  );
};

// ---------------- GST ----------------

P.gst = () => {
  const items = [
    ["GSTR-1", 80],
    ["GSTR-3B", 62],
    ["Input Tax Credit", 70],
    ["Output Tax Liability", 85],
    ["Missing Invoices", 40],
    ["Tax Discrepancies", 55]
  ];

  return head(
    "GST Management",
    "Portal automation via computer use: GSTR-3B preparation & filing."
  ) +

  '<div class="g g3">' +

  items.map(item => `
    <div class="c">
      <div class="mut">${item[0]}</div>
      <div class="big">${item[1]}%</div>
      ${bar(item[1])}
    </div>
  `).join("") +

  '</div><div class="g gh" style="margin-top:16px">' +

  '<div class="c"><h3>AI Portal Automation Summary</h3>' +

  [
    "Collected: 126 invoices via WhatsApp & email",
    "Missing records: 2 purchase invoices requested",
    "Potential mismatch flagged on INV-2044",
    "GST portal session authenticated via browser agent",
    "Pending owner approval for final GSTR-3B submission"
  ].map(item => `<div class="row">${item}</div>`).join("") +

  '</div><div class="c"><h3>Portal Filing Action</h3>' +
  '<p class="mut">Ready for submission on GST.gov.in.</p>' +
  '<button class="btn" data-act="gstreq">Request portal filing approval</button>' +
  '</div></div>';
};

// ---------------- CUSTOMERS ----------------

P.customers = () => {
  const filter = S.f.cus || "All";

  const rows = D.cus
    .filter(item => filter === "All" || item[6] === filter)
    .map(item => `
      <tr class="k" data-act="cus" data-i="${D.cus.indexOf(item)}">
        <td><b>${item[0]}</b></td>
        <td>${item[1]}</td>
        <td>${item[2]}</td>
        <td>${item[3]}</td>
        <td>${fmt(item[4])}</td>
        <td>${item[5]}</td>
        <td>${badge(item[6])}</td>
      </tr>
    `);

  return head(
    "Customers & Suppliers",
    "Relationships, dues and automated vernacular voice outreach."
  ) +

  chips("cus", ["All", "Paid", "Pending", "Overdue"]) +

  tbl(
    ["Name", "Phone", "Email", "Transactions", "Outstanding", "Last txn", "Payment"],
    rows
  );
};

// ---------------- VOICE ----------------

P.voice = () =>
  head(
    "Voice Communications",
    "Vernacular voice calls (Hindi, Marathi, English) made to customers & suppliers."
  ) +

  '<div class="g gh">' +

  '<div class="c"><h3>Outbound Vernacular Voice Call</h3>' +
  '<div class="row"><span class="mut">Customer</span><b>Rahul Sharma</b></div>' +
  '<div class="row"><span class="mut">Outstanding</span><b>₹18,000 (Overdue)</b></div>' +
  '<div class="row"><span class="mut">Language</span>' +
  '<select id="lang"><option>Hindi</option><option>Marathi</option><option>English</option></select></div>' +
  '<button class="btn" data-act="call">Request voice call approval</button></div>' +

  '<div class="c"><h3>Call Transcript & Sentiment</h3>' +
  '<div class="note"><b>Transcript (Hindi):</b> "Namaste Rahul ji, aapka ₹18,000 ka invoice overdue hai."<br><b>Customer Response:</b> "Haan ji, main 2 November tak payment kar dunga."<br><b>Status:</b> Payment commitment recorded.</div></div>' +

  '</div><h3 style="margin:20px 0 10px">Voice Call History</h3>' +

  tbl(
    ["Customer", "Direction", "Language", "Duration", "Outcome / Status"],
    D.calls.map(item =>
      `<tr>${item.map(value => `<td>${escapeHTML(value)}</td>`).join("")}</tr>`
    )
  );

// ---------------- BUSINESS MEMORY ----------------

P.memory = () => {
  const categories = [
    "Business",
    "Financial",
    "Customer",
    "Task",
    "Supplier"
  ];

  const category = S.f.cat || "Business";

  return head(
    "Business Memory",
    "Long-term vector memory storing business rules, habits, and preferences."
  ) +

  chips("cat", categories, "Business") +

  (
    D.mem.filter(item => item[0] === category && !item.x)
      .map(item => {
        const index = D.mem.indexOf(item);

        return `
          <div class="c" style="margin-bottom:12px">
            <div class="row" style="border:0;padding-top:0">
              <b>${escapeHTML(item[1])}</b>
              <span>
                <button class="btn s sm" data-act="medit" data-i="${index}">Edit</button>
                <button class="btn s sm" data-act="mdel" data-i="${index}">Delete</button>
              </span>
            </div>

            <div>${escapeHTML(item[2])}</div>

            <div class="mut" style="margin-top:6px">
              Source: ${escapeHTML(item[3])} · Updated ${escapeHTML(item[4])}
            </div>
          </div>
        `;
      }).join("") ||
      '<div class="c mut">No memories in this category.</div>'
  );
};

// ---------------- APPROVALS ----------------

P.approvals = () =>
  head(
    "Approvals",
    "Owner authorizations required before money movement, portal submissions, or outreach calls."
  ) +

  D.app.map((item, index) => {
    const decision = S.dec[index];

    return `
      <div class="c" style="margin-bottom:14px">

        <div class="row" style="border:0;padding-top:0">
          <b style="font-size:15px">${escapeHTML(item.t)}</b>

          <span class="st ${decision ? "d" : ""}">
            ${decision || "Approval required"}
          </span>
        </div>

        <p style="margin:0 0 8px">${escapeHTML(item.d)}</p>

        <div class="mut">
          Reason: ${escapeHTML(item.r)}
          <br>Financial impact: ${escapeHTML(item.f)}
          <br>Evidence: ${escapeHTML(item.e)}
          <br>Workflow: ${escapeHTML(item.w)} · Requested ${escapeHTML(item.dt)}
        </div>

        ${
          decision
            ? '<div class="note">Decision saved successfully.</div>'
            : `
              <div style="margin-top:12px;display:flex;gap:8px">
                <button class="btn" data-act="appr" data-i="${index}" data-v="Approved">APPROVE</button>
                <button class="btn s" data-act="appr" data-i="${index}" data-v="Rejected">REJECT</button>
              </div>
            `
        }

      </div>
    `;
  }).join("");

// ---------------- ACTIVITY LOGS ----------------

P.logs = () => {
  const filter = S.f.log || "All Activities";

  const rows = D.log
    .filter(item =>
      filter === "All Activities" ||
      (filter === "Successful" && item[4] === "Success") ||
      (filter === "Failed" && item[4] === "Failed") ||
      (filter === "Pending" && item[4] === "Pending") ||
      (filter === "Requires Approval" && item[5] === "Requires approval")
    )
    .map(item => `
      <tr>
        <td>${item[0]}</td>
        <td>${item[1]}</td>
        <td>${item[2]}</td>
        <td>${item[3]}</td>
        <td>${badge(item[4])}</td>
        <td>${item[5]}</td>
      </tr>
    `);

  return head(
    "Activity & Audit Logs",
    "Append-only audit trail of agent actions across portals, files, and voice channels."
  ) +

  chips("log", [
    "All Activities",
    "Successful",
    "Failed",
    "Pending",
    "Requires Approval"
  ]) +

  tbl(
    ["Time", "Action", "Agent", "Workflow", "Result", "Verification"],
    rows
  );
};

// ---------------- SETTINGS ----------------

P.settings = () =>
  head(
    "Settings",
    "Configure autonomous agent permissions, WhatsApp/email channels, and voice telephony."
  ) +

  '<div class="c">' +

  [
    ["Business Profile", "Business workspace profile & GSTIN"],
    ["AI Employee Autonomy", "Require owner approval for money movement & portal filing"],
    ["WhatsApp & Email Ingestion", "Connected to WhatsApp Business API & IMAP inbox"],
    ["Browser Automation (Computer Use)", "Headless Chromium container active"],
    ["Voice Communications", "Multilingual TTS/STT (Hindi, Marathi, English)"],
    ["Long-Term Vector Memory", "Active embedding sync"],
    ["Security & Permissions", "Multi-factor authentication & audit logging"],
    ["Notifications", "Real-time alerts for approvals and payment failures"]
  ].map((item, index) => `
    <div class="row">
      <div>
        <b>${item[0]}</b>
        <div class="mut">${item[1]}</div>
      </div>
      <div class="tg ${index % 2 ? "" : "on"}" data-act="tg"></div>
    </div>
  `).join("") +

  '</div>';

// ============================================================
// ROUTING
// ============================================================

function route() {
  let page = location.hash.slice(1);

  if (!P[page]) {
    page = "overview";
  }

  const navItem = NAV.find(item => item[0] === page);

  $("#ttl").textContent = navItem[1];

  $("#nav").innerHTML = NAV.map(item => `
    <a href="#${item[0]}" class="${item[0] === page ? "on" : ""}">
      <span>${item[2]}</span>${item[1]}
    </a>
  `).join("");

  S.cur = page;

  if (page === "chatbox") {
    document.body.classList.add("vos-chat-fullscreen");
  } else {
    document.body.classList.remove("vos-chat-fullscreen");
  }

  $("#pg").innerHTML = P[page]();

  $("#side").classList.remove("on");
  $("#scrim").classList.remove("on");

  if (page === "chatbox" && currentUser) {
    loadChatHistory();
  }

  if (page !== "chatbox") {
    window.scrollTo(0, 0);
  }
}

function rerender() {
  const scrollPosition = window.scrollY;

  if (!P[S.cur]) return;

  $("#pg").innerHTML = P[S.cur]();

  if (S.cur === "chatbox") {
    document.body.classList.add("vos-chat-fullscreen");

    requestAnimationFrame(() => {
      const area = $("#vosChatScroll");

      if (area) {
        area.scrollTop = area.scrollHeight;
      }
    });
  } else {
    window.scrollTo(0, scrollPosition);
  }
}

// ---------------- FILE LIST ----------------

function listFiles(files) {
  const output = $("#up");

  if (!output) return;

  output.innerHTML = [...files].map(file => `
    <div class="row">
      ${escapeHTML(file.name)}
      ${badge("Pending")}
    </div>
  `).join("") +

  '<div class="note">Files processed successfully via WhatsApp & Email ingestion pipeline.</div>';
}

// ============================================================
// DASHBOARD INTERACTIONS & 0.5s VOICE RECOGNITION
// ============================================================

document.addEventListener("click", event => {
  const micBtn = event.target.closest("#vosMicBtn");
  if (micBtn) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let silenceTimer = null;
    let finalTranscript = "";

    const resetSilenceTimer = () => {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        recognition.stop();
      }, 500); // 0.5 seconds silence timeout
    };

    micBtn.style.color = "#b42318";
    toast("Listening... Speak your command.");

    recognition.start();

    recognition.onresult = (e) => {
      let interimTranscript = "";

      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        } else {
          interimTranscript += e.results[i][0].transcript;
        }
      }

      const input = $("#vosChatInput");
      if (input) {
        input.value = finalTranscript || interimTranscript;
      }

      resetSilenceTimer();
    };

    recognition.onerror = (err) => {
      console.error("Speech recognition error:", err);
      clearTimeout(silenceTimer);
      micBtn.style.color = "";
      toast("Voice recognition error. Please try again.");
    };

    recognition.onend = () => {
      clearTimeout(silenceTimer);
      micBtn.style.color = "";

      const input = $("#vosChatInput");
      const form = $("#vosChatForm");

      if (input && input.value.trim() && form) {
        toast("Auto-submitting voice command...");
        form.requestSubmit();
      }
    };

    return;
  }

  const target = event.target.closest("[data-act]");

  if (!target) {
    if (!event.target.closest("#dd,#bell,#avt,#help")) {
      const dropdown = $("#dd");
      if (dropdown) dropdown.classList.remove("on");
    }

    if (event.target.id === "ov") {
      const overlay = $("#ov");
      if (overlay) overlay.classList.remove("on");
    }

    return;
  }

  const action = target.dataset.act;
  const index = Number(target.dataset.i);

  if (action === "chatnew") {
    startNewChat();
  }

  else if (action === "chatopen") {
    loadChatConversation(target.dataset.id);
  }

  else if (action === "chatdelete") {
    deleteChatConversation(target.dataset.id);
  }

  else if (action === "chatexit") {
    location.hash = "overview";
  }

  else if (action === "chatsuggest") {
    const input = $("#vosChatInput");

    if (input) {
      input.value = target.dataset.text || "";
      input.focus();
    }
  }

  else if (action === "flt") {
    S.f[target.dataset.k] = target.dataset.v;
    rerender();
  }

  else if (action === "close") {
    $("#ov").classList.remove("on");
  }

  else if (action === "task") {
    const task = D.tasks.find(item => item.id === index);

    if (!task) return;

    S.t = task;

    modal(`
      <h3 style="font-size:17px">${escapeHTML(task.t)}</h3>
      <p class="mut">${escapeHTML(task.d)} · ${task.c}</p>
      ${badge(task.s)}
      <h3 style="margin-top:16px">Multi-Day Autonomous Execution Steps</h3>

      ${task.st.map((step, stepIndex) => `
        <div class="row">
          <span>${stepIndex + 1}. ${escapeHTML(step)}</span>
          ${badge(
            task.fail === stepIndex
              ? "Failed"
              : stepIndex < task.ok
                ? "Completed"
                : stepIndex === task.ok && task.s === "Running"
                  ? "Running"
                  : "Pending"
          )}
        </div>
      `).join("")}

      <div class="note">
        Agent runs continuously across days without re-prompting.
      </div>
    `);
  }

  else if (action === "newtask") {
    modal(`
      <h3 style="font-size:17px">Create autonomous workflow</h3>
      <input class="f" id="nt" style="width:100%" placeholder="Workflow objective (e.g. November month-end close)">
      <div style="margin-top:12px">
        <button class="btn" data-act="savetask">Deploy Agent</button>
      </div>
    `);
  }

  else if (action === "savetask") {
    const value = $("#nt").value.trim();

    if (!value) {
      toast("Enter a title");
      return;
    }

    D.tasks.unshift({
      id: Date.now(),
      t: value,
      d: "Autonomous workflow initiated by owner",
      c: "Today",
      s: "Running",
      p: "High",
      pr: 10,
      u: "Just now",
      st: ["Agent initialized", "Ingesting source channels", "Running pipeline"],
      ok: 1
    });

    $("#ov").classList.remove("on");

    rerender();
    toast("Autonomous workflow deployed");
  }

  else if (action === "pick") {
    $("#fi").click();
  }

  else if (action === "inv") {
    const item = D.inv[index];

    if (!item) return;

    modal(`
      <h3 style="font-size:17px">
        ${escapeHTML(item[0])} · ${escapeHTML(item[1])}
      </h3>

      ${[
        ["Type", item[2]],
        ["Date", item[3]],
        ["GSTIN", item[4]],
        ["Taxable", fmt(item[5])],
        ["GST", fmt(item[6])],
        ["Total", fmt(item[5] + item[6])]
      ].map(row => `
        <div class="row">
          <span class="mut">${row[0]}</span>${row[1]}
        </div>
      `).join("")}

      <div class="note">Document verified via WhatsApp / Email OCR pipeline.</div>
    `);
  }

  else if (action === "rec") {
    const item = D.rec[index];

    if (!item) return;

    modal(`
      <h3 style="font-size:17px">${escapeHTML(item[1])}</h3>
      ${badge(S.mdec[index] || item[6])}

      <div style="margin:12px 0">
        Bank ${item[3]} vs invoice ${item[5]} (${item[4]})
      </div>

      ${
        item[6] === "Uncertain" || item[6] === "Mismatch"
          ? `
            <div class="note">This item needs owner review.</div>
            <button class="btn sm" data-act="owner" data-i="${index}">
              I confirm this match
            </button>
          `
          : ""
      }
    `);
  }

  else if (action === "owner") {
    S.mdec[index] = "Matched";

    $("#ov").classList.remove("on");

    rerender();
  }

  else if (action === "gstreq") {
    D.app.push({
      t: "GST filing request (GSTR-3B)",
      d: "Owner-authorised filing on GST portal via computer use",
      r: "Prepared return ready",
      f: "Per computed liability",
      e: "Reconciliation summary",
      w: "GST preparation",
      dt: "Today"
    });

    toast("Added to Approvals for portal submission.");
  }

  else if (action === "cus") {
    const item = D.cus[index];

    if (!item) return;

    modal(`
      <h3 style="font-size:17px">${escapeHTML(item[0])}</h3>

      <div class="mut">
        ${escapeHTML(item[1])} · ${escapeHTML(item[2])}
      </div>

      ${[
        ["Outstanding", fmt(item[4])],
        ["Transactions", item[3]],
        ["Last transaction", item[5]],
        ["Payment status", item[6]],
        ["Voice Outreach", "Hindi reminder scheduled"]
      ].map(row => `
        <div class="row">
          <span class="mut">${row[0]}</span>${row[1]}
        </div>
      `).join("")}
    `);
  }

  else if (action === "call") {
    D.app.push({
      t: "Vernacular call: Rahul Sharma (" + $("#lang").value + ")",
      d: "Outbound AI voice reminder for ₹18,000",
      r: "Overdue",
      f: "₹18,000",
      e: "Invoice INV-2041",
      w: "Follow-ups",
      dt: "Today"
    });

    toast("Voice call approval requested.");
  }

  else if (action === "mdel") {
    if (!D.mem[index]) return;

    D.mem[index].x = 1;

    rerender();
    toast("Memory removed");
  }

  else if (action === "medit") {
    if (!D.mem[index]) return;

    S.me = index;

    modal(`
      <h3 style="font-size:17px">${escapeHTML(D.mem[index][1])}</h3>

      <textarea class="cmd" id="mt">${escapeHTML(D.mem[index][2])}</textarea>

      <div style="margin-top:10px">
        <button class="btn" data-act="msave">Save</button>
      </div>
    `);
  }

  else if (action === "msave") {
    if (!D.mem[S.me]) return;

    D.mem[S.me][2] = $("#mt").value;

    $("#ov").classList.remove("on");

    rerender();
  }

  else if (action === "appr") {
    S.pa = [index, target.dataset.v];

    modal(`
      <h3 style="font-size:17px">${target.dataset.v} this action?</h3>
      <p>${escapeHTML(D.app[index].t)}</p>

      <div class="note">
        Authorizing will allow the agent to execute portal automation or voice outreach.
      </div>

      <button class="btn" data-act="conf">Confirm Authorization</button>
    `);
  }

  else if (action === "conf") {
    if (!S.pa) return;

    S.dec[S.pa[0]] = S.pa[1];

    $("#ov").classList.remove("on");

    rerender();
  }

  else if (action === "tg") {
    target.classList.toggle("on");
  }

  else if (action === "ex") {
    $("#cmd").value =
      "Complete my October month-end accounting: pull invoices from WhatsApp and email, reconcile against bank statements, file GSTR-3B on the portal, and call the two overdue customers in Hindi.";
  }

  else if (action === "plan") {
    const value = $("#cmd").value.trim();

    if (!value) {
      toast("Enter a command first");
      return;
    }

    const steps = [
      ["Ingest WhatsApp & email invoices via API connectors", "Completed"],
      ["Extract OCR fields & validate GSTIN registry", "Completed"],
      ["Reconcile bank statement CSV against invoices", "Completed"],
      ["Navigate GST portal via Computer Use & prepare GSTR-3B", "Running"],
      ["Place vernacular voice calls to overdue customers (Hindi)", "Pending Approval"],
      ["Await owner sign-off and finalize month-end close", "Pending"]
    ];

    S.plan = {
      i: value,
      s: steps
    };

    rerender();
  }
});

// ============================================================
// AI CHATBOX MESSAGE HANDLING (WITH DASHBOARD CONTEXT)
// ============================================================

document.addEventListener("submit", async event => {
  if (event.target.id !== "vosChatForm") return;

  event.preventDefault();

  const input = $("#vosChatInput");
  const message = input ? input.value.trim() : "";

  if (!message) return;

  if (!currentUser) {
    toast("Please log in to use AI Chatbox.");
    return;
  }

  const currentRequest = ++chatRequestId;

  if (pendingPortal && isPermissionYes(message)) {
    const portal = pendingPortal;
    pendingPortal = null;

    const opened = openGovernmentPortal(portal);

    await addChatExchange(
      message,
      opened
        ? `Opening the official ${portal.name} website in a new tab.`
        : `I couldn't open a new tab. Please open the official ${portal.name} website here: ${portal.url}`
    );

    return;
  }

  if (pendingPortal && isPermissionNo(message)) {
    pendingPortal = null;

    await addChatExchange(
      message,
      "No problem! I can continue helping you here."
    );

    return;
  }

  const portal = detectGovernmentPortal(message);

  if (portal && isDirectPortalRequest(message)) {
    pendingPortal = null;

    const opened = openGovernmentPortal(portal);

    await addChatExchange(
      message,
      opened
        ? `Opening the official ${portal.name} website in a new tab.`
        : `I couldn't open a new tab. Please open the official ${portal.name} website here: ${portal.url}`
    );

    return;
  }

  const needsPortalExplanation =
    Boolean(portal) && isExplanationRequest(message);

  pendingPortal = needsPortalExplanation ? portal : null;

  const requestConversationId = activeConversationId;

  const conversation = chatMessages
    .filter(item => !item.pending)
    .map(item => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.text
    }));

  const systemPrompt = `
You are Vyapar AI, the intelligent autonomous business assistant inside VyaparOS.

${getDashboardDataContext()}

Answer the user's question accurately using the live dashboard context provided above. If they ask about invoices, dues, tasks, or reconciliation, reference the actual data from the dashboard context.

Rules:
1. Understand the complete question before answering.
2. Give useful explanations instead of short, incomplete replies.
3. Use headings and numbered steps when explaining a process.
4. For Indian government services, provide information relevant to India.
5. Never claim that a government form has been submitted or a payment has been made without owner approval.
6. Never ask the user to share passwords, OTPs, PINs or other confidential login credentials.
7. Do not invent government fees, deadlines, rules or eligibility requirements.
8. If information may change, advise the user to verify it on the official government website.
9. Keep the response easy to understand and professionally written.
10. The agent runs multi-day tasks (WhatsApp/email invoice pulling, bank reconciliation, portal automation, vernacular voice calls) autonomously.

${
  needsPortalExplanation
    ? `The user is asking for an explanation related to ${portal.name}.

Explain the process first in a helpful and sufficiently detailed way.
Do not open or redirect to the website.

At the end of your answer, ask this exact question:

"Would you like me to open the official ${portal.name} government website in a new tab?"`
    : ""
}
`;

  conversation.unshift({
    role: "system",
    content: systemPrompt
  });

  conversation.push({
    role: "user",
    content: message
  });

  chatMessages.push({
    role: "user",
    text: message
  });

  const assistantIndex = chatMessages.length;

  chatMessages.push({
    role: "assistant",
    text: "Vyapar AI is thinking...",
    pending: true
  });

  rerender();

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const area = $("#vosChatScroll");

      if (area) {
        area.scrollTop = area.scrollHeight;
      }
    });
  };

  scrollToBottom();

  let savedConversationId = requestConversationId;

  try {
    savedConversationId = await saveChatMessage(
      "user",
      message,
      requestConversationId
    );

    if (currentRequest === chatRequestId) {
      activeConversationId = savedConversationId;

      rerender();
      scrollToBottom();
    }

  } catch (error) {
    console.error("Unable to save user message:", error);

    if (currentRequest === chatRequestId) {
      chatMessages[assistantIndex] = {
        role: "assistant",
        text: "I couldn't save this message to your chat history. Please check your internet connection and Firebase Firestore permissions."
      };

      rerender();
    }

    return;
  }

  try {
    const response = await fetch(
      "http://127.0.0.1:3001/api/chat",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          messages: conversation
        })
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("The AI backend returned an invalid response.");
    }

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to get an AI response."
      );
    }

    let reply =
      typeof data.reply === "string" && data.reply.trim()
        ? data.reply.trim()
        : "I couldn't generate an answer.";

    if (needsPortalExplanation) {
      const permissionQuestion =
        `Would you like me to open the official ${portal.name} government website in a new tab?`;

      if (!reply.toLowerCase().includes("would you like me to open")) {
        reply += "\n\n" + permissionQuestion;
      }
    }

    try {
      await saveChatMessage(
        "assistant",
        reply,
        savedConversationId
      );

    } catch (saveError) {
      console.error(
        "Unable to save assistant response:",
        saveError
      );
    }

    if (currentRequest !== chatRequestId) return;

    chatMessages[assistantIndex] = {
      role: "assistant",
      text: reply
    };

  } catch (error) {
    console.error("Vyapar AI connection error:", error);

    const errorReply =
      "I couldn't connect to Vyapar AI. Please check that Ollama and the Vyapar AI backend are running.\n\nError: " +
      error.message;

    try {
      await saveChatMessage(
        "assistant",
        errorReply,
        savedConversationId
      );

    } catch (saveError) {
      console.error("Unable to save error message:", saveError);
    }

    if (currentRequest !== chatRequestId) return;

    chatMessages[assistantIndex] = {
      role: "assistant",
      text: errorReply
    };

  } finally {
    if (currentRequest === chatRequestId) {
      rerender();
      scrollToBottom();
    }
  }
});

// ---------------- ENTER TO SEND ----------------

document.addEventListener("keydown", event => {
  if (
    event.target.id === "vosChatInput" &&
    event.key === "Enter" &&
    !event.shiftKey
  ) {
    event.preventDefault();

    const form = $("#vosChatForm");

    if (form) {
      form.requestSubmit();
    }
  }
});

// ============================================================
// FILE UPLOAD
// ============================================================

document.addEventListener("change", event => {
  if (event.target.id === "fi") {
    listFiles(event.target.files);
  }
});

document.addEventListener("dragover", event => {
  if (event.target.closest("#dz")) {
    event.preventDefault();

    $("#dz").classList.add("ov");
  }
});

document.addEventListener("dragleave", event => {
  const dropZone = $("#dz");

  if (dropZone && !dropZone.contains(event.relatedTarget)) {
    dropZone.classList.remove("ov");
  }
});

document.addEventListener("drop", event => {
  if (event.target.closest("#dz")) {
    event.preventDefault();

    $("#dz").classList.remove("ov");

    listFiles(event.dataTransfer.files);
  }
});

// ============================================================
// SIDEBAR
// ============================================================

$("#burger").onclick = () => {
  if (S.cur === "chatbox") return;

  $("#side").classList.add("on");
  $("#scrim").classList.add("on");
};

$("#scrim").onclick = () => {
  $("#side").classList.remove("on");
  $("#scrim").classList.remove("on");
};

// ============================================================
// SEARCH
// ============================================================

$("#q").onkeydown = event => {
  if (event.key !== "Enter") return;

  const value = event.target.value.toLowerCase().trim();

  const match = NAV.find(item =>
    item[1].toLowerCase().includes(value)
  );

  if (value && match) {
    location.hash = match[0];
    event.target.value = "";

  } else {
    toast("No matching page");
  }
};

// ============================================================
// DROPDOWN MENUS & PROFESSIONAL PROFILE MODAL
// ============================================================

function dd(content) {
  const dropdown = $("#dd");

  dropdown.innerHTML = content;
  dropdown.classList.toggle("on");
}

$("#bell").onclick = event => {
  event.stopPropagation();

  dd(`
    <h3>Notifications</h3>
    <div class="row">${pending()} approvals waiting</div>
    <div class="row">Agent active across days</div>
  `);
};

$("#help").onclick = event => {
  event.stopPropagation();

  dd(`
    <h3>Help</h3>
    <div class="mut">
      Use the sidebar to move between modules.
      VyaparOS manages month-end close autonomously.
    </div>
  `);
};

$("#avt").onclick = event => {
  event.stopPropagation();

  const currentName = sessionStorage.getItem("vyaparos_name") || "Owner";
  const currentBusiness = sessionStorage.getItem("vyaparos_business") || "My Business";
  const currentEmail = sessionStorage.getItem("vyaparos_email") || "";
  const currentPhoto = sessionStorage.getItem("vyaparos_photo");

  const avatarDisplayHtml = currentPhoto
    ? `<img src="${currentPhoto}" alt="Profile" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`
    : `<span>${currentName.split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase()}</span>`;

  modal(`
    <div style="text-align:center; margin-bottom: 16px;">
      <div style="position:relative; width:72px; height:72px; margin:0 auto 10px; border-radius:50%; background:#eeeaff; color:#765ed6; display:grid; place-items:center; font-size:22px; font-weight:700; overflow:hidden; border:2px solid #ded6f8;">
        ${avatarDisplayHtml}
      </div>
      <button class="btn s sm" id="changePhotoBtn" style="font-size:11px; padding:4px 10px;">Change Photo</button>
      ${currentPhoto ? `<button class="btn s sm" id="removePhotoBtn" style="font-size:11px; padding:4px 10px; color:#b42318; border-color:#fad1d1; margin-left:6px;">Remove photo</button>` : ""}
      <input type="file" id="profilePhotoInput" accept="image/*" hidden />
    </div>

    <h3 style="font-size:17px; margin-bottom:12px;">Edit Profile & Workspace</h3>

    <div style="display:grid; gap:10px; text-align:left;">
      <div>
        <label class="mut" style="font-size:11px; display:block; margin-bottom:4px;">Full Name</label>
        <input class="f" id="profileName" value="${escapeHTML(currentName)}" style="width:100%; box-sizing:border-box;" />
      </div>
      <div>
        <label class="mut" style="font-size:11px; display:block; margin-bottom:4px;">Business / Workspace Name</label>
        <input class="f" id="profileBusiness" value="${escapeHTML(currentBusiness)}" style="width:100%; box-sizing:border-box;" />
      </div>
      <div>
        <label class="mut" style="font-size:11px; display:block; margin-bottom:4px;">Email Address</label>
        <input class="f" id="profileEmail" value="${escapeHTML(currentEmail)}" disabled style="width:100%; box-sizing:border-box; background:#f5f3f9; color:#7e778d;" />
      </div>
    </div>

    <div style="margin-top:16px; display:flex; justify-content:space-between; align-items:center;">
      <button class="btn s sm" id="logoutBtn" style="color:#b42318; border-color:#fad1d1;">Log out</button>
      <button class="btn" id="saveProfileBtn">Save changes</button>
    </div>
  `);

  // Bind profile modal actions
  const changePhotoBtn = $("#changePhotoBtn");
  const removePhotoBtn = $("#removePhotoBtn");
  const profilePhotoInput = $("#profilePhotoInput");
  const saveProfileBtn = $("#saveProfileBtn");
  const logoutBtn = $("#logoutBtn");

  if (changePhotoBtn && profilePhotoInput) {
    changePhotoBtn.onclick = () => profilePhotoInput.click();
    profilePhotoInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        sessionStorage.setItem("vyaparos_photo", uploadEvent.target.result);
        updateAvatarDisplay();
        toast("Profile photo updated successfully.");
        $("#ov").classList.remove("on");
      };
      reader.readAsDataURL(file);
    };
  }

  if (removePhotoBtn) {
    removePhotoBtn.onclick = () => {
      sessionStorage.removeItem("vyaparos_photo");
      updateAvatarDisplay();
      toast("Profile photo removed.");
      $("#ov").classList.remove("on");
    };
  }

  if (saveProfileBtn) {
    saveProfileBtn.onclick = () => {
      const newName = $("#profileName").value.trim() || "Owner";
      const newBusiness = $("#profileBusiness").value.trim() || "My Business";

      sessionStorage.setItem("vyaparos_name", newName);
      sessionStorage.setItem("vyaparos_business", newBusiness);

      $("#workspaceName").textContent = newBusiness;
      updateAvatarDisplay();
      rerender();

      $("#ov").classList.remove("on");
      toast("Profile updated successfully!");
    };
  }

  if (logoutBtn) {
    logoutBtn.onclick = () => {
      $("#ov").classList.remove("on");
      logout();
    };
  }
};

// ============================================================
// CLOCK
// ============================================================

function tick() {
  const clock = $("#clock");

  if (clock) {
    clock.textContent = new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }
}

setInterval(tick, 30000);
tick();

// ============================================================
// ROUTE LISTENER
// ============================================================

window.addEventListener("hashchange", () => {
  if (authReady && !appScreen.hidden) {
    route();
  }
});

// ============================================================
// FIREBASE AUTH STATE
// ============================================================

watchAuthState(async user => {
  authReady = true;

  if (user) {
    const accountChanged =
      !currentUser || currentUser.uid !== user.uid;

    if (accountChanged) {
      clearChatStateForLogout();
    }

    currentUser = user;

    sessionStorage.setItem(
      "vyaparos_email",
      user.email || ""
    );

    sessionStorage.setItem(
      "vyaparos_name",
      user.displayName ||
      sessionStorage.getItem("vyaparos_name") ||
      user.email?.split("@")[0] ||
      "Owner"
    );

    openApp();

    await loadChatHistory();

  } else {
    currentUser = null;

    clearChatStateForLogout();

    authScreen.hidden = false;
    appScreen.hidden = true;

    sessionStorage.removeItem("vyaparos_email");
    sessionStorage.removeItem("vyaparos_name");
    sessionStorage.removeItem("vyaparos_business");
    sessionStorage.removeItem("vyaparos_photo");

    setAuthMode("login");
  }
});
// ============================================================
// VOICE COMMAND RECOGNITION (Auto-Submit on Complete Speech)
// ============================================================

document.addEventListener("click", event => {
  const micBtn = event.target.closest("#vosMicBtn");
  if (!micBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    toast("Speech recognition is not supported in this browser. Try Chrome or Edge.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN"; // Use "hi-IN" for Hindi or "mr-IN" for Marathi
  recognition.interimResults = true;
  recognition.continuous = false; // Set to false so it stops naturally when you finish speaking
  recognition.maxAlternatives = 1;

  let finalTranscript = "";

  micBtn.style.color = "#b42318"; // Indicate listening state
  toast("Listening... Speak your command.");

  recognition.start();

  recognition.onresult = (e) => {
    let interimTranscript = "";

    for (let i = e.resultIndex; i < e.results.length; ++i) {
      if (e.results[i].isFinal) {
        finalTranscript += e.results[i][0].transcript;
      } else {
        interimTranscript += e.results[i][0].transcript;
      }
    }

    const input = $("#vosChatInput");
    if (input) {
      input.value = finalTranscript || interimTranscript;
    }
  };

  recognition.onerror = (err) => {
    console.error("Speech recognition error:", err);
    micBtn.style.color = "";
    toast("Voice recognition error. Please try again.");
  };

  // This triggers automatically the exact moment you finish speaking
  recognition.onend = () => {
    micBtn.style.color = "";

    const input = $("#vosChatInput");
    const form = $("#vosChatForm");
    const spokenText = input ? input.value.trim() : "";

    if (spokenText && form) {
      // 1. Check if the user's spoken text requests a government portal (GST, UIDAI, ITR, etc.)
      const portalOpened = typeof detectAndOpenPortal === "function" ? detectAndOpenPortal(spokenText) : false;

      // 2. Submit message automatically to the chat agent to get an answer
      if (!portalOpened) {
        toast("Submitting voice command...");
        form.requestSubmit();
      } else {
        form.requestSubmit();
      }
    }
  };
});