'use strict';

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');
const path     = require('path');

// ─────────────────────────────────────────
//  App setup
// ─────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// Serve everything in /public statically
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────
//  PeerJS signalling server — mounted at /peerjs
// ─────────────────────────────────────────
const peerServer = ExpressPeerServer(server, { debug: false });
app.use('/peerjs', peerServer);

// ─────────────────────────────────────────
//  Page routes
// ─────────────────────────────────────────
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/room/:roomId', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'room.html'));
});

// ─────────────────────────────────────────
//  Socket.io  — room signalling only
//  Events:  join-room  →  user-connected  /  user-disconnected
// ─────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('join-room', (roomId, peerId) => {
    socket.join(roomId);

    // Tell every OTHER socket in this room that someone arrived
    socket.to(roomId).emit('user-connected', peerId);

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', peerId);
    });
  });
});

// ─────────────────────────────────────────
//  Start
// ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  ◈  AuraMeet  —  http://localhost:${PORT}\n`);
});
