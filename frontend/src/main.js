import "./styles.css";
import { api } from "./api.js";
import { hasSupabaseConfig, supabase } from "./supabase.js";

const MODE_CONFIG = {
  general: {
    placeholder: "Ask anything about biomedical engineering..."
  },
  report: {
    placeholder: "Describe the report topic you need help with..."
  },
  device: {
    placeholder: "Name a medical device to explain in detail..."
  },
  troubleshoot: {
    placeholder: "Describe the equipment issue or alarm..."
  }
};

const state = {
  currentMode: "general",
  currentChatId: null,
  chats: [],
  messages: [],
  session: null,
  profile: null,
  isLoading: false
};

const ui = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  setMode("general");
  renderSidebar();
  updateAuthControls();
  syncScrollButton();
  void initializeApp();
});

function cacheElements() {
  ui.appShell = document.getElementById("appShell");
  ui.sidebarScrim = document.getElementById("sidebarScrim");
  ui.sidebarToggle = document.getElementById("sidebarToggle");
  ui.newChatBtn = document.getElementById("newChatBtn");
  ui.chatHistory = document.getElementById("chatHistory");
  ui.userCard = document.getElementById("userCard");
  ui.userAvatar = document.getElementById("userAvatar");
  ui.userName = document.getElementById("userName");
  ui.userRole = document.getElementById("userRole");
  ui.statusPillText = document.getElementById("statusPillText");
  ui.signInBtn = document.getElementById("signInBtn");
  ui.registerBtn = document.getElementById("registerBtn");
  ui.signOutBtn = document.getElementById("signOutBtn");
  ui.messagesArea = document.getElementById("messagesArea");
  ui.messagesList = document.getElementById("messagesList");
  ui.welcomeScreen = document.getElementById("welcomeScreen");
  ui.typingMsg = document.getElementById("typingMsg");
  ui.scrollBtn = document.getElementById("scrollBtn");
  ui.chatInput = document.getElementById("chatInput");
  ui.sendBtn = document.getElementById("sendBtn");
  ui.inputHint = document.getElementById("inputHint");
  ui.authChip = document.getElementById("authChip");
  ui.modeTabs = Array.from(document.querySelectorAll(".mode-tab"));
  ui.promptCards = Array.from(document.querySelectorAll("[data-prompt]"));
  ui.modalBg = document.getElementById("modalBg");
  ui.modalCloseBtn = document.getElementById("modalCloseBtn");
  ui.loginForm = document.getElementById("loginForm");
  ui.registerForm = document.getElementById("registerForm");
  ui.loginEmail = document.getElementById("loginEmail");
  ui.loginPassword = document.getElementById("loginPassword");
  ui.loginStatus = document.getElementById("loginStatus");
  ui.registerName = document.getElementById("registerName");
  ui.registerEmail = document.getElementById("registerEmail");
  ui.registerPassword = document.getElementById("registerPassword");
  ui.registerStatus = document.getElementById("registerStatus");
  ui.showRegisterBtn = document.getElementById("showRegisterBtn");
  ui.showLoginBtn = document.getElementById("showLoginBtn");
}

function bindEvents() {
  ui.sidebarToggle.addEventListener("click", openSidebar);
  ui.sidebarScrim.addEventListener("click", closeSidebar);
  ui.newChatBtn.addEventListener("click", newChat);
  ui.userCard.addEventListener("click", () => {
    if (state.session) {
      void handleSignOut();
      return;
    }
    openModal("login");
  });

  ui.signInBtn.addEventListener("click", () => openModal("login"));
  ui.registerBtn.addEventListener("click", () => openModal("register"));
  ui.signOutBtn.addEventListener("click", () => void handleSignOut());
  ui.modalCloseBtn.addEventListener("click", closeModal);
  ui.modalBg.addEventListener("click", (event) => {
    if (event.target === ui.modalBg) {
      closeModal();
    }
  });

  ui.showRegisterBtn.addEventListener("click", () => switchModal("register"));
  ui.showLoginBtn.addEventListener("click", () => switchModal("login"));

  ui.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleLogin();
  });

  ui.registerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleRegister();
  });

  ui.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode || "general"));
  });

  ui.promptCards.forEach((card) => {
    card.addEventListener("click", () => usePrompt(card.dataset.prompt || ""));
  });

  ui.chatInput.addEventListener("keydown", handleKeyDown);
  ui.chatInput.addEventListener("input", () => autoResize(ui.chatInput));
  ui.sendBtn.addEventListener("click", () => void sendMessage());

  ui.chatHistory.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-chat-id]");
    if (deleteButton) {
      event.stopPropagation();
      void deleteChat(deleteButton.dataset.deleteChatId);
      return;
    }

    const chatButton = event.target.closest("[data-chat-id]");
    if (chatButton) {
      void loadChat(chatButton.dataset.chatId);
      closeSidebar();
    }
  });

  ui.messagesArea.addEventListener("scroll", syncScrollButton);
  ui.scrollBtn.addEventListener("click", scrollToBottom);
  window.addEventListener("resize", closeSidebar);
}

