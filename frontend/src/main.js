import "./styles.css";
import { api, isApiConfigured } from "./api.js";
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
  chatMessagesCache: new Map(),
  session: null,
  profile: null,
  isLoading: false,
  activeView: "chat",
  currentCommunityRoom: null,
  communityPosts: [],
  chatLoadSeq: 0,
  communityLoadSeq: 0,
  searchModalQuery: "",
  searchModalRenderTimer: null,
  renameChatId: null,
  sidebarCollapsed: false,
};

const ui = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  setMode("general");
  renderSidebar();
  updateAuthControls();
  syncScrollButton();
  syncShellView();
  initSidebarCollapsedFromStorage();
  void initializeApp();
});

function cacheElements() {
  ui.appShell = document.getElementById("appShell");
  ui.sidebar = document.getElementById("sidebar");
  ui.sidebarScrim = document.getElementById("sidebarScrim");
  ui.sidebarToggle = document.getElementById("sidebarToggle");
  ui.sidebarRailBtn = document.getElementById("sidebarRailBtn");
  ui.sidebarExpandBtn = document.getElementById("sidebarExpandBtn");
  ui.sidebarSearchBtn = document.getElementById("sidebarSearchBtn");
  ui.chatSearchModalBg = document.getElementById("chatSearchModalBg");
  ui.chatSearchModalInput = document.getElementById("chatSearchModalInput");
  ui.chatSearchModalClose = document.getElementById("chatSearchModalClose");
  ui.chatSearchModalList = document.getElementById("chatSearchModalList");
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
  
  ui.btnDiscussion = document.getElementById("btnDiscussion");
  ui.btnExpertQna = document.getElementById("btnExpertQna");

  // Community view elements
  ui.communityView = document.getElementById("communityView");
  ui.communityIcon = document.getElementById("communityIcon");
  ui.communityTitle = document.getElementById("communityTitle");
  ui.communityDesc = document.getElementById("communityDesc");
  ui.communityFeed = document.getElementById("communityFeed");

  ui.mainHeaderTitle = document.getElementById("mainHeaderTitle");
  ui.chatHeaderContainer = document.getElementById("chatHeaderContainer");
  ui.chatHeaderTitleBtn = document.getElementById("chatHeaderTitleBtn");
  ui.currentChatTitleDisplay = document.getElementById("currentChatTitleDisplay");
  ui.currentChatSubtitleDisplay = document.getElementById("currentChatSubtitleDisplay");
  ui.chatDropdownMenu = document.getElementById("chatDropdownMenu");
  ui.btnStarChat = document.getElementById("btnStarChat");
  ui.btnRenameChat = document.getElementById("btnRenameChat");
  ui.btnDeleteChatTop = document.getElementById("btnDeleteChatTop");

  ui.renameModalBg = document.getElementById("renameModalBg");
  ui.renameChatInput = document.getElementById("renameChatInput");
  ui.renameCancelBtn = document.getElementById("renameCancelBtn");
  ui.renameSaveBtn = document.getElementById("renameSaveBtn");
}

