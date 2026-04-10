const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

/* ── State ─────────────────────────────────────────── */
const users = {};          // socketId → { username, room }
const rooms = {
  general : { name: 'general', createdBy: 'system', members: new Set() },
  random  : { name: 'random',  createdBy: 'system', members: new Set() },
  gaming  : { name: 'gaming',  createdBy: 'system', members: new Set() },
};

/* ── Helpers ────────────────────────────────────────── */
const getRoomList  = () =>
  Object.values(rooms).map(r => ({ name: r.name, createdBy: r.createdBy, count: r.members.size }));

const getAllUsers   = () =>
  Object.values(users).map(u => ({ username: u.username, room: u.room }));

const sysMsg = (type, text) => ({ type, text, ts: new Date().toISOString() });

/* ── Socket Logic ───────────────────────────────────── */
io.on('connection', socket => {

  /* ── Set username & join lobby ── */
  socket.on('setUsername', ({ username }) => {
    // Reject duplicate names
    const taken = Object.values(users).some(u => u.username === username);
    if (taken) { socket.emit('usernameTaken'); return; }

    users[socket.id] = { username, room: 'general' };
    rooms.general.members.add(socket.id);
    socket.join('general');

    socket.emit('roomJoined', { room: 'general' });
    io.to('general').emit('sysMsg', sysMsg('join', `${username} joined #general`));
    io.emit('roomList', getRoomList());
    io.emit('userList', getAllUsers());
  });

  /* ── Join a room ── */
  socket.on('joinRoom', ({ room }) => {
    const user = users[socket.id];
    if (!user || !rooms[room] || user.room === room) return;

    const prev = user.room;
    rooms[prev].members.delete(socket.id);
    socket.leave(prev);
    io.to(prev).emit('sysMsg', sysMsg('leave', `${user.username} left #${prev}`));

    user.room = room;
    rooms[room].members.add(socket.id);
    socket.join(room);

    socket.emit('roomJoined', { room });
    io.to(room).emit('sysMsg', sysMsg('join', `${user.username} joined #${room}`));
    io.emit('roomList', getRoomList());
    io.emit('userList', getAllUsers());
  });

  /* ── Create room ── */
  socket.on('createRoom', ({ roomName }) => {
    const user = users[socket.id];
    if (!user) return;

    const slug = roomName.toLowerCase().trim()
      .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24);

    if (!slug || rooms[slug]) {
      socket.emit('roomError', rooms[slug] ? 'Room already exists' : 'Invalid name');
      return;
    }

    rooms[slug] = { name: slug, createdBy: user.username, members: new Set() };
    io.emit('roomList', getRoomList());
    socket.emit('roomCreated', { room: slug });
  });

  /* ── Chat message ── */
  socket.on('chatMessage', ({ message }) => {
    const user = users[socket.id];
    if (!user || !message.trim()) return;

    io.to(user.room).emit('chatMessage', {
      sender  : user.username,
      message : message.trim(),
      room    : user.room,
      ts      : new Date().toISOString(),
      sid     : socket.id,
    });
  });

  /* ── Disconnect ── */
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (!user) return;
    const { username, room } = user;
    rooms[room]?.members.delete(socket.id);
    delete users[socket.id];
    io.to(room).emit('sysMsg', sysMsg('leave', `${username} left the chat`));
    io.emit('roomList', getRoomList());
    io.emit('userList', getAllUsers());
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✦ NexChat running → http://localhost:${PORT}`));