async function initializeApp() {
  if (!hasSupabaseConfig || !supabase) {
    ui.inputHint.textContent =
      "Setup required: add Supabase frontend credentials in frontend/.env to enable sign in and saved chats.";
    ui.statusPillText.textContent = "Setup needed";
    ui.authChip.textContent = "Missing config";
    return;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  await applySession(session);

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    void applySession(nextSession);
  });
}

async function applySession(session) {
  state.session = session;

  if (!session) {
    state.profile = null;
    state.chats = [];
    state.currentChatId = null;
    state.messages = [];
    renderMessages();
    showWelcome();
    renderSidebar();
    updateAuthControls();
    ui.statusPillText.textContent = hasSupabaseConfig ? "Guest mode" : "Setup needed";
    ui.authChip.textContent = hasSupabaseConfig ? "Guest mode" : "Missing config";
    return;
  }

  ui.statusPillText.textContent = "Syncing";
  ui.authChip.textContent = "Signed in";

  try {
    const me = await api.getMe();
    state.profile = me.profile;
    state.chats = await api.listChats();
    renderSidebar();
    updateAuthControls();
    ui.statusPillText.textContent = "Connected";
    ui.authChip.textContent = "Cloud sync";
  } catch (error) {
    ui.statusPillText.textContent = "Auth issue";
    ui.authChip.textContent = "Retry needed";
    ui.inputHint.textContent = error.message;
  }
}

function setMode(mode) {
  state.currentMode = mode;
  ui.modeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  ui.chatInput.placeholder = MODE_CONFIG[mode]?.placeholder || MODE_CONFIG.general.placeholder;
}

function renderSidebar() {
  if (!state.session) {
    ui.userAvatar.textContent = "GU";
    ui.userName.textContent = "Guest User";
    ui.userRole.textContent = "Sign in to save chats";
    ui.chatHistory.innerHTML = `
      <div class="empty-history">
        <div class="empty-history-title">Recent Chats</div>
        <div class="empty-history-copy">No saved chats yet.</div>
      </div>
    `;
    return;
  }

  const profileName = state.profile?.full_name || state.session.user?.email || "BiomedConnect User";
  const avatarLabel = state.profile?.avatar_label || deriveInitials(profileName);
  ui.userAvatar.textContent = avatarLabel;
  ui.userName.textContent = profileName;
  ui.userRole.textContent = state.profile?.role_label || "Signed in";

  if (!state.chats.length) {
    ui.chatHistory.innerHTML = `
      <div class="empty-history">
        <div class="empty-history-title">Recent Chats</div>
        <div class="empty-history-copy">No saved chats yet.</div>
      </div>
    `;
    return;
  }

  ui.chatHistory.innerHTML = state.chats
    .map(
      (chat) => `
        <button class="chat-item ${chat.id === state.currentChatId ? "active" : ""}" type="button" data-chat-id="${escapeHtml(chat.id)}">
          <span class="chat-item-icon">💬</span>
          <span class="chat-item-text">
            <span class="chat-item-title">${escapeHtml(chat.title)}</span>
            <span class="chat-item-preview">${escapeHtml(chat.preview || "Continue the conversation")}</span>
          </span>
          <span class="chat-delete-btn" data-delete-chat-id="${escapeHtml(chat.id)}" aria-label="Delete chat">✕</span>
        </button>
      `
    )
    .join("");
}

