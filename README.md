# AuraMeet

A premium, real-time P2P video meeting app built for a class project. AuraMeet lets you create or join video meetings in seconds — no accounts, no installs, just share a link.

---

## Features

- **Create a meeting** — generates a unique room ID and redirects you instantly
- **Join a meeting** — enter any meeting ID or paste a room URL
- **P2P video calling** — direct peer-to-peer streams via PeerJS / WebRTC
- **Mute / unmute** microphone mid-call
- **Camera on / off** toggle
- **Copy invite link** — one click to copy the room URL to clipboard
- **Leave meeting** — cleanly disconnects and returns to home
- **Dynamic video grid** — tiles appear/disappear as participants join/leave
- **Meeting timer** — live elapsed time shown in the top bar
- **Participant count** — updates in real time

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express.js |
| Realtime signalling | Socket.io |
| P2P video | PeerJS (client CDN) + peer (server) |
| HTTP server | Node.js `http` module |
| Frontend | Vanilla HTML / CSS / JavaScript |

---

## Installation

1. **Clone or download** this repository.

2. **Navigate** into the project folder:
   ```bash
   cd "LAB 9"
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the server:**
   ```bash
   node server.js
   ```

5. **Open your browser** and go to:
   ```
   http://localhost:3000
   ```

---

## How to Run a Demo (two-tab test)

1. Start the server with `node server.js`.
2. Open **Tab A** at `http://localhost:3000` → click **New Meeting**.
3. Copy the room URL from the top bar.
4. Open **Tab B** → paste the URL, or go to `http://localhost:3000` and enter the meeting ID.
5. Both tabs should connect and display each other's video.
6. Test mute, camera off, and leave — all controls work in real time.

> **Note:** Both tabs must be on the same machine for localhost testing. For remote users, the server needs to be publicly accessible (e.g., via ngrok or a VPS).

---

## How It Works

### Signalling flow
```
User A                      Server                     User B
  |                           |                           |
  |── join-room(roomId, peerA)→|                          |
  |                           |← join-room(roomId, peerB)─|
  |                           |── user-connected(peerB) ──→|  (sent to A)
  |← user-connected(peerA) ───|                           |  (sent to B)
  |                           |                           |
  |─────── PeerJS call (direct P2P stream) ───────────────|
```

1. Both users connect to Socket.io and emit `join-room` with their room ID and PeerJS peer ID.
2. The server broadcasts `user-connected` to everyone else in that room.
3. The new user calls existing peers directly via PeerJS; the existing users answer.
4. Media streams are exchanged P2P — the server only handles the initial signalling.
5. On disconnect, the server emits `user-disconnected` so tiles are removed cleanly.

---

## Project Structure

```
LAB 9/
├── server.js              # Express + Socket.io + PeerJS server
├── package.json
├── .gitignore
├── README.md
├── demo/                  # Place screenshots or demo video here
└── public/
    ├── index.html         # Homepage
    ├── room.html          # Meeting room
    ├── css/
    │   ├── styles.css     # Homepage styles
    │   └── room.css       # Room styles
    ├── js/
    │   ├── home.js        # Homepage logic (room ID gen, navigation)
    │   └── room.js        # Room logic (PeerJS, Socket.io, controls)
    └── assets/            # Static assets
```

---

## Notes & Limitations

- **No TURN server** — works best on the same network or over a reliable connection. For NAT traversal in production, a TURN server (e.g., Twilio, coturn) would be needed.
- **No authentication** — anyone with the room ID can join. This is intentional for simplicity.
- **No persistence** — rooms only exist while at least one browser tab has them open.
- **Camera/mic required** — the app needs browser permission to access your devices.
- Tested on Chrome and Firefox. Safari may require HTTPS for camera access.

---

## Future Improvements

- Screen sharing
- In-room text chat
- TURN server integration for cross-network reliability
- Room password / waiting room
- Participant name entry
- Recording support