function bindEvents() {
  ui.sidebarToggle.addEventListener("click", openSidebar);
  ui.sidebarScrim.addEventListener("click", closeSidebar);
  ui.sidebarRailBtn.addEventListener("click", () => toggleSidebarCollapsed());
  if (ui.sidebarExpandBtn) {
    ui.sidebarExpandBtn.addEventListener("click", () => toggleSidebarCollapsed());
  }
  ui.newChatBtn.addEventListener("click", newChat);

  ui.sidebarSearchBtn.addEventListener("click", () => openChatSearchModal());
  ui.chatSearchModalClose.addEventListener("click", () => closeChatSearchModal());
  ui.chatSearchModalBg.addEventListener("click", (event) => {
    if (event.target === ui.chatSearchModalBg) {
      closeChatSearchModal();
    }
  });
  ui.chatSearchModalInput.addEventListener("input", () => {
    state.searchModalQuery = ui.chatSearchModalInput.value;
    if (state.searchModalRenderTimer) {
      clearTimeout(state.searchModalRenderTimer);
    }
    state.searchModalRenderTimer = setTimeout(() => {
      state.searchModalRenderTimer = null;
      renderChatSearchModalList();
    }, 80);
  });
  ui.chatSearchModalInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeChatSearchModal();
    }
  });
  ui.chatSearchModalList.addEventListener("click", (event) => {
    const row = event.target.closest("[data-chat-id]");
    if (!row?.dataset.chatId) return;
    closeChatSearchModal();
    void loadChat(row.dataset.chatId);
    closeSidebar();
  });
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
    card.addEventListener("click", () => {
      const promptText = card.dataset.prompt || "";
      usePrompt(promptText);
    });
  });

  ui.chatInput.addEventListener("keydown", handleKeyDown);
  ui.chatInput.addEventListener("input", () => autoResize(ui.chatInput));
  ui.sendBtn.addEventListener("click", () => void sendMessage());

  ui.chatHistory.addEventListener("click", (event) => {
    const dotsButton = event.target.closest("[data-chat-id].chat-item-dots");
    if (dotsButton) {
      event.stopPropagation();
      toggleChatDropdown(dotsButton.dataset.chatId, dotsButton);
      return;
    }

    const chatButton = event.target.closest("[data-chat-id]:not(.chat-item-dots)");
    if (chatButton) {
      void loadChat(chatButton.dataset.chatId);
      closeSidebar();
      return;
    }

  });

  ui.messagesArea.addEventListener("scroll", syncScrollButton);
  ui.scrollBtn.addEventListener("click", scrollToBottom);
  window.addEventListener("resize", () => {
    closeSidebar();
    if (window.innerWidth < 769) {
      state.sidebarCollapsed = false;
      ui.appShell.classList.remove("sidebar-collapsed");
      updateSidebarCollapseUi();
    }
  });

  if (ui.btnDiscussion) {
    ui.btnDiscussion.addEventListener("click", () => {
      void loadCommunityRoom("discussion", "Discussion Panel", "👥", "Discuss various matters regarding biomedical engineering.");
      closeSidebar();
    });
  }

  if (ui.btnExpertQna) {
    ui.btnExpertQna.addEventListener("click", () => {
      void loadCommunityRoom("expert_qna", "Expert Q&A", "💡", "Ask verified professionals and working engineers questions in the field.");
      closeSidebar();
    });
  }

  ui.chatHeaderTitleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    updateChatHeaderDropdown();
    ui.chatHeaderContainer.classList.toggle("open");
    ui.chatDropdownMenu.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    ui.chatHeaderContainer.classList.remove("open");
    ui.chatDropdownMenu.classList.add("hidden");
    closeAllChatDropdowns();
  });

  ui.btnDeleteChatTop.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!state.currentChatId) {
      return;
    }
    ui.chatDropdownMenu.classList.add("hidden");
    ui.chatHeaderContainer.classList.remove("open");
    showDeleteModal(state.currentChatId);
  });

  ui.btnStarChat.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.currentChatId) {
      void toggleChatStar(state.currentChatId);
    }
    ui.chatDropdownMenu.classList.add("hidden");
  });

  ui.btnRenameChat.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.currentChatId) {
      const chat = state.chats.find(c => c.id === state.currentChatId);
      if (chat) {
        openRenameModal(state.currentChatId, chat.title);
      }
    }
    ui.chatDropdownMenu.classList.add("hidden");
  });

  ui.renameCancelBtn.addEventListener("click", () => closeRenameModal());
  ui.renameSaveBtn.addEventListener("click", () => void submitRenameModal());
  ui.renameModalBg.addEventListener("click", (event) => {
    if (event.target === ui.renameModalBg) {
      closeRenameModal();
    }
  });
  ui.renameChatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitRenameModal();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeRenameModal();
    }
  });
}

async function initializeApp() {
  if (import.meta.env.PROD && !isApiConfigured()) {
    ui.inputHint.textContent =
      "Set VITE_API_BASE_URL in Vercel (Environment Variables) to your live API URL, including the /api suffix, e.g. https://your-backend.onrender.com/api";
    ui.statusPillText.textContent = "API URL missing";
    if (ui.authChip) {
      ui.authChip.textContent = "Deploy config";
      ui.authChip.classList.remove("hidden");
    }
    return;
  }

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
  console.log("Applying session:", session ? "Session found" : "No session");
  state.session = session;

  // Always update auth controls first
  updateAuthControls();

  if (!session) {
    console.log("No session - setting guest mode");
    state.profile = null;
    state.chats = [];
    state.currentChatId = null;
    state.messages = [];
    state.chatMessagesCache.clear();
    state.chatLoadSeq += 1;
    state.communityLoadSeq += 1;
    state.searchModalQuery = "";
    if (ui.chatSearchModalInput) {
      ui.chatSearchModalInput.value = "";
    }
    renderMessages();
    showWelcome();
    renderSidebar();
    syncShellView();
    ui.mainHeaderTitle.classList.add("hidden");
    ui.statusPillText.textContent = hasSupabaseConfig ? "Guest mode" : "Setup needed";
    ui.authChip.textContent = hasSupabaseConfig ? "Guest mode" : "Missing config";
    return;
  }

  ui.statusPillText.textContent = "Syncing";
  ui.authChip.textContent = "Signed in";
  console.log("Session found, attempting to get user profile...");

  try {
    const me = await api.getMe();
    console.log("Successfully got user profile:", me);
    state.profile = me.profile;
    state.chats = await api.listChats();
    console.log("Successfully loaded chats:", state.chats.length, "chats");
    renderSidebar();
    warmChatCache();
    updateAuthControls();
    syncShellView();
    ui.mainHeaderTitle.classList.add("hidden");
    ui.statusPillText.textContent = "Connected";
    ui.authChip.textContent = "Cloud sync";
    ui.inputHint.textContent = "AI responses may be inaccurate. Verify important biomedical information.";
  } catch (error) {
    console.error("Authentication error:", error);
    ui.statusPillText.textContent = "Auth issue";
    ui.authChip.textContent = "Retry needed";
    ui.inputHint.textContent = `Authentication error: ${error.message}`;
    // Still update auth controls to show proper state
    updateAuthControls();
  }
}

