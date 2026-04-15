'use strict';

const newMeetingBtn  = document.getElementById('newMeetingBtn');
const joinMeetingBtn = document.getElementById('joinMeetingBtn');
const meetingIdInput = document.getElementById('meetingIdInput');
const inputError     = document.getElementById('inputError');

// ── Generate a human-readable room ID like  abc-4x2-r9f ──
function generateRoomId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const seg = () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

// ── New meeting ──
newMeetingBtn.addEventListener('click', () => {
  newMeetingBtn.disabled = true;
  newMeetingBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin .7s linear infinite">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
    Creating…
  `;
  // Add spinner keyframes inline once
  if (!document.getElementById('spinKF')) {
    const s = document.createElement('style');
    s.id = 'spinKF';
    s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }
  setTimeout(() => {
    window.location.href = `/room/${generateRoomId()}`;
  }, 280);
});

// ── Join meeting ──
joinMeetingBtn.addEventListener('click', joinMeeting);
meetingIdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinMeeting(); });

// Clear error on input
meetingIdInput.addEventListener('input', () => {
  inputError.textContent = '';
  inputError.classList.remove('visible');
});

function joinMeeting() {
  const id = meetingIdInput.value.trim();
  if (!id) {
    showError('Please enter a meeting ID.');
    meetingIdInput.focus();
    return;
  }
  window.location.href = `/room/${encodeURIComponent(id)}`;
}

function showError(msg) {
  inputError.textContent = msg;
  inputError.classList.add('visible');
  meetingIdInput.style.borderColor = 'rgba(229,115,115,.45)';
  setTimeout(() => {
    inputError.classList.remove('visible');
    meetingIdInput.style.borderColor = '';
  }, 3200);
}
