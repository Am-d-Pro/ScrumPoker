// ==========================================================================
// VASPOKER — Frontend Application Client Logic
// ==========================================================================

// Global State
let socket = null;
let currentRoomState = null;
let selectedAvatar = '⚡';
let selectedColor = '#6366F1';
let userSelectedVote = null;
let expirationInterval = null;
let sessionAdminKey = null; // Stored if user created the room

const AVATARS = ['⚡', '🚀', '🦊', '🦉', '🐱', '🐼', '🦁', '🤖', '👾', '🦄'];
const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#06B6D4', '#F43F5E'];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  renderAvatarPickers();
  initSocket();
  checkUrlForRoomCode();
});

// Render Avatar Selection Controls
function renderAvatarPickers() {
  const joinPicker = document.getElementById('join-avatar-picker');
  const createPicker = document.getElementById('create-avatar-picker');

  const createOptionsHtml = AVATARS.map((avatar, idx) => {
    const color = COLORS[idx % COLORS.length];
    const isSel = idx === 0 ? 'selected' : '';
    return `<div class="avatar-option ${isSel}" style="background-color: ${color}20; color: ${color};" onclick="selectAvatar(this, '${avatar}', '${color}')">${avatar}</div>`;
  }).join('');

  if (joinPicker) joinPicker.innerHTML = createOptionsHtml;
  if (createPicker) createPicker.innerHTML = createOptionsHtml;
}

function selectAvatar(element, avatar, color) {
  const container = element.parentElement;
  container.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
  selectedAvatar = avatar;
  selectedColor = color;
}

// Landing View Tab Switching (Join / Create / Batch 4 Rooms)
function switchLandingTab(tab) {
  const joinBtn = document.getElementById('tab-join-btn');
  const createBtn = document.getElementById('tab-create-btn');
  const batchBtn = document.getElementById('tab-batch-btn');

  const joinForm = document.getElementById('join-form');
  const createForm = document.getElementById('create-form');
  const batchForm = document.getElementById('batch-form');

  // Reset active classes
  [joinBtn, createBtn, batchBtn].forEach(b => b && b.classList.remove('active'));
  [joinForm, createForm, batchForm].forEach(f => f && f.classList.remove('active'));

  if (tab === 'join') {
    if (joinBtn) joinBtn.classList.add('active');
    if (joinForm) joinForm.classList.add('active');
  } else if (tab === 'create') {
    if (createBtn) createBtn.classList.add('active');
    if (createForm) createForm.classList.add('active');
  } else if (tab === 'batch') {
    if (batchBtn) batchBtn.classList.add('active');
    if (batchForm) batchForm.classList.add('active');
  }
}

// Check URL Hash or Params for quick join
function checkUrlForRoomCode() {
  const hash = window.location.hash.replace('#', '').trim();
  const urlParams = new URLSearchParams(window.location.search);
  const roomCode = hash || urlParams.get('room');

  if (roomCode) {
    const roomInput = document.getElementById('join-room-id');
    if (roomInput) {
      roomInput.value = roomCode.toUpperCase();
      switchLandingTab('join');
    }
  }
}

// Paste Room Code
async function pasteRoomCode() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      const cleaned = text.trim().toUpperCase().replace(/.*[#?&]room=/, '');
      document.getElementById('join-room-id').value = cleaned.slice(0, 10);
    }
  } catch (err) {
    alert('Please paste the room code directly into the input field.');
  }
}

// Socket Connection setup
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('Connected to VASPoker Socket.IO Server:', socket.id);
  });

  socket.on('room-state-updated', (roomState) => {
    currentRoomState = roomState;
    renderRoomState(roomState);
  });

  socket.on('room-expired', (data) => {
    alert(data.message || 'This room has reached its 1-hour limit and has expired.');
    leaveRoom();
  });

  socket.on('kicked-from-room', () => {
    alert('You have been removed from the session by the host.');
    leaveRoom();
  });

  socket.on('error-message', (msg) => {
    alert(msg);
  });
}