function setMode(mode) {
  state.currentMode = mode;
  ui.modeTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  if (state.activeView !== "community") {
    setChatInputPlaceholder();
  }
}

function setChatInputPlaceholder() {
  ui.chatInput.placeholder = MODE_CONFIG[state.currentMode]?.placeholder || MODE_CONFIG.general.placeholder;
}

function cloneMessages(messages) {
  return Array.isArray(messages) ? messages.map((message) => ({ ...message })) : [];
}

function cacheChatMessages(chatId, messages) {
  if (!chatId) {
    return;
  }
  state.chatMessagesCache.set(chatId, cloneMessages(messages));
}

function getCachedChatMessages(chatId) {
  const cached = state.chatMessagesCache.get(chatId);
  return cached ? cloneMessages(cached) : null;
}

function getChatSummary(chatId) {
  return state.chats.find((chat) => chat.id === chatId) || null;
}

function mergeChatSummary(chatSummary) {
  if (!chatSummary?.id) {
    return;
  }
  const chatIndex = state.chats.findIndex((chat) => chat.id === chatSummary.id);
  if (chatIndex >= 0) {
    state.chats[chatIndex] = {
      ...state.chats[chatIndex],
      ...chatSummary
    };
  }
}

function warmChatCache(limit = 3) {
  if (!state.session) {
    return;
  }
  const chatIds = state.chats
    .slice(0, limit)
    .map((chat) => chat.id)
    .filter((chatId) => chatId && !state.chatMessagesCache.has(chatId));

  chatIds.forEach((chatId) => {
    void api
      .getChat(chatId)
      .then((data) => {
        if (!state.session || !data?.chat?.id) {
          return;
        }
        cacheChatMessages(data.chat.id, data.messages);
        mergeChatSummary(data.chat);
      })
      .catch(() => {
        // Ignore background prefetch errors; the user can still open the chat on demand.
      });
  });
}

function enterChatView() {
  state.activeView = "chat";
  state.currentCommunityRoom = null;
  state.communityLoadSeq += 1;
  ui.communityView.classList.add("hidden");
  syncShellView();
  setChatInputPlaceholder();
}

function renderActiveChat(chatSummary = getChatSummary(state.currentChatId)) {
  ui.currentChatTitleDisplay.textContent = chatSummary?.title || "Conversation";
  setChatHeaderSubtitle(chatSummary?.title || "", chatSummary?.preview || "");
  ui.mainHeaderTitle.classList.add("hidden");
  ui.chatHeaderContainer.classList.remove("hidden");
  updateChatHeaderDropdown();
  hideWelcome();
  renderMessages();
  renderSidebar();
  updateSidebarActiveStates();
  ui.statusPillText.textContent = "Connected";
  ui.inputHint.textContent = "AI responses may be inaccurate. Verify important biomedical information.";
}

function chatSidebarRowHtml(chat) {
  const active = chat.id === state.currentChatId && state.activeView === "chat" ? "active" : "";
  return `
    <button class="chat-item ${active}" type="button" data-chat-id="${escapeHtml(chat.id)}">
      <span class="chat-item-text">
        <span class="chat-item-line">${escapeHtml(chat.title)}</span>
      </span>
      <span class="chat-item-actions">
        <span class="chat-item-dots" data-chat-id="${escapeHtml(chat.id)}" aria-label="Chat options">···</span>
      </span>
    </button>
  `;
}

function renderSidebar() {
  if (!state.session) {
    ui.userAvatar.textContent = "GU";
    ui.userName.textContent = "Guest User";
    ui.userRole.textContent = "Sign in to save chats";
    ui.chatHistory.innerHTML = `
      <div class="empty-history">
        <div class="empty-history-copy">No saved chats yet. Sign in to sync conversations.</div>
      </div>
    `;
    updateSidebarActiveStates();
    return;
  }

  const filteredChats = state.chats;

  if (!filteredChats.length) {
    const copy = "No conversations yet. Start with New chat.";
    ui.chatHistory.innerHTML = `
      <div class="empty-history">
        <div class="empty-history-copy">${copy}</div>
      </div>
    `;
    updateSidebarActiveStates();
    return;
  }

  ui.chatHistory.innerHTML = filteredChats.map((chat) => chatSidebarRowHtml(chat)).join("");
  updateSidebarActiveStates();
}

function getChatsFilteredForModal() {
  if (!state.searchModalQuery.trim()) {
    return state.chats;
  }
  const query = state.searchModalQuery.toLowerCase().trim();
  return state.chats.filter((chat) => {
    const title = (chat.title || "").toLowerCase();
    const preview = (chat.preview || "").toLowerCase();
    return title.includes(query) || preview.includes(query);
  });
}

