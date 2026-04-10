/* ─────────────────────────────────────────────────────
   NexChat · script.js
───────────────────────────────────────────────────── */

const socket = io();

/* ── State ─────────────────────────────────────────── */
let myUsername  = '';
let currentRoom = 'general';
let allUsers    = [];

/* ── DOM refs ──────────────────────────────────────── */
const app             = document.getElementById('app');
const usernameModal   = document.getElementById('usernameModal');
const usernameInput   = document.getElementById('usernameInput');
const usernameError   = document.getElementById('usernameError');
const joinBtn         = document.getElementById('joinBtn');

const createRoomModal = document.getElementById('createRoomModal');
const roomNameInput   = document.getElementById('roomNameInput');
const cancelRoomBtn   = document.getElementById('cancelRoomBtn');
const confirmRoomBtn  = document.getElementById('confirmRoomBtn');
const roomError       = document.getElementById('roomError');
const createRoomBtn   = document.getElementById('createRoomBtn');

const messagesEl      = document.getElementById('messages');
const messageInput    = document.getElementById('messageInput');
const sendBtn         = document.getElementById('sendBtn');
const emojiBtn        = document.getElementById('emojiBtn');
const emojiPicker     = document.getElementById('emojiPicker');
const roomListEl      = document.getElementById('roomList');
const userListEl      = document.getElementById('userList');
const userCountEl     = document.getElementById('userCount');
const currentRoomEl   = document.getElementById('currentRoomName');
const memberCountEl   = document.getElementById('roomMemberCount');

/* ════════════════════════════════════════════════════
   USERNAME MODAL
════════════════════════════════════════════════════ */
joinBtn.addEventListener('click', submitUsername);
usernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitUsername(); });
usernameInput.focus();

function submitUsername() {
  const name = usernameInput.value.trim();
  if (!name) { shake(usernameInput); return; }
  usernameError.classList.add('hidden');
  socket.emit('setUsername', { username: name });
}

socket.on('usernameTaken', () => {
  usernameError.classList.remove('hidden');
  shake(usernameInput);
  usernameInput.select();
});

/* ════════════════════════════════════════════════════
   CREATE ROOM MODAL
════════════════════════════════════════════════════ */
createRoomBtn.addEventListener('click', openCreateRoom);
cancelRoomBtn.addEventListener('click', closeCreateRoom);
confirmRoomBtn.addEventListener('click', submitCreateRoom);
roomNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitCreateRoom(); });

function openCreateRoom() {
  roomError.classList.add('hidden');
  roomNameInput.value = '';
  createRoomModal.classList.remove('hidden');
  setTimeout(() => roomNameInput.focus(), 50);
}

function closeCreateRoom() {
  createRoomModal.classList.add('hidden');
}

function submitCreateRoom() {
  const name = roomNameInput.value.trim();
  if (!name) { shake(roomNameInput); return; }
  roomError.classList.add('hidden');
  socket.emit('createRoom', { roomName: name });
}

socket.on('roomError', msg => {
  roomError.textContent = msg;
  roomError.classList.remove('hidden');
  shake(roomNameInput);
});

socket.on('roomCreated', ({ room }) => {
  closeCreateRoom();
  socket.emit('joinRoom', { room });
});

/* ════════════════════════════════════════════════════
   SOCKET — INCOMING EVENTS
════════════════════════════════════════════════════ */
socket.on('roomJoined', ({ room }) => {
  currentRoom = room;
  currentRoomEl.textContent = room;
  messageInput.placeholder  = `Message #${room}…`;
  messagesEl.innerHTML      = '';
  updateRoomHighlight();
  updateMemberCount();

  if (!myUsername && usernameInput.value.trim()) {
    myUsername = usernameInput.value.trim();
    usernameModal.classList.add('hidden');
    app.classList.remove('hidden');
  }
});

socket.on('chatMessage', ({ sender, message, ts }) => {
  const isMine = sender === myUsername;
  appendMessage(sender, message, ts, isMine);
});

socket.on('sysMsg', ({ type, text, ts }) => {
  appendSystemMessage(type, text, ts);
});

socket.on('roomList', rooms => {
  renderRoomList(rooms);
});

socket.on('userList', users => {
  allUsers = users;
  renderUserList(users);
  updateMemberCount();
});

/* ════════════════════════════════════════════════════
   SEND MESSAGE
════════════════════════════════════════════════════ */
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });

function sendMessage() {
  const msg = messageInput.value.trim();
  if (!msg || !myUsername) return;
  socket.emit('chatMessage', { message: msg });
  messageInput.value = '';
  messageInput.focus();
}