// Handle Create Single Room Form Submit
function handleCreateRoom(event) {
  event.preventDefault();
  const roomId = document.getElementById('create-room-id').value.trim().toUpperCase();
  const roomName = document.getElementById('create-room-name').value.trim();
  const adminKeyInput = document.getElementById('create-admin-key');
  const adminKey = adminKeyInput ? adminKeyInput.value.trim() : 'admin123';
  const password = document.getElementById('create-room-password').value.trim();
  const userName = document.getElementById('create-host-name').value.trim();
  const deckType = document.getElementById('create-deck-type').value;
  const customInput = document.getElementById('create-custom-deck-input').value.trim();

  let customDeckValues = [];
  if (deckType === 'custom' && customInput) {
    customDeckValues = customInput.split(',').map(v => v.trim()).filter(Boolean);
  }

  sessionAdminKey = adminKey;

  socket.emit('create-room', {
    roomId,
    roomName,
    adminKey,
    password,
    userName,
    avatar: selectedAvatar,
    color: selectedColor,
    deckType,
    customDeckValues,
    isObserver: false
  }, (response) => {
    if (response.success) {
      window.location.hash = response.roomId;
      showRoomView();
    } else {
      alert(response.error || 'Failed to create room.');
    }
  });
}

// Handle Create Batch 4 Rooms Form Submit (Admin)
function handleCreateBatchRooms(event) {
  event.preventDefault();
  const masterSessionName = document.getElementById('batch-master-name').value.trim();
  const adminKeyInput = document.getElementById('batch-admin-key');
  const adminKey = adminKeyInput ? adminKeyInput.value.trim() : 'admin123';

  const roomsConfig = [
    {
      code: document.getElementById('batch-r1-code').value.trim().toUpperCase(),
      name: document.getElementById('batch-r1-name').value.trim(),
      username: document.getElementById('batch-r1-user').value.trim(),
      password: document.getElementById('batch-r1-pass').value.trim()
    },
    {
      code: document.getElementById('batch-r2-code').value.trim().toUpperCase(),
      name: document.getElementById('batch-r2-name').value.trim(),
      username: document.getElementById('batch-r2-user').value.trim(),
      password: document.getElementById('batch-r2-pass').value.trim()
    },
    {
      code: document.getElementById('batch-r3-code').value.trim().toUpperCase(),
      name: document.getElementById('batch-r3-name').value.trim(),
      username: document.getElementById('batch-r3-user').value.trim(),
      password: document.getElementById('batch-r3-pass').value.trim()
    },
    {
      code: document.getElementById('batch-r4-code').value.trim().toUpperCase(),
      name: document.getElementById('batch-r4-name').value.trim(),
      username: document.getElementById('batch-r4-user').value.trim(),
      password: document.getElementById('batch-r4-pass').value.trim()
    }
  ];

  sessionAdminKey = adminKey;

  socket.emit('create-batch-rooms', {
    masterSessionName,
    adminKey,
    deckType: 'fibonacci',
    roomsConfig
  }, (response) => {
    if (response.success) {
      showBatchDashboardView(response);
    } else {
      alert(response.error || 'Failed to create 4 rooms.');
    }
  });
}