function relativeChatListTime(iso) {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const now = Date.now();
  const diff = now - t.getTime();
  const day = 86400000;
  if (diff < day) return "Today";
  if (diff < day * 7) return "Past week";
  if (diff < day * 30) return "Past month";
  return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderChatSearchModalList() {
  if (!ui.chatSearchModalList) return;
  if (!state.session) {
    ui.chatSearchModalList.innerHTML = `<div class="chat-search-empty">Sign in to search your chats.</div>`;
    return;
  }
  const list = getChatsFilteredForModal();
  if (!list.length) {
    ui.chatSearchModalList.innerHTML = `<div class="chat-search-empty">No chats found.</div>`;
    return;
  }
  ui.chatSearchModalList.innerHTML = list
    .map((chat) => {
      const active = chat.id === state.currentChatId && state.activeView === "chat" ? "active" : "";
      const meta = relativeChatListTime(chat.updated_at || chat.created_at);
      return `
        <button type="button" class="chat-search-row ${active}" data-chat-id="${escapeHtml(chat.id)}">
          <span class="chat-search-row-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9a4 4 0 1 1 8 0v1.2c0 .8.3 1.5.8 2.1l.5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M9 17h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="chat-search-row-title">${escapeHtml(chat.title)}</span>
          <span class="chat-search-row-meta">${escapeHtml(meta)}</span>
        </button>
      `;
    })
    .join("");
}

function openChatSearchModal() {
  state.searchModalQuery = "";
  if (ui.chatSearchModalInput) {
    ui.chatSearchModalInput.value = "";
  }
  ui.chatSearchModalBg.classList.remove("hidden");
  ui.chatSearchModalBg.setAttribute("aria-hidden", "false");
  renderChatSearchModalList();
  requestAnimationFrame(() => {
    ui.chatSearchModalInput?.focus();
  });
}

function closeChatSearchModal() {
  ui.chatSearchModalBg.classList.add("hidden");
  ui.chatSearchModalBg.setAttribute("aria-hidden", "true");
}

function initSidebarCollapsedFromStorage() {
  try {
    if (window.innerWidth >= 769 && localStorage.getItem("sidebarCollapsed") === "1") {
      state.sidebarCollapsed = true;
    }
  } catch {
    /* ignore */
  }
  updateSidebarCollapseUi();
}

function updateSidebarCollapseUi() {
  const expanded = !state.sidebarCollapsed;
  ui.appShell.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  if (ui.sidebarRailBtn) {
    ui.sidebarRailBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    ui.sidebarRailBtn.setAttribute("aria-label", expanded ? "Hide sidebar" : "Show sidebar");
    ui.sidebarRailBtn.setAttribute("title", expanded ? "Hide sidebar" : "Show sidebar");
  }
  if (ui.sidebarExpandBtn) {
    ui.sidebarExpandBtn.setAttribute("aria-hidden", expanded ? "true" : "false");
    ui.sidebarExpandBtn.tabIndex = expanded ? -1 : 0;
  }
  try {
    if (window.innerWidth >= 769) {
      localStorage.setItem("sidebarCollapsed", state.sidebarCollapsed ? "1" : "0");
    }
  } catch {
    /* ignore */
  }
}

function toggleSidebarCollapsed() {
  if (window.innerWidth < 769) {
    return;
  }
  state.sidebarCollapsed = !state.sidebarCollapsed;
  updateSidebarCollapseUi();
}

function syncShellView() {
  const isCommunity = state.activeView === "community";
  ui.appShell.classList.toggle("view-community", isCommunity);
  ui.appShell.classList.toggle("view-chat", !isCommunity);
}

function updateAuthControls() {
  const signedIn = Boolean(state.session);
  console.log("Updating auth controls - signedIn:", signedIn, "session exists:", !!state.session);
  
  ui.signInBtn.classList.toggle("hidden", signedIn);
  ui.registerBtn.classList.toggle("hidden", signedIn);
  ui.signOutBtn.classList.toggle("hidden", !signedIn);
  
  // Update user display
  if (signedIn && state.profile) {
    console.log("Updating user display with profile:", state.profile);
    const profileName = state.profile.full_name || state.session.user.email || "BiomedConnect User";
    const avatarLabel = state.profile.avatar_label || deriveInitials(profileName);
    ui.userAvatar.textContent = avatarLabel;
    ui.userName.textContent = profileName;
    ui.userRole.textContent = state.profile.role_label || "Signed in";
  } else if (signedIn && state.session.user) {
    console.log("Updating user display with session user:", state.session.user);
    const profileName = state.session.user.email || "BiomedConnect User";
    const avatarLabel = deriveInitials(profileName);
    ui.userAvatar.textContent = avatarLabel;
    ui.userName.textContent = profileName;
    ui.userRole.textContent = "Signed in";
  } else {
    console.log("Setting guest user display");
    ui.userAvatar.textContent = "GU";
    ui.userName.textContent = "Guest User";
    ui.userRole.textContent = "Sign in to save chats";
  }
}

function normalizeHeaderText(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function setChatHeaderSubtitle(title, preview) {
  if (!ui.currentChatSubtitleDisplay) {
    return;
  }
  const t = normalizeHeaderText(title);
  const p = normalizeHeaderText(preview);
  if (!p || p === t) {
    ui.currentChatSubtitleDisplay.textContent = "";
    ui.currentChatSubtitleDisplay.classList.add("hidden");
    return;
  }
  ui.currentChatSubtitleDisplay.textContent = String(preview || "").trim();
  ui.currentChatSubtitleDisplay.classList.remove("hidden");
}

async function legacyLoadChat(chatId) {
  console.log("loadChat called with chatId:", chatId);
  if (!chatId) {
    console.log("loadChat: No chatId provided, returning");
    return;
  }

  // Check if user is authenticated, if not, prompt to sign in
  if (!state.session) {
    openModal("login");
    setFormStatus(ui.loginStatus, "Sign in to view and continue conversations.", "info");
    return;
  }

  state.activeView = "chat";
  state.currentCommunityRoom = null;
  ui.communityView.classList.add("hidden");
  syncShellView();
  ui.messagesArea.scrollTop = 0;

  if (chatId === state.currentChatId) {
    hideWelcome();
    renderSidebar();
    updateSidebarActiveStates();
    scrollToBottom();
    closeSidebar();
    return;
  }

  ui.messagesList.innerHTML = `<div class="view-loading">Loading conversation…</div>`;

  try {
    const data = await api.getChat(chatId);
    state.currentChatId = data.chat.id;
    state.messages = data.messages;
    
    ui.currentChatTitleDisplay.textContent = data.chat.title || "Conversation";
    setChatHeaderSubtitle(data.chat.title, data.chat.preview);
    ui.mainHeaderTitle.classList.add("hidden");
    ui.chatHeaderContainer.classList.remove("hidden");

    updateChatHeaderDropdown();
    hideWelcome();
    renderMessages();
    renderSidebar();
    scrollToBottom();
    ui.statusPillText.textContent = "Connected";
    ui.inputHint.textContent = "AI responses may be inaccurate. Verify important biomedical information.";
    updateSidebarActiveStates();
    closeSidebar();
  } catch (error) {
    console.error("Failed to load chat:", error);
    ui.inputHint.textContent = `Failed to load chat: ${error.message}`;
    ui.statusPillText.textContent = "Load failed";
    
    // Show error in main content area
    ui.messagesList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #dc2626;">
        <h3>Failed to load conversation</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">
          Reload Page
        </button>
      </div>
    `;
  }
}

function newChat() {
  console.log("newChat button clicked");
  state.chatLoadSeq += 1;
  enterChatView();
  state.currentChatId = null;
  state.messages = [];
  
  // Claude-like: don't show "Chats" label on the empty/welcome screen.
  ui.mainHeaderTitle.classList.add("hidden");
  ui.chatHeaderContainer.classList.add("hidden");
  ui.currentChatTitleDisplay.textContent = "New chat";
  if (ui.currentChatSubtitleDisplay) {
    ui.currentChatSubtitleDisplay.textContent = "";
    ui.currentChatSubtitleDisplay.classList.add("hidden");
  }

  ui.communityView.classList.add("hidden");
  syncShellView();
  ui.messagesArea.scrollTop = 0;

  renderMessages();
  showWelcome();
  renderSidebar();
  updateSidebarActiveStates();
  ui.chatInput.value = "";
  setChatInputPlaceholder();
  autoResize(ui.chatInput);
  closeSidebar();
}

async function renameChat(chatId, newTitle) {
  if (!chatId || !state.session) {
    return false;
  }

  try {
    const updatedChat = await api.updateChat(chatId, newTitle);
    
    // Update the chat in state
    const chatIndex = state.chats.findIndex((chat) => chat.id === chatId);
    if (chatIndex >= 0) {
      state.chats[chatIndex] = updatedChat;
    }
    
    renderSidebar();
    
    // Update current chat title if it's the active chat
    if (state.currentChatId === chatId) {
      ui.currentChatTitleDisplay.textContent = updatedChat.title;
      setChatHeaderSubtitle(updatedChat.title, updatedChat.preview);
      updateChatHeaderDropdown();
    }
    return true;
  } catch (error) {
    ui.inputHint.textContent = error.message;
    return false;
  }
}

async function toggleChatStar(chatId) {
  if (!chatId || !state.session) {
    return;
  }

  try {
    const updatedChat = await api.toggleStar(chatId);

    const chatIndex = state.chats.findIndex((chat) => chat.id === chatId);
    if (chatIndex >= 0) {
      state.chats[chatIndex] = updatedChat;
    } else {
      state.chats.unshift(updatedChat);
    }

    renderSidebar();
    
    // Update chat header dropdown if it's the current chat
    if (state.currentChatId === chatId) {
      updateChatHeaderDropdown();
    }
  } catch (error) {
    ui.inputHint.textContent = error.message;
  }
}

async function deleteChat(chatId) {
  if (!chatId || !state.session) {
    return;
  }

  try {
    await api.deleteChat(chatId);
    state.chatMessagesCache.delete(chatId);
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

  // Community view — guests can read but must sign in to post
  if (state.activeView === "community") {
    if (!state.session) {
      openModal("login");
      setFormStatus(ui.loginStatus, "Sign in to post in the community.", "info");
      return;
    }
    hideWelcome();
    ui.chatInput.value = "";
    autoResize(ui.chatInput);
    setLoading(true);
    ui.statusPillText.textContent = "Posting";
    try {
      const response = await api.createCommunityPost({
        room: state.currentCommunityRoom,
        content: text
      });
      state.communityPosts.push(response);
      renderCommunityPosts();
      ui.statusPillText.textContent = "Connected";
    } catch (error) {
      ui.inputHint.textContent = error.message;
      ui.statusPillText.textContent = "Request failed";
    } finally {
      setLoading(false);
    }
    return;
  }

  // AI chat — requires Supabase config + session
  if (!hasSupabaseConfig || !supabase) {
    ui.inputHint.textContent =
      "Setup required: configure Supabase credentials in frontend/.env before using sign in and saved chat.";
    return;
  }

  if (!state.session) {
    openModal("login");
    setFormStatus(ui.loginStatus, "Sign in to save and continue.", "info");
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
  cacheChatMessages(state.currentChatId, state.messages);
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
    cacheChatMessages(response.chat.id, state.messages);
    
    ui.currentChatTitleDisplay.textContent = response.chat.title || "Conversation";
    setChatHeaderSubtitle(response.chat.title, response.chat.preview);
    ui.mainHeaderTitle.classList.add("hidden");
    ui.chatHeaderContainer.classList.remove("hidden");

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
    .replace(/^[\-\*] (.+)$/gm, "<li style='margin-bottom:4px;'>$1</li>")
    .replace(/(<li.*<\/li>)/gs, (match) => `<ul style="margin:6px 0;padding-left:20px;">${match}</ul>`)
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

async function legacyLoadCommunityRoom(roomId, title, icon, desc) {
  state.activeView = "community";
  state.currentCommunityRoom = roomId;
  state.communityPosts = [];

  ui.communityIcon.textContent = icon;
  ui.communityTitle.textContent = title;
  ui.communityDesc.textContent = desc;
  ui.chatInput.placeholder = state.session
    ? `Message to ${title}...`
    : `Sign in to post in ${title}...`;

  hideWelcome();
  ui.messagesList.innerHTML = "";
  ui.communityView.classList.remove("hidden");
  ui.mainHeaderTitle.classList.remove("hidden");
  ui.mainHeaderTitle.textContent = title;
  ui.chatHeaderContainer.classList.add("hidden");
  syncShellView();
  ui.messagesArea.scrollTop = 0;

  // Show a loading skeleton while posts are fetched
  ui.communityFeed.innerHTML = `
    <div style="text-align:center; padding: 40px; color: var(--text-muted); font-size: 14px;">
      <div style="display:inline-block; animation: typing 1.2s infinite ease-in-out;">Loading messages…</div>
    </div>
  `;

  updateSidebarActiveStates();
  renderSidebar();

  try {
    const posts = await api.getCommunityPosts(roomId);
    state.communityPosts = posts;
    renderCommunityPosts();
    ui.statusPillText.textContent = "Connected";
    // Show hint based on auth state
    if (!state.session) {
      ui.inputHint.textContent = "Sign in to post messages in the community.";
    } else {
      ui.inputHint.textContent = "Be respectful and helpful to fellow biomedical engineers.";
    }
  } catch (error) {
    ui.communityFeed.innerHTML = `
      <div style="text-align:center; padding: 40px; color: #dc2626; font-size: 14px;">
        Failed to load messages. Please try again.
      </div>
    `;
    ui.statusPillText.textContent = "Load failed";
  }
}

async function loadChat(chatId) {
  console.log("loadChat called with chatId:", chatId);
  if (!chatId) {
    console.log("loadChat: No chatId provided, returning");
    return;
  }

  if (!state.session) {
    openModal("login");
    setFormStatus(ui.loginStatus, "Sign in to view and continue conversations.", "info");
    return;
  }

  const previousChatId = state.currentChatId;
  const wasCommunityView = state.activeView === "community";
  const wasSameActiveChat = state.activeView === "chat" && chatId === state.currentChatId;
  const cachedMessages =
    chatId === state.currentChatId ? cloneMessages(state.messages) : getCachedChatMessages(chatId);
  const cachedSummary = getChatSummary(chatId);

  enterChatView();
  ui.messagesArea.scrollTop = 0;

  if (cachedMessages?.length) {
    state.currentChatId = chatId;
    state.messages = cachedMessages;
    renderActiveChat(cachedSummary);
    scrollToBottom();
    closeSidebar();
    if (wasSameActiveChat || (wasCommunityView && chatId === previousChatId)) {
      return;
    }
  }

  if (!cachedMessages?.length) {
    ui.currentChatTitleDisplay.textContent = cachedSummary?.title || "Conversation";
    setChatHeaderSubtitle(cachedSummary?.title || "", cachedSummary?.preview || "");
    ui.mainHeaderTitle.classList.add("hidden");
    ui.chatHeaderContainer.classList.remove("hidden");
    updateChatHeaderDropdown();
    ui.messagesList.innerHTML = `<div class="view-loading">Loading conversation...</div>`;
  }

  const loadSeq = ++state.chatLoadSeq;

  try {
    const data = await api.getChat(chatId);
    if (loadSeq !== state.chatLoadSeq || state.activeView !== "chat") {
      return;
    }

    state.currentChatId = data.chat.id;
    state.messages = cloneMessages(data.messages);
    cacheChatMessages(data.chat.id, data.messages);
    mergeChatSummary(data.chat);
    renderActiveChat(data.chat);
    scrollToBottom();
    closeSidebar();
  } catch (error) {
    if (loadSeq !== state.chatLoadSeq) {
      return;
    }

    if (cachedMessages?.length) {
      ui.statusPillText.textContent = "Showing saved chat";
      ui.inputHint.textContent = `Unable to refresh this conversation right now: ${error.message}`;
      closeSidebar();
      return;
    }

    console.error("Failed to load chat:", error);
    ui.inputHint.textContent = `Failed to load chat: ${error.message}`;
    ui.statusPillText.textContent = "Load failed";
    ui.messagesList.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #dc2626;">
        <h3>Failed to load conversation</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" style="margin-top: 16px; padding: 8px 16px; background: var(--accent); color: white; border: none; border-radius: 4px; cursor: pointer;">
          Reload Page
        </button>
      </div>
    `;
  }
}

async function loadCommunityRoom(roomId, title, icon, desc) {
  const communityLoadSeq = ++state.communityLoadSeq;
  state.chatLoadSeq += 1;
  state.activeView = "community";
  state.currentCommunityRoom = roomId;
  state.communityPosts = [];

  ui.communityIcon.textContent = icon;
  ui.communityTitle.textContent = title;
  ui.communityDesc.textContent = desc;
  ui.chatInput.placeholder = state.session
    ? `Message to ${title}...`
    : `Sign in to post in ${title}...`;

  hideWelcome();
  ui.messagesList.innerHTML = "";
  ui.communityView.classList.remove("hidden");
  ui.mainHeaderTitle.classList.remove("hidden");
  ui.mainHeaderTitle.textContent = title;
  ui.chatHeaderContainer.classList.add("hidden");
  syncShellView();
  ui.messagesArea.scrollTop = 0;

  ui.communityFeed.innerHTML = `
    <div style="text-align:center; padding: 40px; color: var(--text-muted); font-size: 14px;">
      <div style="display:inline-block; animation: typing 1.2s infinite ease-in-out;">Loading messages...</div>
    </div>
  `;

  updateSidebarActiveStates();
  renderSidebar();

  try {
    const posts = await api.getCommunityPosts(roomId);
    if (
      communityLoadSeq !== state.communityLoadSeq ||
      state.activeView !== "community" ||
      state.currentCommunityRoom !== roomId
    ) {
      return;
    }

    state.communityPosts = posts;
    renderCommunityPosts();
    ui.statusPillText.textContent = "Connected";
    if (!state.session) {
      ui.inputHint.textContent = "Sign in to post messages in the community.";
    } else {
      ui.inputHint.textContent = "Be respectful and helpful to fellow biomedical engineers.";
    }
  } catch (error) {
    if (
      communityLoadSeq !== state.communityLoadSeq ||
      state.activeView !== "community" ||
      state.currentCommunityRoom !== roomId
    ) {
      return;
    }

    ui.communityFeed.innerHTML = `
      <div style="text-align:center; padding: 40px; color: #dc2626; font-size: 14px;">
        Failed to load messages. Please try again.
      </div>
    `;
    ui.statusPillText.textContent = "Load failed";
  }
}

function renderCommunityPosts() {
  if (!state.communityPosts.length) {
    ui.communityFeed.innerHTML = `
      <div style="text-align:center; padding: 40px; color: var(--muted); font-size: 14px;">
        No messages yet. Start the conversation!
      </div>
    `;
    return;
  }
  
  const currentUserId = state.session?.user?.id;
  
  ui.communityFeed.innerHTML = state.communityPosts.map(post => {
    const isOwn = post.user_id === currentUserId;
    const timeStr = new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `
      <div class="chat-bubble-container ${isOwn ? 'own' : 'other'}">
        ${!isOwn ? `<div class="chat-bubble-avatar">${escapeHtml(post.avatar_label)}</div>` : ''}
        <div class="chat-bubble flex-col">
          ${!isOwn ? `
          <div class="chat-bubble-author">${escapeHtml(post.user_name)}</div>` : ''}
          <div class="chat-bubble-content">${formatText(post.content)}</div>
          <div class="chat-bubble-time">${timeStr}</div>
        </div>
      </div>
    `;
  }).join("");
  
  scrollToBottom();
}

function toggleChatDropdown(chatId, dotsButton) {
  closeAllChatDropdowns();
  
  const chatItem = dotsButton.closest(".chat-item");
  const existingDropdown = chatItem.querySelector(".chat-item-dropdown");
  
  if (existingDropdown) {
    existingDropdown.remove();
    return;
  }
  
  const chat = state.chats.find(c => c.id === chatId);
  const isStarred = chat?.starred || false;
  
  const dropdown = document.createElement("div");
  dropdown.className = "chat-item-dropdown";
  dropdown.innerHTML = `
    <button class="dropdown-item" data-action="star" data-chat-id="${escapeHtml(chatId)}">
      <span class="item-icon">${isStarred ? "⭐" : "☆"}</span> ${isStarred ? "Unstar" : "Star"}
    </button>
    <button class="dropdown-item" data-action="rename" data-chat-id="${escapeHtml(chatId)}">
      <span class="item-icon">✏️</span> Rename
    </button>
    <button class="dropdown-item danger" data-action="delete" data-chat-id="${escapeHtml(chatId)}">
      <span class="item-icon">🗑️</span> Delete
    </button>
  `;
  
  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
    const action = e.target.closest("[data-action]")?.dataset.action;
    const targetChatId = e.target.closest("[data-chat-id]")?.dataset.chatId;
    
    if (action && targetChatId) {
      handleChatAction(action, targetChatId);
      dropdown.remove();
    }
  });
  
  chatItem.style.position = "relative";
  chatItem.appendChild(dropdown);
}

