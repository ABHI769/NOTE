/**
 * SILVERNOTE — Simple & Beautiful Notepad
 * Clean personal notes application with rich-text editor, block reordering,
 * note reordering (arrows + drag-and-drop), editing, deleting, and light gradient themes.
 */

(function () {
  'use strict';

  // LocalStorage Keys
  const STORAGE_KEYS = {
    USERS: 'silvernote_users_v1',
    NOTES: 'silvernote_notes_v1',
    SESSION: 'silvernote_session_v1',
    DEVICE_USER: 'silvernote_device_user_v1'
  };

  // Application State
  let state = {
    currentUser: null,
    pendingImageBase64: null
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
          title: 'Welcome to SilverNote',
          content: '<p>Welcome to <strong>SilverNote</strong>! A clean, simple, and distraction-free notepad.</p><p>Key features:</p><ul><li>Write, format text, customize fonts, insert images, and add hyperlinks.</li><li><strong>Reorder your notes</strong> anytime using the arrow buttons or drag handle.</li><li><strong>Edit or delete</strong> any note whenever you want using the Edit and Delete buttons.</li><li>Choose from 4 beautiful light gradient color themes in the top-left menu.</li></ul>',
          fontFamily: "'Inter', sans-serif",
          fontSize: '16px',
          createdAt: new Date().toISOString(),
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

  // Auth Form Elements
  const userLoginForm = document.getElementById('userLoginForm');
  const usernameInput = document.getElementById('usernameInput');
  const authStatusMessage = document.getElementById('authStatusMessage');

  // Notepad View Elements
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

  // Edit Note Modal Elements
  const editNoteModal = document.getElementById('editNoteModal');
  const editNoteId = document.getElementById('editNoteId');
  const editNoteTitleInput = document.getElementById('editNoteTitleInput');
  const editNoteContentCanvas = document.getElementById('editNoteContentCanvas');
  const saveEditNoteBtn = document.getElementById('saveEditNoteBtn');

  // Confirm Delete Modal Elements
  const confirmDeleteModal = document.getElementById('confirmDeleteModal');
  const deleteTargetPreview = document.getElementById('deleteTargetPreview');
  const confirmDeleteExecuteBtn = document.getElementById('confirmDeleteExecuteBtn');
  let pendingDeleteNoteId = null;

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
    }, 3200);
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
     USER AUTHENTICATION (NO PASSWORD REQUIRED)
     ========================================================================== */

  usernameInput.addEventListener('input', () => {
    const rawVal = usernameInput.value.trim();
    if (!rawVal) {
      authStatusMessage.classList.add('hidden');
      return;
    }

    const users = getStoredUsers();
    if (users[rawVal]) {
      authStatusMessage.textContent = `Welcome back, ${rawVal}! Click to open your notes.`;
      authStatusMessage.className = 'auth-feedback success';
      authStatusMessage.classList.remove('hidden');
    } else {
      authStatusMessage.textContent = `New user "${rawVal}". Click to create your workspace.`;
      authStatusMessage.className = 'auth-feedback success';
      authStatusMessage.classList.remove('hidden');
    }
  });

  userLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawUser = usernameInput.value.trim();

    if (!rawUser) {
      showToast('Please specify a username.', 'error');
      return;
    }

    const users = getStoredUsers();
    if (!users[rawUser]) {
      users[rawUser] = {
        username: rawUser,
        createdAt: new Date().toISOString()
      };
      saveStoredUsers(users);
    }

    state.currentUser = rawUser;
    saveStoredSession({ username: rawUser });
    showToast(`Welcome, ${rawUser}!`, 'success');
    renderAppView();
  });

  logoutBtn.addEventListener('click', () => {
    state.currentUser = null;
    saveStoredSession(null);
    renderAppView();
    showToast('Logged out. Your notes remain saved.', 'info');
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
     DIRECT NOTE SAVING (SIMPLE & INSTANT)
     ========================================================================== */

  submitNoteBtn.addEventListener('click', () => {
    if (!state.currentUser) {
      showToast('Session expired. Please enter your username again.', 'error');
      return;
    }

    const title = noteTitleInput.value.trim() || 'Untitled Note';
    const content = noteRichEditor.innerHTML;
    const textLength = noteRichEditor.innerText.trim().length;

    if (textLength === 0 && !noteRichEditor.querySelector('img')) {
      showToast('Please enter some text or insert an image before saving.', 'error');
      return;
    }

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

    showToast('Note saved successfully!', 'success');
    renderUserNotes();
  });

  /* ==========================================================================
     NOTE EDITING & DELETING (USER EMPOWERED)
     ========================================================================== */

  function openEditNoteModal(noteId) {
    const notes = getStoredNotes();
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    editNoteId.value = note.id;
    editNoteTitleInput.value = note.title || '';
    editNoteContentCanvas.innerHTML = note.content || '';
    openModal(editNoteModal);
    editNoteTitleInput.focus();
  }

  saveEditNoteBtn.addEventListener('click', () => {
    const noteId = editNoteId.value;
    if (!noteId) return;

    const notes = getStoredNotes();
    const idx = notes.findIndex(n => n.id === noteId);
    if (idx === -1) return;

    const newTitle = editNoteTitleInput.value.trim() || 'Untitled Note';
    const newContent = editNoteContentCanvas.innerHTML;

    notes[idx].title = newTitle;
    notes[idx].content = newContent;
    notes[idx].updatedAt = new Date().toISOString();

    saveStoredNotes(notes);
    closeModal(editNoteModal);
    showToast('Note updated successfully!', 'success');
    renderUserNotes();
  });

  function openDeleteNoteModal(noteId, title) {
    pendingDeleteNoteId = noteId;
    deleteTargetPreview.innerHTML = `
      <span class="summary-label">Target Note:</span>
      <div class="summary-title">${escapeHtml(title || 'Untitled Note')}</div>
    `;
    openModal(confirmDeleteModal);
  }

  confirmDeleteExecuteBtn.addEventListener('click', () => {
    if (!pendingDeleteNoteId) return;

    let notes = getStoredNotes();
    notes = notes.filter(n => n.id !== pendingDeleteNoteId);
    saveStoredNotes(notes);

    pendingDeleteNoteId = null;
    closeModal(confirmDeleteModal);
    showToast('Note deleted successfully.', 'success');
    renderUserNotes();
  });

  /* ==========================================================================
     USER NOTES ARCHIVE (REORDERABLE, EDITABLE, DELETABLE)
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
          <p>${userNotes.length === 0 ? 'Your notepad is empty. Write your thoughts above and click Save Note.' : 'Try adjusting your search keywords.'}</p>
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

      const updatedStr = note.updatedAt ? ` • Edited: ${new Date(note.updatedAt).toLocaleDateString()}` : '';

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
            <!-- Edit Button -->
            <button type="button" class="btn-silver-ghost btn-sm btn-edit-note" data-id="${note.id}" title="Edit this note">
              <i data-lucide="edit-3"></i>
              <span>Edit</span>
            </button>
            <!-- Delete Button -->
            <button type="button" class="btn-silver-ghost btn-sm btn-delete-note" data-id="${note.id}" data-title="${escapeHtml(note.title)}" title="Delete this note" style="color: #dc2626;">
              <i data-lucide="trash-2"></i>
              <span>Delete</span>
            </button>
          </div>
        </header>

        <div class="note-card-body" style="font-family: ${note.fontFamily || 'inherit'}; font-size: ${note.fontSize || '16px'};">
          ${note.content}
        </div>

        <footer class="note-card-footer">
          <span class="note-owner">
            <i data-lucide="user"></i>
            <span>${escapeHtml(note.username)}</span>
          </span>
          <span class="note-time">${dateStr}${updatedStr}</span>
        </footer>
      `;

      notesContainer.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  }

  // Event Delegation for Notes Container (Move, Edit, Delete)
  notesContainer.addEventListener('click', (e) => {
    // Reorder move up / move down buttons
    const moveBtn = e.target.closest('.btn-note-move');
    if (moveBtn && !moveBtn.disabled) {
      const noteId = moveBtn.dataset.id;
      const direction = moveBtn.dataset.move;
      moveNote(noteId, direction);
      return;
    }

    // Edit button
    const editBtn = e.target.closest('.btn-edit-note');
    if (editBtn) {
      const noteId = editBtn.dataset.id;
      openEditNoteModal(noteId);
      return;
    }

    // Delete button
    const deleteBtn = e.target.closest('.btn-delete-note');
    if (deleteBtn) {
      const noteId = deleteBtn.dataset.id;
      const noteTitle = deleteBtn.dataset.title;
      openDeleteNoteModal(noteId, noteTitle);
      return;
    }
  });

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

  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-close-modal');
      const targetModal = document.getElementById(targetId);
      closeModal(targetModal);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
        closeModal(modal);
      });
    }
  });

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
    if (state.currentUser) {
      authSection.classList.add('hidden');
      notepadSection.classList.remove('hidden');

      currentUserBadge.classList.remove('hidden');
      avatarInitial.textContent = state.currentUser.charAt(0).toUpperCase();
      displayUsername.textContent = state.currentUser;

      renderUserNotes();
    } else {
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
    if (storedSession && storedSession.username) {
      const users = getStoredUsers();
      if (users[storedSession.username]) {
        state.currentUser = storedSession.username;
      }
    }

    renderAppView();
    updateEditorStats();
  }

  document.addEventListener('DOMContentLoaded', initApp);

})();