// Render Admin Batch 4-Room Master Dashboard View
function showBatchDashboardView(data) {
  document.getElementById('landing-view').classList.remove('active');
  document.getElementById('room-view').classList.remove('active');
  const dash = document.getElementById('batch-dashboard-view');
  dash.classList.add('active');

  document.getElementById('batch-master-title').innerText = `${data.masterSessionName} (4 Master Rooms)`;

  const container = document.getElementById('batch-cards-container');
  container.innerHTML = data.rooms.map((room, idx) => {
    const link = `${window.location.origin}/#${room.id}`;
    return `
      <div class="batch-room-card glass-panel">
        <div class="batch-card-header">
          <span class="batch-card-title">${room.name}</span>
          <span class="batch-card-code">${room.id}</span>
        </div>
        <div class="batch-card-info">
          <div><strong>Room Code:</strong> <code>${room.id}</code></div>
          <div><strong>Password:</strong> <code>${room.password || 'None'}</code></div>
          <div><strong>Duration:</strong> 1-Hour Ephemeral</div>
        </div>
        <div class="batch-card-actions">
          <button class="primary-btn" style="font-size: 0.85rem; padding: 8px 14px;" onclick="joinBatchRoomDirect('${room.id}', '${room.password}')">
            Enter Room →
          </button>
          <button class="btn-secondary-sm" onclick="copyDirectLink('${link}')">
            Copy Link 🔗
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function copyDirectLink(link) {
  navigator.clipboard.writeText(link).then(() => {
    alert(`Link Copied!\n\n${link}`);
  });
}

function joinBatchRoomDirect(roomId, password) {
  document.getElementById('batch-dashboard-view').classList.remove('active');
  document.getElementById('join-room-id').value = roomId;
  document.getElementById('join-room-password').value = password;
  switchLandingTab('join');
  showLandingView();
}

function showLandingView() {
  document.getElementById('room-view').classList.remove('active');
  document.getElementById('batch-dashboard-view').classList.remove('active');
  document.getElementById('landing-view').classList.add('active');
}

// Handle Join Room Form Submit
function handleJoinRoom(event) {
  event.preventDefault();
  const roomId = document.getElementById('join-room-id').value.trim().toUpperCase();
  const password = document.getElementById('join-room-password').value.trim();
  const userName = document.getElementById('join-user-name').value.trim();
  const isObserver = document.getElementById('join-is-observer').checked;

  socket.emit('join-room', {
    roomId,
    userName,
    avatar: selectedAvatar,
    color: selectedColor,
    password,
    isObserver
  }, (response) => {
    if (response.success) {
      window.location.hash = roomId;
      showRoomView();
    } else {
      if (response.requiresPassword) {
        alert('🔒 This room requires a Room Password. Please enter the password and try again.');
      } else {
        alert(response.error || 'Failed to join room.');
      }
    }
  });
}

// Toggle Custom Deck Input Visibility
function toggleCustomDeckInput(prefix) {
  const deckSelect = document.getElementById(`${prefix}-deck-type`);
  const customGroup = document.getElementById(`${prefix}-custom-deck-group`);
  if (deckSelect && customGroup) {
    if (deckSelect.value === 'custom') {
      customGroup.classList.remove('hidden');
    } else {
      customGroup.classList.add('hidden');
    }
  }
}

// Switch Views
function showRoomView() {
  document.getElementById('landing-view').classList.remove('active');
  document.getElementById('batch-dashboard-view').classList.remove('active');
  document.getElementById('room-view').classList.add('active');
  startExpirationTimer();
}

function leaveRoom() {
  if (socket && socket.connected) {
    socket.emit('leave-room');
  }
  if (expirationInterval) {
    clearInterval(expirationInterval);
    expirationInterval = null;
  }
  currentRoomState = null;
  sessionAdminKey = null;
  userSelectedVote = null;
  window.location.hash = '';

  document.getElementById('room-view').classList.remove('active');
  document.getElementById('batch-dashboard-view').classList.remove('active');
  document.getElementById('landing-view').classList.add('active');
}

// Start 1-Hour Ephemeral Expiration Countdown Timer
function startExpirationTimer() {
  if (expirationInterval) clearInterval(expirationInterval);

  expirationInterval = setInterval(() => {
    if (!currentRoomState || !currentRoomState.expiresAt) return;

    const remainingMs = currentRoomState.expiresAt - Date.now();
    const timerElem = document.getElementById('timer-countdown');

    if (remainingMs <= 0) {
      if (timerElem) timerElem.innerText = '00:00';
      clearInterval(expirationInterval);
      return;
    }

    const minutes = Math.floor(remainingMs / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (timerElem) timerElem.innerText = formatted;
  }, 1000);
}

// Render Room State (Called on Socket Update)
function renderRoomState(state) {
  // Top Navbar Info
  document.getElementById('room-display-name').innerText = state.name;
  document.getElementById('room-display-code').innerText = state.id;

  // Host Privilege Controls Visibility
  const isAdmin = state.isCurrentUserHost || sessionAdminKey !== null;
  const adminBar = document.getElementById('admin-control-bar');
  const hostIndicator = document.getElementById('host-indicator');
  const claimBtn = document.getElementById('btn-claim-admin');
  const extendBtn = document.getElementById('btn-extend-room');

  if (isAdmin) {
    adminBar.classList.remove('hidden');
    hostIndicator.classList.remove('hidden');
    claimBtn.classList.add('hidden');
    if (extendBtn) extendBtn.classList.remove('hidden');
  } else {
    adminBar.classList.add('hidden');
    hostIndicator.classList.add('hidden');
    claimBtn.classList.remove('hidden');
    if (extendBtn) extendBtn.classList.add('hidden');
  }

  // Lock State
  const lockIcon = document.getElementById('lock-icon');
  const lockText = document.getElementById('lock-text');
  if (lockIcon && lockText) {
    lockIcon.innerText = state.isLocked ? '🔒' : '🔓';
    lockText.innerText = state.isLocked ? 'Unlock Votes' : 'Lock Votes';
  }

  // Story Info
  document.getElementById('current-story-title').innerText = state.currentStory.title;
  document.getElementById('current-story-desc').innerText = state.currentStory.description || 'Cast your estimates below.';

  // Voters Count
  const voters = state.participants.filter(p => !p.isObserver);
  const votedCount = voters.filter(p => p.hasVoted).length;
  document.getElementById('voted-count-num').innerText = votedCount;
  document.getElementById('total-voters-num').innerText = voters.length;

  // Render Participants Grid (Supports 20+ Voters)
  renderParticipantsGrid(state);

  // Render Card Selection Carousel
  renderDeckCarousel(state);

  // Render Analytics & Results (if revealed)
  renderAnalytics(state);
}

// Render Participants Grid
function renderParticipantsGrid(state) {
  const grid = document.getElementById('participants-grid');
  if (!grid) return;

  const isRevealed = state.votingState === 'revealed';
  const isAdmin = state.isCurrentUserHost;

  grid.innerHTML = state.participants.map(participant => {
    const hasVoted = participant.hasVoted;
    const isCurrentUser = participant.socketId === state.currentUserSocketId;
    const voteValue = participant.vote;

    let cardFrontContent = `<span class="thinking-text">${participant.isObserver ? 'Observer' : 'Thinking...'}</span>`;
    if (hasVoted) {
      cardFrontContent = `<span class="voted-badge-icon">✓</span>`;
    }

    return `
      <div class="voter-card-item ${hasVoted ? 'has-voted' : ''} ${isRevealed ? 'revealed' : ''}">
        ${(isAdmin && !isCurrentUser) ? `<button class="kick-btn-mini" onclick="kickVoter('${participant.socketId}')" title="Kick Voter">✕</button>` : ''}
        
        <div class="voter-card-flip">
          <div class="card-inner">
            <!-- Face Down -->
            <div class="card-front">
              ${cardFrontContent}
            </div>
            <!-- Face Up (Revealed) -->
            <div class="card-back">
              <span class="card-value-display">${voteValue !== null ? voteValue : '—'}</span>
            </div>
          </div>
        </div>

        <div class="voter-info-row">
          <div class="voter-avatar" style="background-color: ${participant.color}30; color: ${participant.color};">
            ${participant.avatar}
          </div>
          <span class="voter-name" title="${participant.name}">
            ${participant.name} ${isCurrentUser ? '(You)' : ''}
          </span>
          ${participant.isHost ? '<span class="host-crown" title="Host / Admin">👑</span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Render Interactive Card Selection Carousel
function renderDeckCarousel(state) {
  const carousel = document.getElementById('cards-carousel');
  const deckTypeLabel = document.getElementById('deck-type-label');
  if (!carousel) return;

  if (deckTypeLabel) {
    deckTypeLabel.innerText = `${state.deckType.toUpperCase()} DECK`;
  }

  const currentUser = state.participants.find(p => p.socketId === state.currentUserSocketId);
  userSelectedVote = currentUser ? currentUser.vote : null;

  carousel.innerHTML = state.availableCards.map(cardVal => {
    const isSelected = userSelectedVote === cardVal;
    return `
      <div class="poker-deck-card ${isSelected ? 'selected' : ''}" onclick="castVote('${cardVal}')">
        ${cardVal}
      </div>
    `;
  }).join('');
}

// Cast Vote Event
function castVote(cardValue) {
  if (!socket || !currentRoomState) return;
  if (currentRoomState.isLocked) {
    alert('Voting is currently locked by the host.');
    return;
  }

  socket.emit('cast-vote', { cardValue });
}

// Render Analytics & Consensus Confetti
function renderAnalytics(state) {
  const panel = document.getElementById('analytics-panel');
  if (!panel) return;

  if (state.votingState !== 'revealed' || !state.stats) {
    panel.classList.add('hidden');
    return;
  }

  panel.classList.remove('hidden');
  const stats = state.stats;

  document.getElementById('stat-avg').innerText = stats.average !== null ? stats.average : '—';
  document.getElementById('stat-median').innerText = stats.median !== null ? stats.median : '—';
  document.getElementById('stat-mode').innerText = stats.mode !== null ? stats.mode : '—';
  document.getElementById('stat-consensus').innerText = `${stats.consensusPercent}%`;

  const distBarsContainer = document.getElementById('distribution-bars');
  if (distBarsContainer && stats.distribution) {
    const totalVotes = stats.voterCount || 1;
    distBarsContainer.innerHTML = Object.entries(stats.distribution).map(([cardVal, count]) => {
      const heightPercent = Math.max(10, Math.round((count / totalVotes) * 100));
      return `
        <div class="dist-bar-wrapper">
          <div class="dist-bar" style="height: ${heightPercent}%;">
            <span class="dist-count">${count}</span>
          </div>
          <span class="dist-label">${cardVal}</span>
        </div>
      `;
    }).join('');
  }

  if (stats.consensusPercent === 100 && stats.voterCount > 1 && window.confetti) {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}

// UNIVERSAL REVEAL / RESET TRIGGERS (ACCESSIBLE TO ALL USERS)
function triggerRevealVotes() {
  if (!socket) return;
  socket.emit('reveal-votes');
}

function triggerResetVotes() {
  if (!socket) return;
  socket.emit('reset-votes');
}

function triggerToggleLock() {
  if (!socket) return;
  socket.emit('toggle-lock', { adminKey: sessionAdminKey });
}

function kickVoter(socketIdToKick) {
  if (!socket) return;
  if (confirm('Kick this participant from the room?')) {
    socket.emit('kick-voter', { socketIdToKick, adminKey: sessionAdminKey });
  }
}

function extendRoomTime() {
  if (!socket) return;
  socket.emit('extend-room', { adminKey: sessionAdminKey });
  alert('Session extended by +1 hour!');
}

// Modals Management
function toggleAdminLoginModal() {
  document.getElementById('admin-login-modal').classList.toggle('hidden');
}

function submitAdminLogin() {
  const pin = document.getElementById('admin-login-password').value.trim();
  if (pin === 'admin123' || pin.length > 0) {
    sessionAdminKey = pin;
    toggleAdminLoginModal();

    // Reveal Single Room and 4 Rooms Bundle tabs
    const createBtn = document.getElementById('tab-create-btn');
    const batchBtn = document.getElementById('tab-batch-btn');
    if (createBtn) createBtn.classList.remove('hidden');
    if (batchBtn) batchBtn.classList.remove('hidden');

    const triggerBtn = document.getElementById('btn-admin-login-trigger');
    if (triggerBtn) {
      triggerBtn.innerHTML = '👑 Admin Logged In (Creation Unlocked)';
      triggerBtn.style.borderColor = '#10B981';
      triggerBtn.style.color = '#10B981';
    }

    switchLandingTab('create');
    alert('👑 Admin Logged In Successfully! Single Room and 4 Rooms Bundle creation tools are now unlocked.');
  } else {
    alert('Invalid Admin PIN.');
  }
}

function toggleDeckModal() {
  document.getElementById('deck-modal').classList.toggle('hidden');
}

function toggleStoryModal() {
  const modal = document.getElementById('story-modal');
  modal.classList.toggle('hidden');
  if (!modal.classList.contains('hidden') && currentRoomState) {
    document.getElementById('modal-story-title').value = currentRoomState.currentStory.title || '';
    document.getElementById('modal-story-desc').value = currentRoomState.currentStory.description || '';
  }
}

function toggleAdminModal() {
  document.getElementById('admin-modal').classList.toggle('hidden');
}

function promptClaimAdmin() {
  toggleAdminModal();
}

function submitClaimAdmin() {
  const pin = document.getElementById('claim-admin-pin').value.trim();
  if (!pin) return;

  socket.emit('claim-host', { adminKey: pin }, (res) => {
    if (res.success) {
      sessionAdminKey = pin;
      toggleAdminModal();
      alert('👑 Admin Host privileges claimed successfully!');
    } else {
      alert(res.error || 'Invalid Admin PIN.');
    }
  });
}

function applyDeckChange() {
  const deckType = document.getElementById('modal-deck-type').value;
  const customInput = document.getElementById('modal-custom-deck-input').value.trim();
  let customDeckValues = [];

  if (deckType === 'custom' && customInput) {
    customDeckValues = customInput.split(',').map(v => v.trim()).filter(Boolean);
  }

  socket.emit('change-deck', {
    deckType,
    customDeckValues,
    adminKey: sessionAdminKey
  });

  toggleDeckModal();
}

function applyStoryChange() {
  const title = document.getElementById('modal-story-title').value.trim();
  const description = document.getElementById('modal-story-desc').value.trim();

  socket.emit('update-story', {
    title,
    description,
    adminKey: sessionAdminKey
  });

  toggleStoryModal();
}

// Copy Room Link to Clipboard
function copyRoomLink() {
  const link = `${window.location.origin}/#${currentRoomState.id}`;
  navigator.clipboard.writeText(link).then(() => {
    alert(`Room Link Copied to Clipboard!\n\n${link}`);
  }).catch(() => {
    alert(`Room Code: ${currentRoomState.id}`);
  });
}

// Export CSV Summary
function exportResultsCSV() {
  if (!currentRoomState) return;

  let csvContent = 'data:text/csv;charset=utf-8,';
  csvContent += 'Participant Name,Avatar,Is Host,Vote Value\n';

  currentRoomState.participants.forEach(p => {
    csvContent += `"${p.name}","${p.avatar}","${p.isHost ? 'Yes' : 'No'}","${p.vote || 'N/A'}"\n`;
  });

  if (currentRoomState.stats) {
    csvContent += '\nSummary Statistics\n';
    csvContent += `Average,${currentRoomState.stats.average || 'N/A'}\n`;
    csvContent += `Median,${currentRoomState.stats.median || 'N/A'}\n`;
    csvContent += `Mode,${currentRoomState.stats.mode || 'N/A'}\n`;
    csvContent += `Consensus %,${currentRoomState.stats.consensusPercent}%\n`;
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Planning_Poker_${currentRoomState.id}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