function closeAllChatDropdowns() {
  document.querySelectorAll(".chat-item-dropdown").forEach(dropdown => dropdown.remove());
}

function handleChatAction(action, chatId) {
  switch (action) {
    case "star":
      void toggleChatStar(chatId);
      break;
    case "rename":
      const chat = state.chats.find(c => c.id === chatId);
      if (chat) {
        openRenameModal(chatId, chat.title);
      }
      break;
    case "delete":
      showDeleteModal(chatId);
      break;
  }
}

function openRenameModal(chatId, currentTitle) {
  state.renameChatId = chatId;
  ui.renameChatInput.value = currentTitle;
  ui.renameModalBg.classList.remove("hidden");
  ui.renameModalBg.setAttribute("aria-hidden", "false");
  closeAllChatDropdowns();
  ui.chatDropdownMenu.classList.add("hidden");
  ui.chatHeaderContainer.classList.remove("open");
  requestAnimationFrame(() => {
    ui.renameChatInput.focus();
    ui.renameChatInput.select();
  });
}

function closeRenameModal() {
  state.renameChatId = null;
  ui.renameModalBg.classList.add("hidden");
  ui.renameModalBg.setAttribute("aria-hidden", "true");
}

async function submitRenameModal() {
  const chatId = state.renameChatId;
  if (!chatId) return;
  const newTitle = ui.renameChatInput.value.trim();
  if (!newTitle) return;
  const existing = state.chats.find((c) => c.id === chatId);
  if (existing && newTitle === existing.title) {
    closeRenameModal();
    return;
  }
  const ok = await renameChat(chatId, newTitle);
  if (ok) closeRenameModal();
}

