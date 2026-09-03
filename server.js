const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const roomManager = require('./RoomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: roomManager.rooms.size,
    uptime: process.uptime()
  });
});

function broadcastRoomState(roomId) {
  const room = roomManager.getRoom(roomId);
  if (!room) return;

  for (const [socketId] of room.participants.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      const state = roomManager.serializeRoom(room, socketId);
      socket.emit('room-state-updated', state);
    }
  }
}

io.on('connection', (socket) => {
  let currentRoomId = null;

  // Single Room Creation (Host/Admin)
  socket.on('create-room', (data, callback) => {
    try {
      const room = roomManager.createRoom({
        id: data.roomId,
        name: data.roomName,
        hostName: data.userName,
        hostAvatar: data.avatar,
        hostColor: data.color,
        adminKey: data.adminKey,
        password: data.password,
        deckType: data.deckType,
        customDeckValues: data.customDeckValues
      });

      const { participant } = roomManager.joinRoom(room.id, socket.id, {
        name: data.userName,
        avatar: data.avatar,
        color: data.color,
        isHost: true,
        adminKey: data.adminKey,
        password: data.password,
        isObserver: Boolean(data.isObserver)
      });

      currentRoomId = room.id;
      socket.join(room.id);

      if (typeof callback === 'function') {
        callback({ success: true, roomId: room.id, adminKey: room.adminKey });
      }

      broadcastRoomState(room.id);
    } catch (err) {
      console.error('Create room error:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to create room.' });
      }
    }
  });

  // Batch Creation: 4 Rooms Simultaneously (Admin)
  socket.on('create-batch-rooms', (data, callback) => {
    try {
      const { masterSessionName, adminKey, deckType, customDeckValues, roomsConfig } = data;
      
      const { batchRooms, roomIds } = roomManager.createBatchRooms({
        masterSessionName,
        adminKey,
        deckType,
        customDeckValues,
        roomsConfig // array of 4 room configs: [{ name, username, password }]
      });

      const summaryList = batchRooms.map(room => ({
        id: room.id,
        name: room.name,
        adminKey: room.adminKey,
        password: room.password,
        createdAt: room.createdAt,
        expiresAt: room.expiresAt
      }));

      if (typeof callback === 'function') {
        callback({ success: true, masterSessionName, rooms: summaryList });
      }
    } catch (err) {
      console.error('Batch create error:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to create 4 rooms.' });
      }
    }
  });

  // Join Room (Guest or Admin with Password Verification)
  socket.on('join-room', (data, callback) => {
    try {
      const roomId = data.roomId ? data.roomId.toUpperCase() : null;
      const room = roomManager.getRoom(roomId);

      if (!room) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Room not found or expired (1-hour limit).' });
        }
        return;
      }

      const result = roomManager.joinRoom(roomId, socket.id, {
        name: data.userName,
        avatar: data.avatar,
        color: data.color,
        isHost: Boolean(data.isHost),
        adminKey: data.adminKey,
        password: data.password,
        isObserver: Boolean(data.isObserver)
      });

      if (result.error) {
        if (typeof callback === 'function') {
          callback({ 
            success: false, 
            error: result.error, 
            requiresPassword: Boolean(result.requiresPassword) 
          });
        }
        return;
      }

      currentRoomId = roomId;
      socket.join(roomId);

      if (typeof callback === 'function') {
        callback({ success: true, roomId, roomName: room.name });
      }

      broadcastRoomState(roomId);
    } catch (err) {
      console.error('Join room error:', err);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to join room.' });
      }
    }
  });

  // Cast vote
  socket.on('cast-vote', ({ cardValue }) => {
    if (!currentRoomId) return;
    const result = roomManager.castVote(currentRoomId, socket.id, cardValue);
    if (!result.error) {
      broadcastRoomState(currentRoomId);
    } else {
      socket.emit('error-message', result.error);
    }
  });

  // UNIVERSAL REVEAL VOTES: Any connected participant in the room can reveal!
  socket.on('reveal-votes', () => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    if (room) {
      roomManager.revealVotes(currentRoomId);
      broadcastRoomState(currentRoomId);
    }
  });

  // UNIVERSAL RESET VOTES: Any connected participant in the room can reset!
  socket.on('reset-votes', () => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    if (room) {
      roomManager.resetVotes(currentRoomId);
      broadcastRoomState(currentRoomId);
    }
  });

  // Host: Change deck type / custom deck
  socket.on('change-deck', ({ deckType, customDeckValues, adminKey }) => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    const participant = room?.participants.get(socket.id);

    if (participant?.isHost || adminKey === room?.adminKey) {
      roomManager.setDeck(currentRoomId, deckType, customDeckValues);
      broadcastRoomState(currentRoomId);
    } else {
      socket.emit('error-message', 'Host permission required.');
    }
  });

  // Host: Update story details
  socket.on('update-story', ({ title, description, link, adminKey }) => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    const participant = room?.participants.get(socket.id);

    if (participant?.isHost || adminKey === room?.adminKey) {
      roomManager.setStory(currentRoomId, { title, description, link });
      broadcastRoomState(currentRoomId);
    } else {
      socket.emit('error-message', 'Host permission required.');
    }
  });

  // Host: Toggle lock voting
  socket.on('toggle-lock', ({ adminKey }) => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    const participant = room?.participants.get(socket.id);

    if (participant?.isHost || adminKey === room?.adminKey) {
      roomManager.toggleLock(currentRoomId);
      broadcastRoomState(currentRoomId);
    } else {
      socket.emit('error-message', 'Host permission required.');
    }
  });

  // Host: Kick participant
  socket.on('kick-voter', ({ socketIdToKick, adminKey }) => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    const participant = room?.participants.get(socket.id);

    if (participant?.isHost || adminKey === room?.adminKey) {
      const kickedSocket = io.sockets.sockets.get(socketIdToKick);
      if (kickedSocket) {
        kickedSocket.emit('kicked-from-room');
        kickedSocket.leave(currentRoomId);
      }
      roomManager.kickParticipant(currentRoomId, socketIdToKick);
      broadcastRoomState(currentRoomId);
    }
  });

  // Host: Extend room expiration (+1 hour)
  socket.on('extend-room', ({ adminKey }) => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    const participant = room?.participants.get(socket.id);

    if (participant?.isHost || adminKey === room?.adminKey) {
      roomManager.extendRoomExpiration(currentRoomId);
      broadcastRoomState(currentRoomId);
    }
  });

  // Claim host with admin PIN
  socket.on('claim-host', ({ adminKey }, callback) => {
    if (!currentRoomId) return;
    const room = roomManager.getRoom(currentRoomId);
    if (room && room.adminKey === adminKey) {
      const participant = room.participants.get(socket.id);
      if (participant) {
        participant.isHost = true;
        broadcastRoomState(currentRoomId);
        if (typeof callback === 'function') callback({ success: true });
      }
    } else {
      if (typeof callback === 'function') callback({ success: false, error: 'Invalid Admin Key.' });
    }
  });

  // Leave Room Explicitly
  socket.on('leave-room', () => {
    if (currentRoomId) {
      const roomIdToUpdate = currentRoomId;
      const result = roomManager.leaveRoom(socket.id);
      socket.leave(roomIdToUpdate);
      currentRoomId = null;
      if (result && result.room) {
        broadcastRoomState(roomIdToUpdate);
      }
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (currentRoomId) {
      const result = roomManager.leaveRoom(socket.id);
      if (result && result.room) {
        broadcastRoomState(result.room.id);
      }
    }
  });
});

// Periodic Ephemeral Cleanup Worker (Runs every 10 seconds)
setInterval(() => {
  const expiredRoomIds = roomManager.cleanupExpiredRooms();
  for (const roomId of expiredRoomIds) {
    console.log(`[Auto-Expiration Worker] Purged expired room ${roomId}`);
    io.to(roomId).emit('room-expired', {
      message: 'This planning poker session has reached its 1-hour time limit and has been automatically cleaned up.'
    });
    io.in(roomId).socketsLeave(roomId);
  }
}, 10000);

server.listen(PORT, () => {
  console.log(`🚀 Planning Poker Server running on http://localhost:${PORT}`);
});
