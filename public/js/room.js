'use strict';

// ─────────────────────────────────────────────────────────────
//  State
// ─────────────────────────────────────────────────────────────
const roomId = decodeURIComponent(window.location.pathname.split('/').pop());
let localStream = null;
let peer        = null;
let micActive   = true;
let camActive   = true;
const activePeers = {}; // peerId → MediaConnection

// ─────────────────────────────────────────────────────────────
//  DOM refs
// ─────────────────────────────────────────────────────────────
const videoGrid          = document.getElementById('videoGrid');
const toggleMicBtn       = document.getElementById('toggleMicBtn');
const toggleCamBtn       = document.getElementById('toggleCamBtn');
const leaveBtn           = document.getElementById('leaveBtn');
const copyInviteBtn      = document.getElementById('copyInviteBtn');
const ctrlCopyBtn        = document.getElementById('ctrlCopyBtn');
const displayRoomId      = document.getElementById('displayRoomId');
const participantCountEl = document.getElementById('participantCount');
const permissionOverlay  = document.getElementById('permissionOverlay');
const loadingOverlay     = document.getElementById('loadingOverlay');
const toastEl            = document.getElementById('toast');
const micIconEl          = document.getElementById('micIcon');
const camIconEl          = document.getElementById('camIcon');
const micLabelEl         = document.getElementById('micLabel');
const camLabelEl         = document.getElementById('camLabel');
const meetingTimerEl     = document.getElementById('meetingTimer');

// ─────────────────────────────────────────────────────────────
//  Room ID display
// ─────────────────────────────────────────────────────────────
displayRoomId.textContent = roomId;

// ─────────────────────────────────────────────────────────────
//  Meeting timer
// ─────────────────────────────────────────────────────────────
const meetingStart = Date.now();
setInterval(() => {
  const elapsed = Math.floor((Date.now() - meetingStart) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  meetingTimerEl.textContent = `${mm}:${ss}`;
}, 1000);

// ─────────────────────────────────────────────────────────────
//  Socket.io connection
// ─────────────────────────────────────────────────────────────
const socket = io();

// ─────────────────────────────────────────────────────────────
//  Entry — request media, then start peer
// ─────────────────────────────────────────────────────────────
async function init() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    loadingOverlay.hidden = true;
    addVideoTile(localStream, 'You', true);
    startPeer();
  } catch (err) {
    console.error('getUserMedia error:', err);
    loadingOverlay.hidden = true;
    permissionOverlay.hidden = false;
  }
}