function showDeleteModal(chatId) {
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  `;
  
  modalContent.innerHTML = `
    <div style="margin-bottom: 16px;">
      <h3 style="margin: 0; font-size: 18px; color: #1f2937;">Delete Conversation</h3>
    </div>
    <div style="margin-bottom: 24px;">
      <p style="margin: 0; color: #6b7280; line-height: 1.5;">Are you sure you want to delete this conversation?</p>
    </div>
    <div style="display: flex; gap: 12px; justify-content: flex-end;">
      <button id="cancelDelete" style="
        padding: 8px 16px;
        border: 1px solid #d1d5db;
        background: white;
        color: #374151;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      ">Cancel</button>
      <button id="confirmDelete" style="
        padding: 8px 16px;
        border: 1px solid #dc2626;
        background: #dc2626;
        color: white;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      ">Delete</button>
    </div>
  `;
  
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);
  
  // Event listeners
  const cancelBtn = modalContent.querySelector('#cancelDelete');
  const confirmBtn = modalContent.querySelector('#confirmDelete');
  
  const closeModal = () => {
    document.body.removeChild(modalOverlay);
  };
  
  cancelBtn.addEventListener('click', closeModal);
  
  confirmBtn.addEventListener('click', () => {
    closeModal();
    void deleteChat(chatId);
  });
  
  // Close on overlay click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
  
  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

function updateChatHeaderDropdown() {
  if (!state.currentChatId) return;
  
  const chat = state.chats.find(c => c.id === state.currentChatId);
  const isStarred = chat?.starred || false;
  
  ui.btnStarChat.innerHTML = `<span class="item-icon">${isStarred ? "⭐" : "☆"}</span> ${isStarred ? "Unstar" : "Star"}`;
}

function updateSidebarActiveStates() {
  if (ui.btnDiscussion) {
    ui.btnDiscussion.classList.toggle("active", state.activeView === "community" && state.currentCommunityRoom === "discussion");
  }
  if (ui.btnExpertQna) {
    ui.btnExpertQna.classList.toggle("active", state.activeView === "community" && state.currentCommunityRoom === "expert_qna");
  }
  
  // Ensure community view is hidden when in chat view
  if (state.activeView === "chat") {
    ui.communityView.classList.add("hidden");
  }
}
