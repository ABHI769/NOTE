/**
 * SILVERNOTE — Core Application Logic
 * Implements persistent immutable notepad, unique username registry (no password needed),
 * rich text editor, verification gates, and full administrative moderation controls.
 */

(function () {
  'use strict';

  // Master Admin Credentials
  const ADMIN_PASSWORD = 'admin123';

  // LocalStorage Keys
  const STORAGE_KEYS = {
    USERS: 'silvernote_users_v1',
    NOTES: 'silvernote_notes_v1',
    SESSION: 'silvernote_session_v1',
    DEVICE_USER: 'silvernote_device_user_v1'
  };

  // Application State
  let state = {
    currentUser: null,       // Active logged-in username
    isAdmin: false,          // Elevated Admin privileges
    activeFilterUser: 'ALL', // In Admin mode
    activeEditingNoteId: null,
    pendingImageBase64: null,
    pendingAdminDelete: null // Stores { type: 'NOTE'|'CLEAR_USER'|'DELETE_USER', id, targetUser, title }
  };

  /* ==========================================================================
     STORAGE HELPERS
     ========================================================================== */

  function getStoredUsers() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USERS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('Failed to parse users from storage', e);
      return {};
    }
  }

  function saveStoredUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch (e) {
      showToast('Storage capacity exceeded while saving users.', 'error');
    }
  }

  function getStoredNotes() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.NOTES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse notes from storage', e);
      return [];
    }
  }

  function saveStoredNotes(notes) {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    } catch (e) {
      showToast('Storage capacity exceeded. Please remove large images or old notes.', 'error');
    }
  }

  function getStoredSession() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSION);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function saveStoredSession(session) {
    if (!session) {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
    } else {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    }
  }

  // Initialize Sample Data if completely fresh
  function initializeSampleDataIfEmpty() {
    const users = getStoredUsers();
    if (Object.keys(users).length === 0) {
      const initialUsers = {
        'DemoUser': {
          username: 'DemoUser',
          createdAt: new Date().toISOString()
        }
      };
      saveStoredUsers(initialUsers);

      const sampleNotes = [
        {
          id: 'note_' + Date.now(),
          username: 'DemoUser',
          title: 'Welcome to SilverNote Protocol',
          content: '<p>Welcome to <strong>SilverNote</strong>! This system utilizes an <em>append-only immutable archive</em>.</p><p>Key principles of this notepad:</p><ul><li>Once you commit a note, regular users <strong>cannot edit or delete</strong> it.</li><li>Only the system <strong>Administrator</strong> (Password: <code>admin123</code>) holds clearance to modify or erase entries.</li><li>Use the rich-text toolbar to customize fonts, insert images, and add hyperlinks.</li></ul>',
          fontFamily: "'Inter', sans-serif",
          fontSize: '16px',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          updatedAt: null
        }
      ];
      saveStoredNotes(sampleNotes);
    }
  }

  /* ==========================================================================
     DOM ELEMENTS
     ========================================================================== */

  // Sections
  const authSection = document.getElementById('authSection');
  const notepadSection = document.getElementById('notepadSection');

  // Header Elements
  const currentUserBadge = document.getElementById('currentUserBadge');
  const avatarInitial = document.getElementById('avatarInitial');
  const displayUsername = document.getElementById('displayUsername');
  const logoutBtn = document.getElementById('logoutBtn');
  const openAdminModalBtn = document.getElementById('openAdminModalBtn');
  const adminBtnText = document.getElementById('adminBtnText');

  // Auth Form Elements
  const userLoginForm = document.getElementById('userLoginForm');
  const usernameInput = document.getElementById('usernameInput');
  const authStatusMessage = document.getElementById('authStatusMessage');

  // Notepad View Elements
  const bannerUsername = document.getElementById('bannerUsername');
  const noteTitleInput = document.getElementById('noteTitleInput');
  const noteRichEditor = document.getElementById('noteRichEditor');
  const fontSelect = document.getElementById('fontSelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const charCountEl = document.getElementById('charCount');
  const wordCountEl = document.getElementById('wordCount');
  const clearEditorBtn = document.getElementById('clearEditorBtn');
  const submitNoteBtn = document.getElementById('submitNoteBtn');
  const noteSearchInput = document.getElementById('noteSearchInput');
  const notesContainer = document.getElementById('notesContainer');
  const notesCountBadge = document.getElementById('notesCountBadge');

  // Verification Modal Elements
  const verificationModal = document.getElementById('verificationModal');
  const verifyNoteTitle = document.getElementById('verifyNoteTitle');
  const confirmCommitNoteBtn = document.getElementById('confirmCommitNoteBtn');

  // Link Modal Elements
  const linkModal = document.getElementById('linkModal');
  const insertLinkBtn = document.getElementById('insertLinkBtn');
  const linkTextInput = document.getElementById('linkTextInput');
  const linkUrlInput = document.getElementById('linkUrlInput');
  const confirmInsertLinkBtn = document.getElementById('confirmInsertLinkBtn');

  // Image Modal Elements
  const imageModal = document.getElementById('imageModal');
  const insertImageBtn = document.getElementById('insertImageBtn');
  const tabUploadImg = document.getElementById('tabUploadImg');
  const tabUrlImg = document.getElementById('tabUrlImg');
  const uploadImgPanel = document.getElementById('uploadImgPanel');
  const urlImgPanel = document.getElementById('urlImgPanel');
  const dropzoneBox = document.getElementById('dropzoneBox');
  const imageFileInput = document.getElementById('imageFileInput');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const imagePreviewImg = document.getElementById('imagePreviewImg');
  const removeImagePreviewBtn = document.getElementById('removeImagePreviewBtn');
  const imageUrlInput = document.getElementById('imageUrlInput');
  const confirmInsertImageBtn = document.getElementById('confirmInsertImageBtn');

  // Admin Login Modal Elements
  const adminLoginModal = document.getElementById('adminLoginModal');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const adminLoginError = document.getElementById('adminLoginError');
  const submitAdminLoginBtn = document.getElementById('submitAdminLoginBtn');

  // Admin Dashboard Modal Elements
  const adminDashboardModal = document.getElementById('adminDashboardModal');
  const adminExitBtn = document.getElementById('adminExitBtn');
  const refreshAdminDataBtn = document.getElementById('refreshAdminDataBtn');
  const statTotalUsers = document.getElementById('statTotalUsers');
  const statTotalNotes = document.getElementById('statTotalNotes');
  const adminTabUsers = document.getElementById('adminTabUsers');
  const adminTabNotes = document.getElementById('adminTabNotes');
  const adminPanelUsers = document.getElementById('adminPanelUsers');
  const adminPanelNotes = document.getElementById('adminPanelNotes');
  const adminUsersTableBody = document.getElementById('adminUsersTableBody');
  const adminUserFilter = document.getElementById('adminUserFilter');
  const adminNotesFeed = document.getElementById('adminNotesFeed');

  // Admin Edit Modal Elements
  const adminEditModal = document.getElementById('adminEditModal');
  const adminEditAuthor = document.getElementById('adminEditAuthor');
  const adminEditNoteId = document.getElementById('adminEditNoteId');
  const adminEditTitleInput = document.getElementById('adminEditTitleInput');
  const adminEditContentCanvas = document.getElementById('adminEditContentCanvas');
  const saveAdminEditBtn = document.getElementById('saveAdminEditBtn');

  // Admin Confirmation Delete Modal
  const adminConfirmDeleteModal = document.getElementById('adminConfirmDeleteModal');
  const adminDeleteModalHeading = document.getElementById('adminDeleteModalHeading');
  const adminDeleteModalMessage = document.getElementById('adminDeleteModalMessage');
  const adminDeleteTargetPreview = document.getElementById('adminDeleteTargetPreview');
  const adminConfirmDeleteExecuteBtn = document.getElementById('adminConfirmDeleteExecuteBtn');

  // Toast Container
  const toastContainer = document.getElementById('toastContainer');

  /* ==========================================================================
     TOAST NOTIFICATIONS
     ========================================================================== */

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${icon}"></i>
      <span>${escapeHtml(message)}</span>
    `;
    toastContainer.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }

  /* ==========================================================================
     USER AUTHENTICATION LOGIC (NO PASSWORD REQUIRED)
     - User adds username.
     - "No one else should be able to use that username if someone of that name exists"
     - "Only Admin has the access to remove a username if it is made"
     ========================================================================== */

  // Check username availability as user types
  usernameInput.addEventListener('input', () => {
    const rawVal = usernameInput.value.trim();
    if (!rawVal) {
      authStatusMessage.classList.add('hidden');
      return;
    }

    const users = getStoredUsers();
    const currentDeviceUser = localStorage.getItem(STORAGE_KEYS.DEVICE_USER);

    if (users[rawVal]) {
      if (currentDeviceUser === rawVal) {
        authStatusMessage.textContent = `Welcome back! You are the registered owner of "${rawVal}". Click continue to enter.`;
        authStatusMessage.className = 'auth-feedback success';
        authStatusMessage.classList.remove('hidden');
      } else {
        authStatusMessage.textContent = `⚠️ Username "${rawVal}" is already registered! No one else is permitted to use this name.`;
        authStatusMessage.className = 'auth-feedback error';
        authStatusMessage.classList.remove('hidden');
      }
    } else {
      authStatusMessage.textContent = `Username "${rawVal}" is available. Click continue to claim this username.`;
      authStatusMessage.className = 'auth-feedback success';
      authStatusMessage.classList.remove('hidden');
    }
  });

  // Handle User Entry
  userLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawUser = usernameInput.value.trim();

    if (!rawUser) {
      showToast('Please specify a username.', 'error');
      return;
    }

    const users = getStoredUsers();
    const currentDeviceUser = localStorage.getItem(STORAGE_KEYS.DEVICE_USER);

    if (users[rawUser]) {
      // Username already exists: Check if this device owns it
      if (currentDeviceUser === rawUser) {
        // Legitimate owner returning
        state.currentUser = rawUser;
        saveStoredSession({ username: rawUser, isAdmin: state.isAdmin });
        showToast(`Welcome back, ${rawUser}!`, 'success');
        renderAppView();
      } else {
        // Someone else is trying to use an existing username
        showToast(`Username "${rawUser}" is already taken! No one else can use that username. Only the Admin can delete it.`, 'error');
        authStatusMessage.textContent = `❌ Username "${rawUser}" is already in use by another person. Choose a different name.`;
        authStatusMessage.className = 'auth-feedback error';
        authStatusMessage.classList.remove('hidden');
      }
    } else {
      // New Username Registration (No password needed!)
      users[rawUser] = {
        username: rawUser,
        createdAt: new Date().toISOString()
      };
      saveStoredUsers(users);
      localStorage.setItem(STORAGE_KEYS.DEVICE_USER, rawUser);

      state.currentUser = rawUser;
      saveStoredSession({ username: rawUser, isAdmin: state.isAdmin });
      showToast(`Username "${rawUser}" successfully claimed and registered!`, 'success');
      renderAppView();
    }
  });

  // Logout Handler
  logoutBtn.addEventListener('click', () => {
    state.currentUser = null;
    saveStoredSession({ username: null, isAdmin: state.isAdmin });
    renderAppView();
    showToast('Logged out. Your notes remain safely stored.', 'info');
  });

  /* ==========================================================================
     ADMIN AUTHENTICATION & PORTAL LOGIC
     ========================================================================== */

  openAdminModalBtn.addEventListener('click', () => {
    if (state.isAdmin) {
      openAdminDashboard();
    } else {
      adminPasswordInput.value = '';
      adminLoginError.classList.add('hidden');
      openModal(adminLoginModal);
      adminPasswordInput.focus();
    }
  });

  adminLoginForm.addEventListener('submit', handleAdminLoginSubmit);
  submitAdminLoginBtn.addEventListener('click', handleAdminLoginSubmit);

  function handleAdminLoginSubmit(e) {
    if (e) e.preventDefault();
    const enteredPassword = adminPasswordInput.value.trim();

    if (enteredPassword === ADMIN_PASSWORD) {
      state.isAdmin = true;
      saveStoredSession({ username: state.currentUser, isAdmin: true });
      closeModal(adminLoginModal);
      showToast('Admin clearance verified.', 'success');
      updateAdminButtonBadge();
      renderAppView(); // Refresh main view to show Admin Delete buttons if on notes view
      openAdminDashboard();
    } else {
      adminLoginError.classList.remove('hidden');
      adminPasswordInput.focus();
      showToast('Incorrect Admin password.', 'error');
    }
  }

  adminExitBtn.addEventListener('click', () => {
    state.isAdmin = false;
    saveStoredSession({ username: state.currentUser, isAdmin: false });
    closeModal(adminDashboardModal);
    updateAdminButtonBadge();
    renderAppView();
    showToast('Exited Admin Mode.', 'info');
  });

  function updateAdminButtonBadge() {
    if (state.isAdmin) {
      adminBtnText.textContent = 'Admin Control Panel 🛡️';
      openAdminModalBtn.classList.add('warning-btn');
    } else {
      adminBtnText.textContent = 'Admin Portal';
      openAdminModalBtn.classList.remove('warning-btn');
    }
  }

  function openAdminDashboard() {
    renderAdminStats();
    renderAdminUsersTable();
    populateAdminUserFilter();
    renderAdminNotesFeed();
    openModal(adminDashboardModal);
  }

  refreshAdminDataBtn.addEventListener('click', () => {
    renderAdminStats();
    renderAdminUsersTable();
    populateAdminUserFilter();
    renderAdminNotesFeed();
    showToast('Admin data refreshed.', 'info');
  });

  // Admin Tab Navigation
  adminTabUsers.addEventListener('click', () => {
    adminTabUsers.classList.add('active');
    adminTabNotes.classList.remove('active');
    adminPanelUsers.classList.remove('hidden');
    adminPanelNotes.classList.add('hidden');
  });

  adminTabNotes.addEventListener('click', () => {
    adminTabNotes.classList.add('active');
    adminTabUsers.classList.remove('active');
    adminPanelNotes.classList.remove('hidden');
    adminPanelUsers.classList.add('hidden');
    renderAdminNotesFeed();
  });

  function renderAdminStats() {
    const users = getStoredUsers();
    const notes = getStoredNotes();
    statTotalUsers.textContent = Object.keys(users).length;
    statTotalNotes.textContent = notes.length;
  }

  /* ==========================================================================
     ADMIN USERS TABLE (CLEAR NOTES & DELETE USERNAME)
     ========================================================================== */

  function renderAdminUsersTable() {
    const users = getStoredUsers();
    const notes = getStoredNotes();
    const userList = Object.values(users);

    adminUsersTableBody.innerHTML = '';

    if (userList.length === 0) {
      adminUsersTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--silver-600); padding: 2rem;">No registered users found.</td></tr>`;
      return;
    }

    userList.forEach(u => {
      const userNotes = notes.filter(n => n.username === u.username);
      const joinedDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="table-username">
            <span class="table-user-dot"></span>
            <strong>${escapeHtml(u.username)}</strong>
          </div>
        </td>
        <td>${joinedDate}</td>
        <td><strong>${userNotes.length}</strong> note${userNotes.length === 1 ? '' : 's'}</td>
        <td>
          <button type="button" class="btn-silver-outline btn-sm admin-clear-notes-btn" data-username="${escapeHtml(u.username)}" ${userNotes.length === 0 ? 'disabled' : ''}>
            <i data-lucide="trash"></i>
            <span>Clear All Notes (${userNotes.length})</span>
          </button>
        </td>
        <td>
          <button type="button" class="btn-silver-solid btn-sm admin-delete-user-btn" data-username="${escapeHtml(u.username)}" style="background: #fee2e2; border-color: #fca5a5; color: #991b1b;">
            <i data-lucide="user-x"></i>
            <span>Delete Username & All Data</span>
          </button>
        </td>
      `;
      adminUsersTableBody.appendChild(tr);
    });

    if (window.lucide) lucide.createIcons();
  }

  // Event Delegation for Admin Users Table actions (Reliable click handling)
  adminUsersTableBody.addEventListener('click', (e) => {
    const clearNotesBtn = e.target.closest('.admin-clear-notes-btn');
    if (clearNotesBtn && !clearNotesBtn.disabled) {
      const targetUser = clearNotesBtn.dataset.username;
      openDeleteConfirmation('CLEAR_USER', null, targetUser, `All notes belonging to "${targetUser}"`);
      return;
    }

    const deleteUserBtn = e.target.closest('.admin-delete-user-btn');
    if (deleteUserBtn) {
      const targetUser = deleteUserBtn.dataset.username;
      openDeleteConfirmation('DELETE_USER', null, targetUser, `User "${targetUser}" and ALL of their archived notes`);
      return;
    }
  });

  /* ==========================================================================
     ADMIN MASTER NOTES FEED & MODERATION
     ========================================================================== */

  function populateAdminUserFilter() {
    const users = getStoredUsers();
    const selected = adminUserFilter.value;
    adminUserFilter.innerHTML = '<option value="ALL">All Users</option>';
    Object.keys(users).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      if (u === selected) opt.selected = true;
      adminUserFilter.appendChild(opt);
    });
  }

  adminUserFilter.addEventListener('change', () => {
    state.activeFilterUser = adminUserFilter.value;
    renderAdminNotesFeed();
  });

  function renderAdminNotesFeed() {
    const notes = getStoredNotes();
    const filter = state.activeFilterUser || 'ALL';

    const filtered = filter === 'ALL' ? notes : notes.filter(n => n.username === filter);

    adminNotesFeed.innerHTML = '';

    if (filtered.length === 0) {
      adminNotesFeed.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i data-lucide="folder-open" class="empty-state-icon"></i>
          <h3>No Notes Found</h3>
          <p>No notes exist under filter "${filter}".</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    filtered.forEach(note => {
      const card = document.createElement('div');
      card.className = 'admin-note-card';
      const createdDate = new Date(note.createdAt).toLocaleString();
      const updatedDate = note.updatedAt ? ` • Modified: ${new Date(note.updatedAt).toLocaleTimeString()}` : '';

      card.innerHTML = `
        <div>
          <div class="admin-note-header">
            <div>
              <span class="admin-note-author">Author: ${escapeHtml(note.username)}</span>
              <h4 style="font-size: 1.1rem; font-weight: 700; margin-top: 0.2rem;">${escapeHtml(note.title || 'Untitled Note')}</h4>
            </div>
            <span class="lock-badge"><i data-lucide="shield"></i> Managed</span>
          </div>
          <div class="admin-note-body" style="font-family: ${note.fontFamily || 'inherit'}; font-size: ${note.fontSize || '15px'};">
            ${note.content || '<em>(Empty Content)</em>'}
          </div>
        </div>
        <div>
          <div style="font-size: 0.72rem; color: var(--silver-600); margin-bottom: 0.5rem;">
            Added: ${createdDate}${updatedDate}
          </div>
          <div class="admin-card-actions">
            <button type="button" class="btn-silver-solid btn-sm admin-edit-note-btn" data-id="${note.id}">
              <i data-lucide="edit-3"></i>
              <span>Admin Edit</span>
            </button>
            <button type="button" class="btn-silver-outline btn-sm admin-delete-single-note-btn" data-id="${note.id}" data-title="${escapeHtml(note.title || 'Untitled Note')}" style="color: #991b1b; border-color: #fca5a5;">
              <i data-lucide="trash-2"></i>
              <span>Delete Note</span>
            </button>
          </div>
        </div>
      `;
      adminNotesFeed.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  }

  // Event Delegation for Admin Notes Feed (Captures Delete & Edit clicks 100% reliably)
  adminNotesFeed.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.admin-delete-single-note-btn');
    if (deleteBtn) {
      const noteId = deleteBtn.dataset.id;
      const noteTitle = deleteBtn.dataset.title;
      openDeleteConfirmation('NOTE', noteId, null, noteTitle);
      return;
    }

    const editBtn = e.target.closest('.admin-edit-note-btn');
    if (editBtn) {
      const noteId = editBtn.dataset.id;
      openAdminEditModal(noteId);
      return;
    }
  });

  // Event Delegation for Main Notepad Container (Note Reordering & Admin Deletion)
  notesContainer.addEventListener('click', (e) => {
    const moveBtn = e.target.closest('.btn-note-move');
    if (moveBtn && !moveBtn.disabled) {
      const noteId = moveBtn.dataset.id;
      const direction = moveBtn.dataset.move;
      moveNote(noteId, direction);
      return;
    }

    const mainViewDelBtn = e.target.closest('.main-view-admin-delete-btn');
    if (mainViewDelBtn) {
      const noteId = mainViewDelBtn.dataset.id;
      const noteTitle = mainViewDelBtn.dataset.title;
      openDeleteConfirmation('NOTE', noteId, null, noteTitle);
    }
  });

  /* ==========================================================================
     IN-APP CONFIRMATION MODAL LOGIC (NEVER FAILS / NO NATIVE CONFIRM BUG)
     ========================================================================== */

  function openDeleteConfirmation(type, noteId, targetUser, previewText) {
    state.pendingAdminDelete = { type, noteId, targetUser };

    if (type === 'NOTE') {
      adminDeleteModalHeading.textContent = 'Confirm Note Deletion';
      adminDeleteModalMessage.innerHTML = 'Are you sure you want to <strong>permanently delete</strong> this note? As Admin, this action cannot be undone.';
      adminDeleteTargetPreview.innerHTML = `
        <span class="summary-label">Target Note:</span>
        <div class="summary-title">${escapeHtml(previewText || 'Untitled Note')}</div>
      `;
    } else if (type === 'CLEAR_USER') {
      adminDeleteModalHeading.textContent = 'Clear All User Notes';
      adminDeleteModalMessage.innerHTML = `Are you sure you want to <strong>delete all notes</strong> created by <strong>${escapeHtml(targetUser)}</strong>? The user account will remain.`;
      adminDeleteTargetPreview.innerHTML = `
        <span class="summary-label">Target User:</span>
        <div class="summary-title">${escapeHtml(targetUser)}</div>
      `;
    } else if (type === 'DELETE_USER') {
      adminDeleteModalHeading.textContent = 'Permanently Delete Username';
      adminDeleteModalMessage.innerHTML = `<strong>HIGH-RISK ACTION:</strong> Are you sure you want to delete user <strong>"${escapeHtml(targetUser)}"</strong>? This will permanently erase the username AND all notes written under it!`;
      adminDeleteTargetPreview.innerHTML = `
        <span class="summary-label">Target Account & Notes:</span>
        <div class="summary-title">${escapeHtml(targetUser)} (Full Wipe)</div>
      `;
    }

    openModal(adminConfirmDeleteModal);
  }

  // Execute Confirmed Admin Delete Action
  adminConfirmDeleteExecuteBtn.addEventListener('click', () => {
    if (!state.pendingAdminDelete) return;

    const { type, noteId, targetUser } = state.pendingAdminDelete;

    if (type === 'NOTE') {
      let notes = getStoredNotes();
      const initialCount = notes.length;
      notes = notes.filter(n => n.id !== noteId);
      saveStoredNotes(notes);

      showToast('Note permanently deleted by Administrator.', 'success');
    } else if (type === 'CLEAR_USER') {
      let notes = getStoredNotes();
      notes = notes.filter(n => n.username !== targetUser);
      saveStoredNotes(notes);

      showToast(`All notes for user "${targetUser}" have been cleared.`, 'success');
    } else if (type === 'DELETE_USER') {
      // 1. Remove all notes for this user
      let notes = getStoredNotes();
      notes = notes.filter(n => n.username !== targetUser);
      saveStoredNotes(notes);

      // 2. Remove user from users registry
      const users = getStoredUsers();
      delete users[targetUser];
      saveStoredUsers(users);

      // 3. Clear device user if it was this user
      if (localStorage.getItem(STORAGE_KEYS.DEVICE_USER) === targetUser) {
        localStorage.removeItem(STORAGE_KEYS.DEVICE_USER);
      }

      showToast(`User "${targetUser}" and all notes deleted successfully.`, 'success');

      // 4. If current logged in user was this deleted user, log out
      if (state.currentUser === targetUser) {
        state.currentUser = null;
        saveStoredSession({ username: null, isAdmin: state.isAdmin });
        renderAppView();
      }
    }

    // Reset pending action and close modal
    state.pendingAdminDelete = null;
    closeModal(adminConfirmDeleteModal);

    // Refresh all views
    renderAdminStats();
    renderAdminUsersTable();
    populateAdminUserFilter();
    renderAdminNotesFeed();

    if (state.currentUser) {
      renderUserNotes();
    }
  });

  /* ==========================================================================
     ADMIN EDIT NOTE MODAL
     ========================================================================== */

  function openAdminEditModal(noteId) {
    const notes = getStoredNotes();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    state.activeEditingNoteId = noteId;
    adminEditAuthor.textContent = note.username;
    adminEditNoteId.textContent = note.id;
    adminEditTitleInput.value = note.title || '';
    adminEditContentCanvas.innerHTML = note.content || '';

    openModal(adminEditModal);
  }

  saveAdminEditBtn.addEventListener('click', () => {
    if (!state.activeEditingNoteId) return;

    const notes = getStoredNotes();
    const noteIndex = notes.findIndex(n => n.id === state.activeEditingNoteId);
    if (noteIndex === -1) return;

    const newTitle = adminEditTitleInput.value.trim() || 'Untitled Note';
    const newContent = adminEditContentCanvas.innerHTML;

    notes[noteIndex].title = newTitle;
    notes[noteIndex].content = newContent;
    notes[noteIndex].updatedAt = new Date().toISOString();

    saveStoredNotes(notes);
    closeModal(adminEditModal);
    showToast('Note modified successfully by Admin.', 'success');

    renderAdminNotesFeed();
    if (state.currentUser) {
      renderUserNotes();
    }
  });

  /* ==========================================================================
     RICH TEXT EDITOR & FORMATTING CONTROLS
     ========================================================================== */

  // Execute standard formatting commands
  document.querySelectorAll('.tool-btn[data-command]').forEach(btn => {
    btn.addEventListener('click', () => {
      const command = btn.dataset.command;
      document.execCommand(command, false, null);
      noteRichEditor.focus();
    });
  });

  // Font Family Selector
  fontSelect.addEventListener('change', () => {
    const chosenFont = fontSelect.value;
    noteRichEditor.style.fontFamily = chosenFont;
    document.execCommand('fontName', false, chosenFont);
    noteRichEditor.focus();
  });

  // Font Size Selector
  fontSizeSelect.addEventListener('change', () => {
    const chosenSize = fontSizeSelect.value;
    noteRichEditor.style.fontSize = chosenSize;
    noteRichEditor.focus();
  });

  // Clear Formatting
  document.getElementById('clearFormatBtn').addEventListener('click', () => {
    document.execCommand('removeFormat', false, null);
    noteRichEditor.focus();
  });

  // Reorder Content Blocks Inside Note Editor (Move Above or Below)
  function getSelectedBlockElement() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node = sel.anchorNode;
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }
    while (node && node.parentNode && node.parentNode !== noteRichEditor && node !== noteRichEditor) {
      node = node.parentNode;
    }
    return (node && node.parentNode === noteRichEditor) ? node : null;
  }

  function moveEditorBlock(direction) {
    let block = getSelectedBlockElement();
    if (!block) {
      const firstChild = noteRichEditor.firstElementChild;
      if (!firstChild) {
        showToast('Type some text or insert an image first to move it.', 'info');
        return;
      }
      block = firstChild;
    }

    if (direction === 'up') {
      const prev = block.previousElementSibling;
      if (prev) {
        noteRichEditor.insertBefore(block, prev);
        block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showToast('Content moved above.', 'info');
      } else {
        showToast('Already at the top of the note.', 'info');
      }
    } else if (direction === 'down') {
      const next = block.nextElementSibling;
      if (next) {
        noteRichEditor.insertBefore(next, block);
        block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        showToast('Content moved below.', 'info');
      } else {
        showToast('Already at the bottom of the note.', 'info');
      }
    }
    updateEditorStats();
  }

  const moveBlockUpBtn = document.getElementById('moveBlockUpBtn');
  const moveBlockDownBtn = document.getElementById('moveBlockDownBtn');
  if (moveBlockUpBtn) moveBlockUpBtn.addEventListener('click', () => moveEditorBlock('up'));
  if (moveBlockDownBtn) moveBlockDownBtn.addEventListener('click', () => moveEditorBlock('down'));

  // Keyboard shortcut: Alt+Up and Alt+Down to move blocks
  noteRichEditor.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      moveEditorBlock('up');
    } else if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      moveEditorBlock('down');
    }
  });

  // Live Stats Counter (Words & Characters)
  noteRichEditor.addEventListener('input', updateEditorStats);

  function updateEditorStats() {
    const text = noteRichEditor.innerText || '';
    const charCount = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    charCountEl.textContent = `${charCount} character${charCount === 1 ? '' : 's'}`;
    wordCountEl.textContent = `${words} word${words === 1 ? '' : 's'}`;
  }

  // Reset Canvas Button
  clearEditorBtn.addEventListener('click', () => {
    noteTitleInput.value = '';
    noteRichEditor.innerHTML = '';
    updateEditorStats();
    showToast('Editor canvas cleared.', 'info');
  });

  /* ==========================================================================
     HYPERLINK MODAL LOGIC
     ========================================================================== */

  let savedEditorSelection = null;

  function saveSelection() {
    if (window.getSelection) {
      const sel = window.getSelection();
      if (sel.getRangeAt && sel.rangeCount) {
        return sel.getRangeAt(0);
      }
    }
    return null;
  }

  function restoreSelection(range) {
    if (range && window.getSelection) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  insertLinkBtn.addEventListener('click', () => {
    savedEditorSelection = saveSelection();
    linkTextInput.value = '';
    linkUrlInput.value = 'https://';
    openModal(linkModal);
    linkUrlInput.focus();
  });

  confirmInsertLinkBtn.addEventListener('click', () => {
    const url = linkUrlInput.value.trim();
    const text = linkTextInput.value.trim();

    if (!url || url === 'https://') {
      showToast('Please provide a valid URL.', 'error');
      return;
    }

    restoreSelection(savedEditorSelection);
    noteRichEditor.focus();

    if (text) {
      const linkHtml = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
      document.execCommand('insertHTML', false, linkHtml);
    } else {
      document.execCommand('createLink', false, url);
    }

    closeModal(linkModal);
    updateEditorStats();
  });

  /* ==========================================================================
     IMAGE INSERTION (UPLOAD & URL) LOGIC
     ========================================================================== */

  insertImageBtn.addEventListener('click', () => {
    savedEditorSelection = saveSelection();
    state.pendingImageBase64 = null;
    imagePreviewContainer.classList.add('hidden');
    imageUrlInput.value = '';
    imageFileInput.value = '';
    openModal(imageModal);
  });

  tabUploadImg.addEventListener('click', () => {
    tabUploadImg.classList.add('active');
    tabUrlImg.classList.remove('active');
    uploadImgPanel.classList.remove('hidden');
    urlImgPanel.classList.add('hidden');
  });

  tabUrlImg.addEventListener('click', () => {
    tabUrlImg.classList.add('active');
    tabUploadImg.classList.remove('active');
    urlImgPanel.classList.remove('hidden');
    uploadImgPanel.classList.add('hidden');
  });

  // Dropzone click & drag handlers
  dropzoneBox.addEventListener('click', () => imageFileInput.click());

  dropzoneBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzoneBox.style.borderColor = 'var(--text-primary)';
  });

  dropzoneBox.addEventListener('dragleave', () => {
    dropzoneBox.style.borderColor = 'var(--border-strong)';
  });

  dropzoneBox.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzoneBox.style.borderColor = 'var(--border-strong)';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  });

  imageFileInput.addEventListener('change', () => {
    if (imageFileInput.files && imageFileInput.files[0]) {
      handleImageFile(imageFileInput.files[0]);
    }
  });

  function handleImageFile(file) {
    if (!file.type.startsWith('image/')) {
      showToast('Selected file must be an image.', 'error');
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      showToast('Image file too large for browser storage. Please select an image under 1.5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      state.pendingImageBase64 = e.target.result;
      imagePreviewImg.src = state.pendingImageBase64;
      imagePreviewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  removeImagePreviewBtn.addEventListener('click', () => {
    state.pendingImageBase64 = null;
    imagePreviewImg.src = '';
    imageFileInput.value = '';
    imagePreviewContainer.classList.add('hidden');
  });

  confirmInsertImageBtn.addEventListener('click', () => {
    let imgSrc = null;
    if (tabUploadImg.classList.contains('active')) {
      if (!state.pendingImageBase64) {
        showToast('Please select an image file first.', 'error');
        return;
      }
      imgSrc = state.pendingImageBase64;
    } else {
      const url = imageUrlInput.value.trim();
      if (!url) {
        showToast('Please enter an image URL.', 'error');
        return;
      }
      imgSrc = url;
    }

    restoreSelection(savedEditorSelection);
    noteRichEditor.focus();

    const imgHtml = `<p><img src="${imgSrc}" alt="Embedded image" style="max-width: 100%; border-radius: 8px; border: 1px solid #cbd3dc;" /></p><p></p>`;
    document.execCommand('insertHTML', false, imgHtml);

    closeModal(imageModal);
    updateEditorStats();
    showToast('Image inserted into note.', 'success');
  });

  /* ==========================================================================
     USER NOTE CREATION & VERIFICATION GATEWAY
     "WHEN USER WILL ADD DATA THEN WE WILL VERIFY WHETHER HE WANT TO ADD IT 
      BECAUSE HE CANT DELETE IT AFTERWARDS HE NEED ADMIN TO DO IT."
     ========================================================================== */

  submitNoteBtn.addEventListener('click', () => {
    const title = noteTitleInput.value.trim();
    const textLength = noteRichEditor.innerText.trim().length;

    if (textLength === 0 && !noteRichEditor.querySelector('img')) {
      showToast('Please enter some text or insert an image before saving.', 'error');
      return;
    }

    verifyNoteTitle.textContent = title || 'Untitled Note';
    openModal(verificationModal);
  });

  confirmCommitNoteBtn.addEventListener('click', () => {
    if (!state.currentUser) {
      showToast('Session expired. Please enter your username again.', 'error');
      closeModal(verificationModal);
      return;
    }

    const title = noteTitleInput.value.trim() || 'Untitled Note';
    const content = noteRichEditor.innerHTML;
    const fontFamily = fontSelect.value;
    const fontSize = fontSizeSelect.value;

    const newNote = {
      id: 'note_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      username: state.currentUser,
      title: title,
      content: content,
      fontFamily: fontFamily,
      fontSize: fontSize,
      createdAt: new Date().toISOString(),
      updatedAt: null
    };

    const notes = getStoredNotes();
    notes.unshift(newNote);
    saveStoredNotes(notes);

    // Clear editor
    noteTitleInput.value = '';
    noteRichEditor.innerHTML = '';
    updateEditorStats();

    closeModal(verificationModal);
    showToast('Note permanently committed to your archive.', 'success');
    renderUserNotes();
  });

  /* ==========================================================================
     USER NOTES ARCHIVE (REORDERABLE, IMMUTABLE CONTENT, ADMIN MODERATION)
     ========================================================================== */

  noteSearchInput.addEventListener('input', renderUserNotes);

  // Move note directly above or below
  function moveNote(noteId, direction) {
    const allNotes = getStoredNotes();
    const userNotes = allNotes.filter(n => n.username === state.currentUser);
    const userIdx = userNotes.findIndex(n => n.id === noteId);
    if (userIdx === -1) return;

    const targetUserIdx = direction === 'up' ? userIdx - 1 : userIdx + 1;
    if (targetUserIdx < 0 || targetUserIdx >= userNotes.length) return;

    const currentNote = userNotes[userIdx];
    const targetNote = userNotes[targetUserIdx];

    const allCurrentIdx = allNotes.findIndex(n => n.id === currentNote.id);
    const allTargetIdx = allNotes.findIndex(n => n.id === targetNote.id);

    if (allCurrentIdx !== -1 && allTargetIdx !== -1) {
      allNotes[allCurrentIdx] = targetNote;
      allNotes[allTargetIdx] = currentNote;
      saveStoredNotes(allNotes);
      renderUserNotes();
      showToast(direction === 'up' ? 'Note moved above.' : 'Note moved below.', 'success');
    }
  }

  // Reorder note by drag & drop
  function reorderNote(draggedId, targetId, insertBefore) {
    if (!draggedId || !targetId || draggedId === targetId) return;
    const allNotes = getStoredNotes();
    const draggedIdx = allNotes.findIndex(n => n.id === draggedId);
    if (draggedIdx === -1) return;

    const [draggedNote] = allNotes.splice(draggedIdx, 1);
    const targetIdx = allNotes.findIndex(n => n.id === targetId);
    if (targetIdx === -1) {
      allNotes.push(draggedNote);
    } else {
      const insertIdx = insertBefore ? targetIdx : targetIdx + 1;
      allNotes.splice(insertIdx, 0, draggedNote);
    }

    saveStoredNotes(allNotes);
    renderUserNotes();
    showToast('Note repositioned successfully.', 'success');
  }

  function renderUserNotes() {
    if (!state.currentUser) return;

    const allNotes = getStoredNotes();
    const userNotes = allNotes.filter(n => n.username === state.currentUser);
    const searchQuery = noteSearchInput.value.trim().toLowerCase();

    const filtered = userNotes.filter(n => {
      const matchTitle = (n.title || '').toLowerCase().includes(searchQuery);
      const matchContent = (n.content || '').toLowerCase().includes(searchQuery);
      return matchTitle || matchContent;
    });

    notesCountBadge.textContent = `${userNotes.length} Note${userNotes.length === 1 ? '' : 's'}`;
    notesContainer.innerHTML = '';

    if (filtered.length === 0) {
      notesContainer.innerHTML = `
        <div class="empty-state">
          <i data-lucide="file-question" class="empty-state-icon"></i>
          <h3>${userNotes.length === 0 ? 'No Notes Recorded Yet' : 'No Matching Notes'}</h3>
          <p>${userNotes.length === 0 ? 'Your archive is empty. Write your thoughts above and commit them.' : 'Try adjusting your search keywords.'}</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    filtered.forEach((note, index) => {
      const card = document.createElement('article');
      card.className = 'note-card';
      card.setAttribute('data-id', note.id);
      card.setAttribute('draggable', 'true');

      const isFirst = index === 0;
      const isLast = index === filtered.length - 1;

      const dateStr = new Date(note.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const updatedStr = note.updatedAt ? ` • Edited by Admin: ${new Date(note.updatedAt).toLocaleDateString()}` : '';

      card.innerHTML = `
        <header class="note-card-header">
          <div class="note-header-left">
            <div class="note-drag-handle" title="Drag to move note above or below" aria-label="Drag handle">
              <i data-lucide="grip-vertical"></i>
            </div>
            <span class="note-order-pill">#${index + 1}</span>
            <h3 class="note-card-title">${escapeHtml(note.title)}</h3>
          </div>
          <div class="note-card-meta">
            <!-- Move Note Above or Below Controls -->
            <div class="note-reorder-controls" role="group" aria-label="Move note">
              <button type="button" class="btn-note-move" data-move="up" data-id="${note.id}" title="Move Note Above" ${isFirst ? 'disabled' : ''} aria-label="Move note above">
                <i data-lucide="arrow-up"></i>
              </button>
              <button type="button" class="btn-note-move" data-move="down" data-id="${note.id}" title="Move Note Below" ${isLast ? 'disabled' : ''} aria-label="Move note below">
                <i data-lucide="arrow-down"></i>
              </button>
            </div>
            ${state.isAdmin ? `
              <button type="button" class="btn-silver-outline btn-sm main-view-admin-delete-btn" data-id="${note.id}" data-title="${escapeHtml(note.title)}" style="color: #991b1b; border-color: #fca5a5;">
                <i data-lucide="trash-2"></i>
                <span>Admin Delete</span>
              </button>
            ` : `
              <span class="lock-badge" title="Users cannot modify or delete saved notes">
                <i data-lucide="lock"></i>
                <span>Locked</span>
              </span>
            `}
          </div>
        </header>

        <div class="note-card-body" style="font-family: ${note.fontFamily || 'inherit'}; font-size: ${note.fontSize || '16px'};">
          ${note.content}
        </div>

        <footer class="note-card-footer">
          <span class="note-owner">
            <i data-lucide="user-check"></i>
            <span>${escapeHtml(note.username)}</span>
          </span>
          <span class="note-time">${dateStr}${updatedStr}</span>
        </footer>
      `;

      notesContainer.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  }

  /* HTML5 & Touch Drag-and-Drop Reordering */
  let draggedCardId = null;

  notesContainer.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.note-card');
    if (!card) return;
    draggedCardId = card.dataset.id;
    card.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedCardId);
    }
  });

  notesContainer.addEventListener('dragend', (e) => {
    const card = e.target.closest('.note-card');
    if (card) card.classList.remove('dragging');
    document.querySelectorAll('.note-card').forEach(c => {
      c.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    draggedCardId = null;
  });

  notesContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    const targetCard = e.target.closest('.note-card');
    if (!targetCard || targetCard.dataset.id === draggedCardId) return;

    const rect = targetCard.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const isAbove = e.clientY < midpoint;

    targetCard.classList.toggle('drag-over-top', isAbove);
    targetCard.classList.toggle('drag-over-bottom', !isAbove);
  });

  notesContainer.addEventListener('dragleave', (e) => {
    const targetCard = e.target.closest('.note-card');
    if (targetCard) {
      targetCard.classList.remove('drag-over-top', 'drag-over-bottom');
    }
  });

  notesContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const targetCard = e.target.closest('.note-card');
    if (!targetCard || !draggedCardId || targetCard.dataset.id === draggedCardId) return;

    const rect = targetCard.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertBefore = e.clientY < midpoint;

    targetCard.classList.remove('drag-over-top', 'drag-over-bottom');
    reorderNote(draggedCardId, targetCard.dataset.id, insertBefore);
  });

  // Mobile Touch Drag-and-Drop Support
  let touchDraggedCard = null;
  let touchTargetCard = null;
  let touchInsertBefore = true;

  notesContainer.addEventListener('touchstart', (e) => {
    const handle = e.target.closest('.note-drag-handle');
    if (!handle) return;
    const card = handle.closest('.note-card');
    if (!card) return;

    touchDraggedCard = card;
    card.classList.add('dragging');
  }, { passive: true });

  notesContainer.addEventListener('touchmove', (e) => {
    if (!touchDraggedCard) return;
    const touch = e.touches[0];
    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const cardBelow = elemBelow ? elemBelow.closest('.note-card') : null;

    document.querySelectorAll('.note-card').forEach(c => {
      if (c !== touchDraggedCard) c.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    if (cardBelow && cardBelow !== touchDraggedCard) {
      touchTargetCard = cardBelow;
      const rect = cardBelow.getBoundingClientRect();
      touchInsertBefore = touch.clientY < (rect.top + rect.height / 2);
      cardBelow.classList.toggle('drag-over-top', touchInsertBefore);
      cardBelow.classList.toggle('drag-over-bottom', !touchInsertBefore);
    } else {
      touchTargetCard = null;
    }
  }, { passive: true });

  notesContainer.addEventListener('touchend', () => {
    if (touchDraggedCard) {
      touchDraggedCard.classList.remove('dragging');
      if (touchTargetCard && touchDraggedCard.dataset.id !== touchTargetCard.dataset.id) {
        reorderNote(touchDraggedCard.dataset.id, touchTargetCard.dataset.id, touchInsertBefore);
      }
      document.querySelectorAll('.note-card').forEach(c => {
        c.classList.remove('drag-over-top', 'drag-over-bottom');
      });
      touchDraggedCard = null;
      touchTargetCard = null;
    }
  });

  /* ==========================================================================
     MODAL CONTROLLERS
     ========================================================================== */

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (window.lucide) lucide.createIcons();
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    document.body.style.overflow = '';
  }

  // Handle all modal close buttons with data-close-modal attribute
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close-modal');
      const targetModal = document.getElementById(targetId);
      closeModal(targetModal);
    });
  });

  // Close modals when clicking backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });

  // Escape key closes open modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
        closeModal(modal);
      });
    }
  });

  /* ==========================================================================
     APP VIEW ROUTING & INITIALIZATION
     ========================================================================== */

  /* ==========================================================================
     LIGHT GRADIENT THEME CONTROLLER
     ========================================================================== */

  const THEME_STORAGE_KEY = 'silvernote_gradient_theme_v1';
  const THEME_NAMES = {
    aurora: 'Aurora Pastel',
    sunset: 'Sunset Glow',
    ocean: 'Ocean Breeze',
    lilac: 'Lilac Dream'
  };

  function applyTheme(themeKey) {
    if (!THEME_NAMES[themeKey]) themeKey = 'aurora';
    document.documentElement.setAttribute('data-theme', themeKey);
    localStorage.setItem(THEME_STORAGE_KEY, themeKey);

    const activeThemeNameEl = document.getElementById('activeThemeName');
    if (activeThemeNameEl) {
      activeThemeNameEl.textContent = THEME_NAMES[themeKey].split(' ')[0];
    }

    // Update active class on dropdown buttons
    document.querySelectorAll('.theme-opt-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeVal === themeKey);
    });
  }

  function initThemePicker() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'aurora';
    applyTheme(savedTheme);

    const themePickerBtn = document.getElementById('themePickerBtn');
    const themeDropdown = document.getElementById('themeDropdown');

    if (themePickerBtn && themeDropdown) {
      themePickerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !themeDropdown.classList.contains('hidden');
        themeDropdown.classList.toggle('hidden');
        themePickerBtn.setAttribute('aria-expanded', !isOpen);
      });

      document.querySelectorAll('.theme-opt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const selected = btn.dataset.themeVal;
          applyTheme(selected);
          themeDropdown.classList.add('hidden');
          themePickerBtn.setAttribute('aria-expanded', 'false');
          showToast(`Applied ${THEME_NAMES[selected]} theme`, 'success');
        });
      });

      document.addEventListener('click', (e) => {
        if (!themeDropdown.classList.contains('hidden') && !e.target.closest('#themePickerContainer')) {
          themeDropdown.classList.add('hidden');
          themePickerBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }

  function renderAppView() {
    updateAdminButtonBadge();

    if (state.currentUser) {
      // User is logged in
      authSection.classList.add('hidden');
      notepadSection.classList.remove('hidden');

      currentUserBadge.classList.remove('hidden');
      avatarInitial.textContent = state.currentUser.charAt(0).toUpperCase();
      displayUsername.textContent = state.currentUser;
      bannerUsername.textContent = state.currentUser;

      renderUserNotes();
    } else {
      // No active user login
      authSection.classList.remove('hidden');
      notepadSection.classList.add('hidden');
      currentUserBadge.classList.add('hidden');
      usernameInput.value = '';
      authStatusMessage.classList.add('hidden');
    }

    if (window.lucide) lucide.createIcons();
  }

  function initApp() {
    initThemePicker();
    initializeSampleDataIfEmpty();

    const storedSession = getStoredSession();
    if (storedSession) {
      if (storedSession.username) {
        const users = getStoredUsers();
        if (users[storedSession.username]) {
          state.currentUser = storedSession.username;
        }
      }
      if (storedSession.isAdmin) {
        state.isAdmin = true;
      }
    }

    renderAppView();
    updateEditorStats();
  }

  // Run on load
  document.addEventListener('DOMContentLoaded', initApp);

})();