function updateAuthControls() {
  const signedIn = Boolean(state.session);
  ui.signInBtn.classList.toggle("hidden", signedIn);
  ui.registerBtn.classList.toggle("hidden", signedIn);
  ui.signOutBtn.classList.toggle("hidden", !signedIn);
}

async function loadChat(chatId) {
  if (!chatId || chatId === state.currentChatId || !state.session) {
    return;
  }

  ui.statusPillText.textContent = "Loading";

  try {
    const data = await api.getChat(chatId);
    state.currentChatId = data.chat.id;
    state.messages = data.messages;
    hideWelcome();
    renderMessages();
    renderSidebar();
    scrollToBottom();
    ui.statusPillText.textContent = "Connected";
  } catch (error) {
    ui.inputHint.textContent = error.message;
    ui.statusPillText.textContent = "Load failed";
  }
}

function newChat() {
  state.currentChatId = null;
  state.messages = [];
  renderMessages();
  showWelcome();
  renderSidebar();
  ui.chatInput.value = "";
  autoResize(ui.chatInput);
  closeSidebar();
}

async function deleteChat(chatId) {
  if (!chatId || !state.session) {
    return;
  }

  try {
    await api.deleteChat(chatId);
    state.chats = state.chats.filter((chat) => chat.id !== chatId);
    if (state.currentChatId === chatId) {
      newChat();
    } else {
      renderSidebar();
    }
  } catch (error) {
    ui.inputHint.textContent = error.message;
  }
}

async function sendMessage() {
  const text = ui.chatInput.value.trim();
  if (!text || state.isLoading) {
    return;
  }

  if (!hasSupabaseConfig || !supabase) {
    ui.inputHint.textContent =
      "Setup required: configure Supabase credentials in frontend/.env before using sign in and saved chat.";
    return;
  }

  if (!state.session) {
    openModal("login");
    setFormStatus(ui.loginStatus, "Sign in to save and continue your chats.", "info");
    return;
  }

  hideWelcome();
  ui.chatInput.value = "";
  autoResize(ui.chatInput);

  const userMessage = {
    role: "user",
    content: text
  };

  state.messages.push(userMessage);
  appendMessage("user", text);
  showTyping();
  setLoading(true);
  ui.statusPillText.textContent = "Working";

  try {
    const response = await api.sendMessage({
      chat_id: state.currentChatId,
      message: text,
      mode: state.currentMode
    });

    hideTyping();

    state.currentChatId = response.chat.id;
    state.messages.push(response.assistant_message);
    appendMessage("ai", response.assistant_message.content, { scroll: "top" });
    upsertChat(response.chat);
    renderSidebar();
    ui.statusPillText.textContent = "Connected";
    ui.inputHint.textContent = "AI responses may be inaccurate. Verify important biomedical information.";
  } catch (error) {
    hideTyping();
    appendMessage(
      "ai",
      `**Unable to complete that request.**\n\n${error.message || "Please try again."}`,
      { scroll: "top" }
    );
    ui.statusPillText.textContent = "Request failed";
  } finally {
    setLoading(false);
  }
}

function upsertChat(chat) {
  const existingIndex = state.chats.findIndex((entry) => entry.id === chat.id);

  if (existingIndex >= 0) {
    state.chats.splice(existingIndex, 1);
  }

  state.chats.unshift(chat);
}

function renderMessages() {
  ui.messagesList.innerHTML = "";
  hideTyping();

  state.messages.forEach((message) => {
    appendMessage(message.role === "assistant" ? "ai" : message.role, message.content, { scroll: "none" });
  });
}

function appendMessage(role, text, options = {}) {
  const wrapper = document.createElement("div");
  const isAi = role === "ai";
  wrapper.className = `message ${isAi ? "" : "user"}`;
  wrapper.innerHTML = `
    <div class="msg-avatar ${isAi ? "ai" : "user-av"}">${isAi ? "🧬" : "👤"}</div>
    <div class="msg-body">
      <div class="msg-role">${isAi ? "BiomedConnect AI" : "You"}</div>
      <div class="msg-bubble ${isAi ? "ai-bubble" : "user-bubble"}">${formatText(text)}</div>
    </div>
  `;

  ui.messagesList.appendChild(wrapper);

  if (options.scroll === "top") {
    scrollMessageToTop(wrapper);
    return;
  }

  if (options.scroll !== "none") {
    scrollToBottom();
  }
}