// ─────────────────────────────────────────────────────────────
//  PeerJS
// ─────────────────────────────────────────────────────────────
function startPeer() {
  peer = new Peer(undefined, {
    host:   window.location.hostname,
    port:   parseInt(window.location.port) || 3000,
    path:   '/peerjs',
    secure: window.location.protocol === 'https:',
  });

  // Once we have a peer ID, tell the server we've joined
  peer.on('open', (id) => {
    socket.emit('join-room', roomId, id);
  });

  // Answer inbound calls from peers who were already in the room
  peer.on('call', (call) => {
    call.answer(localStream);
    registerCall(call);
  });

  peer.on('error', (err) => {
    if (err.type !== 'peer-unavailable') {
      console.error('Peer error:', err);
      showToast('Connection error — please refresh.', 'error');
    }
  });

  // ── Socket signals ──
  // A new user joined after us — we call them
  socket.on('user-connected', (remotePeerId) => {
    // Small delay so the remote peer has time to fully initialise
    setTimeout(() => callPeer(remotePeerId), 1000);
  });

  // Someone left
  socket.on('user-disconnected', (remotePeerId) => {
    if (activePeers[remotePeerId]) {
      activePeers[remotePeerId].close();
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  Outbound call
// ─────────────────────────────────────────────────────────────
function callPeer(remotePeerId) {
  if (!peer || !localStream) return;
  const call = peer.call(remotePeerId, localStream);
  if (!call) return;
  registerCall(call);
}

// ─────────────────────────────────────────────────────────────
//  Register a call (both inbound and outbound share this logic)
// ─────────────────────────────────────────────────────────────
function registerCall(call) {
  const pid = call.peer;

  call.on('stream', (remoteStream) => {
    // Guard against duplicate stream events
    if (activePeers[pid]) return;
    activePeers[pid] = call;
    addVideoTile(remoteStream, 'Participant', false, pid);
    updateParticipantCount();
  });

  call.on('close', () => {
    removeVideoTile(pid);
    delete activePeers[pid];
    updateParticipantCount();
  });

  call.on('error', (err) => {
    console.error(`Call error [${pid}]:`, err);
    removeVideoTile(pid);
    delete activePeers[pid];
    updateParticipantCount();
  });
}

// ─────────────────────────────────────────────────────────────
//  Video tile helpers
// ─────────────────────────────────────────────────────────────
function addVideoTile(stream, label, isLocal = false, peerId = null) {
  const tile  = document.createElement('div');
  tile.className = 'video-tile' + (isLocal ? ' video-tile--local' : '');
  if (isLocal)  tile.dataset.local  = 'true';
  if (peerId)   tile.dataset.peerId = peerId;

  const video       = document.createElement('video');
  video.srcObject   = stream;
  video.autoplay    = true;
  video.playsInline = true;
  if (isLocal) video.muted = true; // prevent echo on local preview

  video.addEventListener('loadedmetadata', () => video.play().catch(() => {}));

  const labelEl = document.createElement('div');
  labelEl.className   = 'tile-label';
  labelEl.textContent = label;

  const statusEl    = document.createElement('div');
  statusEl.className = 'tile-status';
  if (isLocal) {
    statusEl.innerHTML = '<span class="status-chip status-chip--live">● LIVE</span>';
  }

  tile.append(video, labelEl, statusEl);
  videoGrid.appendChild(tile);
  syncGridCount();
}

function removeVideoTile(peerId) {
  const tile = videoGrid.querySelector(`[data-peer-id="${peerId}"]`);
  if (!tile) return;

  tile.classList.add('tile-exit');

  const cleanup = () => {
    if (tile.parentNode) {
      tile.remove();
      syncGridCount();
    }
  };

  tile.addEventListener('animationend', cleanup, { once: true });
  // Fallback timeout in case animationend never fires
  setTimeout(cleanup, 500);
}

function syncGridCount() {
  const count = videoGrid.children.length;
  videoGrid.dataset.count = Math.min(count, 4);
}

function updateParticipantCount() {
  const count = Object.keys(activePeers).length + 1;
  participantCountEl.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
}

// ─────────────────────────────────────────────────────────────
//  Controls
// ─────────────────────────────────────────────────────────────

// Mic toggle
toggleMicBtn.addEventListener('click', () => {
  if (!localStream) return;
  micActive = !micActive;
  localStream.getAudioTracks().forEach(t => (t.enabled = micActive));
  toggleMicBtn.dataset.active = String(micActive);
  micIconEl.innerHTML = micActive ? SVG.micOn : SVG.micOff;
  micLabelEl.textContent = micActive ? 'Mute' : 'Unmute';
  showToast(micActive ? 'Microphone on' : 'Microphone off');
});

// Camera toggle
toggleCamBtn.addEventListener('click', () => {
  if (!localStream) return;
  camActive = !camActive;
  localStream.getVideoTracks().forEach(t => (t.enabled = camActive));
  toggleCamBtn.dataset.active = String(camActive);
  camIconEl.innerHTML = camActive ? SVG.camOn : SVG.camOff;
  camLabelEl.textContent = camActive ? 'Stop Video' : 'Start Video';

  const localVideo = videoGrid.querySelector('[data-local="true"] video');
  if (localVideo) localVideo.style.opacity = camActive ? '1' : '0.06';

  showToast(camActive ? 'Camera on' : 'Camera off');
});

// Copy invite link
function copyInviteLink() {
  const url = window.location.href;

  const onSuccess = () => {
    showToast('Invite link copied!', 'success');
    const btnText = document.getElementById('copyBtnText');
    if (btnText) {
      btnText.textContent = 'Copied!';
      setTimeout(() => { btnText.textContent = 'Copy link'; }, 2200);
    }
  };

  const fallback = () => {
    try {
      const ta = Object.assign(document.createElement('textarea'), {
        value: url,
        style: 'position:fixed;opacity:0;',
      });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      onSuccess();
    } catch {
      showToast('Could not copy — please copy the URL manually.', 'error');
    }
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(onSuccess).catch(fallback);
  } else {
    fallback();
  }
}

copyInviteBtn.addEventListener('click', copyInviteLink);
ctrlCopyBtn.addEventListener('click', copyInviteLink);

// Leave meeting
leaveBtn.addEventListener('click', () => {
  leaveBtn.disabled = true;

  if (localStream)  localStream.getTracks().forEach(t => t.stop());
  if (peer)         peer.destroy();
  socket.disconnect();

  setTimeout(() => { window.location.href = '/'; }, 400);
});

// ─────────────────────────────────────────────────────────────
//  Toast
// ─────────────────────────────────────────────────────────────
let toastTimer;
function showToast(message, type = 'info') {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className = `toast toast--${type} toast--visible`;
  toastTimer = setTimeout(() => toastEl.classList.remove('toast--visible'), 2800);
}

// ─────────────────────────────────────────────────────────────
//  SVG icon strings  (inline, no external dependency)
// ─────────────────────────────────────────────────────────────
const SVG = {
  micOn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>`,

  micOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>`,

  camOn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"/>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
  </svg>`,

  camOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M7 7H4a2 2 0 0 0-2 2v9.5A2 2 0 0 0 4 20.5h10.5"/>
    <path d="M9.5 4H16a2 2 0 0 1 2 2v7.5"/>
    <polyline points="16 12 23 7 23 17"/>
  </svg>`,
};

// ─────────────────────────────────────────────────────────────
//  Bootstrap
// ─────────────────────────────────────────────────────────────
init();