/* ════════════════════════════════════════════════════
   RENDER — MESSAGES
════════════════════════════════════════════════════ */
function appendMessage(sender, message, ts, isMine) {
  const el = document.createElement('div');
  el.className = `message ${isMine ? 'sent' : 'received'}`;
  el.innerHTML = `
    <div class="message-top">
      <span class="sender-name">${esc(sender)}</span>
      <span class="send-time">${formatTime(ts)}</span>
    </div>
    <div class="msg-bubble">${esc(message)}</div>
  `;
  messagesEl.appendChild(el);
  scrollToBottom();
}

function appendSystemMessage(type, text, ts) {
  const el = document.createElement('div');
  el.className = `system-message ${type}`;
  el.innerHTML = `
    <span class="system-arrow">${type === 'join' ? '→' : '←'}</span>
    <span>${esc(text)}</span>
    <span class="system-time">${formatTime(ts)}</span>
  `;
  messagesEl.appendChild(el);
  scrollToBottom();
}

/* ════════════════════════════════════════════════════
   RENDER — ROOMS
════════════════════════════════════════════════════ */
function renderRoomList(rooms) {
  roomListEl.innerHTML = '';
  rooms.forEach(({ name, count }, i) => {
    const el = document.createElement('div');
    el.className = `room-item${name === currentRoom ? ' active' : ''}`;
    el.style.animationDelay = `${i * 40}ms`;
    el.innerHTML = `
      <span class="room-hash">#</span>
      <span class="room-name">${esc(name)}</span>
      <span class="room-count">${count}</span>
    `;
    el.addEventListener('click', () => {
      if (name !== currentRoom) socket.emit('joinRoom', { room: name });
    });
    roomListEl.appendChild(el);
  });
}

function updateRoomHighlight() {
  document.querySelectorAll('.room-item').forEach(el => {
    const name = el.querySelector('.room-name')?.textContent;
    el.classList.toggle('active', name === currentRoom);
  });
}

/* ════════════════════════════════════════════════════
   RENDER — USERS
════════════════════════════════════════════════════ */
function renderUserList(users) {
  userListEl.innerHTML = '';
  userCountEl.textContent = users.length;

  users.forEach(({ username, room }, i) => {
    const el    = document.createElement('div');
    el.className = 'user-item';
    el.style.animationDelay = `${i * 35}ms`;

    const color  = strToHsl(username);
    const letter = username[0].toUpperCase();
    const isMe   = username === myUsername;
    const isHere = room === currentRoom;

    el.innerHTML = `
      <div class="user-avatar" style="--avatar-color: ${color}">${letter}</div>
      <div class="user-info">
        <span class="user-name${isMe ? ' is-me' : ''}">${esc(username)}</span>
        <span class="room-label">#${esc(room)}</span>
      </div>
      ${isHere ? '<span class="status-dot" title="In this room"></span>' : ''}
    `;
    userListEl.appendChild(el);
  });
}

function updateMemberCount() {
  const n = allUsers.filter(u => u.room === currentRoom).length;
  memberCountEl.textContent = `${n} member${n !== 1 ? 's' : ''}`;
}

/* ════════════════════════════════════════════════════
   EMOJI PICKER
════════════════════════════════════════════════════ */
const EMOJIS = [
  '😀','😂','😍','🥰','😊','😎','🤩','🥳',
  '😢','😭','😡','🤔','🤯','😴','🤗','😏',
  '👍','👎','❤️','🔥','💯','✨','🎉','🎊',
  '🙌','👏','💪','🙏','👀','💀','🤣','🫡',
  '😤','🥺','😇','🫶','🍕','🎮','🚀','🌟',
  '💎','🎵','🦋','🌈','⚡','🎯','🏆','💡',
];

EMOJIS.forEach(emoji => {
  const btn = document.createElement('button');
  btn.className   = 'emoji-btn';
  btn.textContent = emoji;
  btn.addEventListener('click', () => {
    messageInput.value += emoji;
    messageInput.focus();
  });
  emojiPicker.appendChild(btn);
});

emojiBtn.addEventListener('click', e => {
  e.stopPropagation();
  emojiPicker.classList.toggle('hidden');
});

document.addEventListener('click', e => {
  if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
    emojiPicker.classList.add('hidden');
  }
});

/* ════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════ */
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function strToHsl(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 60%, 62%)`;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function shake(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.38s ease';
  el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
}

const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-7px); }
    40%      { transform: translateX(7px); }
    60%      { transform: translateX(-4px); }
    80%      { transform: translateX(4px); }
  }
`;
document.head.appendChild(style);