function showTyping() {
  ui.typingMsg.classList.remove("hidden");
  scrollToBottom();
}

function hideTyping() {
  ui.typingMsg.classList.add("hidden");
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  ui.sendBtn.disabled = isLoading;
  ui.chatInput.disabled = isLoading;
}

function handleKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void sendMessage();
  }
}

function usePrompt(text) {
  ui.chatInput.value = text;
  autoResize(ui.chatInput);
  ui.chatInput.focus();
}

function autoResize(element) {
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
}

function hideWelcome() {
  ui.welcomeScreen.classList.add("hidden");
}

function showWelcome() {
  ui.welcomeScreen.classList.remove("hidden");
}

function syncScrollButton() {
  const atBottom = ui.messagesArea.scrollHeight - ui.messagesArea.scrollTop < ui.messagesArea.clientHeight + 100;
  ui.scrollBtn.classList.toggle("hidden", atBottom);
}

function scrollToBottom() {
  setTimeout(() => {
    ui.messagesArea.scrollTop = ui.messagesArea.scrollHeight;
    syncScrollButton();
  }, 50);
}

function scrollMessageToTop(messageElement) {
  setTimeout(() => {
    const messageTop =
      messageElement.getBoundingClientRect().top -
      ui.messagesArea.getBoundingClientRect().top +
      ui.messagesArea.scrollTop;
    ui.messagesArea.scrollTop = Math.max(0, messageTop - 12);
    syncScrollButton();
  }, 50);
}

function openSidebar() {
  ui.appShell.classList.add("drawer-open");
  ui.sidebarScrim.classList.remove("hidden");
}

function closeSidebar() {
  ui.appShell.classList.remove("drawer-open");
  ui.sidebarScrim.classList.add("hidden");
}

function openModal(type) {
  ui.modalBg.classList.remove("hidden");
  switchModal(type);
}

function closeModal() {
  ui.modalBg.classList.add("hidden");
  clearFormStatus();
}

function switchModal(type) {
  const showLogin = type === "login";
  ui.loginForm.classList.toggle("hidden", !showLogin);
  ui.registerForm.classList.toggle("hidden", showLogin);
  clearFormStatus();
}

async function handleLogin() {
  if (!supabase) {
    setFormStatus(ui.loginStatus, "Supabase is not configured yet.", "error");
    return;
  }

  setFormStatus(ui.loginStatus, "Signing you in...", "info");

  const { error } = await supabase.auth.signInWithPassword({
    email: ui.loginEmail.value.trim(),
    password: ui.loginPassword.value
  });

  if (error) {
    setFormStatus(ui.loginStatus, error.message, "error");
    return;
  }

  setFormStatus(ui.loginStatus, "Signed in successfully.", "success");
  closeModal();
}

async function handleRegister() {
  if (!supabase) {
    setFormStatus(ui.registerStatus, "Supabase is not configured yet.", "error");
    return;
  }

  setFormStatus(ui.registerStatus, "Creating your account...", "info");

  const { data, error } = await supabase.auth.signUp({
    email: ui.registerEmail.value.trim(),
    password: ui.registerPassword.value,
    options: {
      data: {
        full_name: ui.registerName.value.trim()
      }
    }
  });

  if (error) {
    setFormStatus(ui.registerStatus, error.message, "error");
    return;
  }

  if (!data.session) {
    setFormStatus(ui.registerStatus, "Account created. Check your email to confirm the account.", "success");
    return;
  }

  setFormStatus(ui.registerStatus, "Account created and signed in.", "success");
  closeModal();
}

async function handleSignOut() {
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
  newChat();
}

function setFormStatus(element, message, variant) {
  element.textContent = message;
  element.dataset.variant = variant;
}

function clearFormStatus() {
  [ui.loginStatus, ui.registerStatus].forEach((element) => {
    element.textContent = "";
    element.dataset.variant = "";
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, '<h4 style="color:var(--accent);margin:10px 0 4px;font-size:13px;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:var(--text);margin:12px 0 5px;font-size:14px;font-weight:700;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="color:var(--accent);margin:14px 0 6px;font-size:16px;font-weight:800;">$1</h2>')
    .replace(/^[\-\*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, (match) => `<ul style="margin:6px 0">${match}</ul>`)
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

function deriveInitials(value) {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "BC";
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
