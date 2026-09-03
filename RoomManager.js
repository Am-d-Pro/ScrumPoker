const crypto = require('crypto');

const STANDARD_DECKS = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'],
  modified: ['0', '0.5', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
  powers2: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕']
};

class RoomManager {
  constructor() {
    this.rooms = new Map();
    // Pre-initialize the 4 permanent constant default rooms on startup
    this.initDefaultRooms();
  }

  generateRoomId() {
    let id;
    do {
      id = crypto.randomBytes(3).toString('hex').toUpperCase();
    } while (this.rooms.has(id));
    return id;
  }

  initDefaultRooms() {
    const defaultRoomsConfig = [
      { id: 'COASTBUSTER', name: 'Squad A - Coastbuster', password: 'pass1', username: 'FrontendLead' },
      { id: 'FIPSTER', name: 'Squad B - Fipster', password: 'pass2', username: 'BackendLead' },
      { id: 'LICENSING', name: 'Squad C - Licensing', password: 'pass3', username: 'MobileLead' },
      { id: 'DAREDEVIL', name: 'Squad D - Daredevil', password: 'pass4', username: 'DevOpsLead' }
    ];

    for (const cfg of defaultRoomsConfig) {
      if (!this.rooms.has(cfg.id)) {
        this.createRoom({
          id: cfg.id,
          name: cfg.name,
          hostName: cfg.username,
          adminKey: 'Pramod12',
          password: cfg.password,
          deckType: 'fibonacci'
        });
      }
    }
  }

  createRoom({ id, name, hostName, hostAvatar, hostColor, adminKey, password, deckType = 'fibonacci', customDeckValues = [] }) {
    const roomId = (id ? id.trim().toUpperCase() : this.generateRoomId());
    const now = Date.now();
    const TWENTY_MINUTES = 20 * 60 * 1000;

    const room = {
      id: roomId,
      name: name || 'Planning Poker Session',
      adminKey: adminKey || 'Pramod12',
      password: password ? password.trim() : null,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + TWENTY_MINUTES,
      deckType: STANDARD_DECKS[deckType] ? deckType : 'custom',
      customDeckValues: Array.isArray(customDeckValues) && customDeckValues.length > 0
        ? customDeckValues
        : ['1', '2', '3', '5', '8'],
      currentStory: {
        title: 'Story #1: Initial Feature Estimation',
        description: 'Cast your estimates below.',
        link: ''
      },
      votingState: 'voting',
      isLocked: false,
      timer: {
        duration: 0,
        remaining: 0,
        isRunning: false
      },
      participants: new Map(),
      history: []
    };

    this.rooms.set(roomId, room);
    return room;
  }

  createBatchRooms({ masterSessionName, adminKey, deckType, customDeckValues, roomsConfig }) {
    const defaultCodes = ['COASTBUSTER', 'FIPSTER', 'LICENSING', 'DAREDEVIL'];
    const defaultPasswords = ['pass1', 'pass2', 'pass3', 'pass4'];
    const batchRooms = [];
    const roomIds = [];

    for (let i = 0; i < 4; i++) {
      const cfg = (roomsConfig && roomsConfig[i]) || {};
      const constantCode = cfg.code ? cfg.code.trim().toUpperCase() : defaultCodes[i];
      const roomPass = cfg.password ? cfg.password.trim() : defaultPasswords[i];

      const room = this.createRoom({
        id: constantCode,
        name: cfg.name || `${masterSessionName || 'Session'} - Room ${i + 1}`,
        hostName: cfg.username || `Admin-${i + 1}`,
        adminKey: adminKey || 'Pramod12',
        password: roomPass,
        deckType: deckType || 'fibonacci',
        customDeckValues
      });
      batchRooms.push(room);
      roomIds.push(room.id);
    }

    return { batchRooms, roomIds };
  }

  getRoom(roomId) {
    if (!roomId) return null;
    const cleanId = roomId.trim().toUpperCase();
    return this.rooms.get(cleanId) || null;
  }

  touchActivity(room) {
    if (room) {
      const TWENTY_MINUTES = 20 * 60 * 1000;
      room.lastActivity = Date.now();
      room.expiresAt = Date.now() + TWENTY_MINUTES;
    }
  }

  extendRoomExpiration(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    const TWENTY_MINUTES = 20 * 60 * 1000;
    room.expiresAt = Math.max(room.expiresAt, Date.now()) + TWENTY_MINUTES;
    this.touchActivity(room);
    return room.expiresAt;
  }

  joinRoom(roomId, socketId, { name, avatar, color, isHost = false, adminKey = null, password = null, isObserver = false }) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found or session closed due to 20 minutes of inactivity.' };

    const givenPass = password ? password.trim() : '';
    const roomPass = room.password ? room.password.trim() : '';

    if (roomPass !== '') {
      const isValidAdmin = adminKey && adminKey.trim() === room.adminKey;
      if (!isValidAdmin && givenPass !== roomPass) {
        return { error: 'Incorrect Room Password.', requiresPassword: true };
      }
    }

    this.touchActivity(room);

    let assignedHost = isHost;
    if (isHost && adminKey && adminKey.trim() !== room.adminKey) {
      assignedHost = false;
    }

    if (room.participants.size === 0) {
      assignedHost = true;
    }

    const participant = {
      id: crypto.randomUUID(),
      socketId,
      name: name ? name.trim() : `Guest-${Math.floor(1000 + Math.random() * 9000)}`,
      avatar: avatar || '⚡',
      color: color || '#6366F1',
      isHost: assignedHost,
      isObserver: Boolean(isObserver),
      vote: null,
      votedAt: null,
      joinedAt: Date.now()
    };

    room.participants.set(socketId, participant);
    return { room, participant };
  }

  leaveRoom(socketId) {
    for (const room of this.rooms.values()) {
      if (room.participants.has(socketId)) {
        const participant = room.participants.get(socketId);
        const wasHost = participant.isHost;
        room.participants.delete(socketId);
        this.touchActivity(room);

        if (wasHost && room.participants.size > 0) {
          const nextParticipant = room.participants.values().next().value;
          nextParticipant.isHost = true;
        }

        return { room, participant };
      }
    }
    return null;
  }

  castVote(roomId, socketId, cardValue) {
    const room = this.getRoom(roomId);
    if (!room) return { error: 'Room not found.' };
    if (room.isLocked) return { error: 'Voting is currently locked.' };

    const participant = room.participants.get(socketId);
    if (!participant) return { error: 'Participant not found.' };
    if (participant.isObserver) return { error: 'Observers cannot vote.' };

    this.touchActivity(room);

    if (participant.vote === cardValue) {
      participant.vote = null;
      participant.votedAt = null;
    } else {
      participant.vote = cardValue;
      participant.votedAt = Date.now();
    }

    return { room, participant };
  }

  revealVotes(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    this.touchActivity(room);
    room.votingState = 'revealed';
    return room;
  }

  resetVotes(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    this.touchActivity(room);
    room.votingState = 'voting';
    for (const participant of room.participants.values()) {
      participant.vote = null;
      participant.votedAt = null;
    }
    return room;
  }

  setDeck(roomId, deckType, customValues = []) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    this.touchActivity(room);

    if (STANDARD_DECKS[deckType]) {
      room.deckType = deckType;
    } else if (deckType === 'custom') {
      room.deckType = 'custom';
      if (Array.isArray(customValues) && customValues.length > 0) {
        room.customDeckValues = customValues.map(v => String(v).trim()).filter(Boolean);
      }
    }

    this.resetVotes(roomId);
    return room;
  }

  setStory(roomId, { title, description, link }) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    this.touchActivity(room);

    if (room.votingState === 'revealed') {
      const stats = this.calculateStats(room);
      room.history.unshift({
        story: { ...room.currentStory },
        deckType: room.deckType,
        stats,
        timestamp: Date.now()
      });
    }

    room.currentStory = {
      title: title || 'Untitled Story',
      description: description || '',
      link: link || ''
    };

    this.resetVotes(roomId);
    return room;
  }

  toggleLock(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    this.touchActivity(room);
    room.isLocked = !room.isLocked;
    return room;
  }

  kickParticipant(roomId, socketIdToKick) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    this.touchActivity(room);
    const participant = room.participants.get(socketIdToKick);
    if (participant) {
      room.participants.delete(socketIdToKick);
      return { room, kickedParticipant: participant };
    }
    return null;
  }

  getCardsForRoom(room) {
    if (room.deckType === 'custom') {
      return room.customDeckValues;
    }
    return STANDARD_DECKS[room.deckType] || STANDARD_DECKS.fibonacci;
  }

  calculateStats(room) {
    const votes = [];
    const distribution = {};
    let voterCount = 0;

    for (const participant of room.participants.values()) {
      if (participant.isObserver) continue;
      if (participant.vote !== null) {
        voterCount++;
        const val = participant.vote;
        distribution[val] = (distribution[val] || 0) + 1;
        
        const num = parseFloat(val);
        if (!isNaN(num) && val !== '?' && val !== '☕') {
          votes.push(num);
        }
      }
    }

    let average = null;
    let median = null;
    let mode = null;
    let consensusPercent = 0;

    if (votes.length > 0) {
      const sum = votes.reduce((acc, v) => acc + v, 0);
      average = Math.round((sum / votes.length) * 10) / 10;

      const sorted = [...votes].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
    }

    let maxCount = 0;
    for (const [cardVal, count] of Object.entries(distribution)) {
      if (count > maxCount) {
        maxCount = count;
        mode = cardVal;
      }
    }

    if (voterCount > 0 && maxCount > 0) {
      consensusPercent = Math.round((maxCount / voterCount) * 100);
    }

    return {
      voterCount,
      totalParticipants: room.participants.size,
      average,
      median,
      mode,
      consensusPercent,
      distribution
    };
  }

  serializeRoom(room, socketId) {
    if (!room) return null;
    const cards = this.getCardsForRoom(room);
    const stats = room.votingState === 'revealed' ? this.calculateStats(room) : null;

    const participantsList = Array.from(room.participants.values()).map(p => ({
      id: p.id,
      socketId: p.socketId,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      isHost: p.isHost,
      isObserver: p.isObserver,
      hasVoted: p.vote !== null,
      vote: (room.votingState === 'revealed' || p.socketId === socketId) ? p.vote : (p.vote !== null ? '✓' : null)
    }));

    return {
      id: room.id,
      name: room.name,
      hasPassword: Boolean(room.password),
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      deckType: room.deckType,
      customDeckValues: room.customDeckValues,
      availableCards: cards,
      currentStory: room.currentStory,
      votingState: room.votingState,
      isLocked: room.isLocked,
      participants: participantsList,
      history: room.history,
      stats,
      isCurrentUserHost: room.participants.get(socketId)?.isHost || false,
      currentUserSocketId: socketId
    };
  }

  cleanupExpiredRooms() {
    const now = Date.now();
    const expiredRoomIds = [];
    const TWENTY_MINUTES = 20 * 60 * 1000;

    for (const [roomId, room] of this.rooms.entries()) {
      // If inactive for > 20 minutes, purge/reset
      if (now > room.expiresAt || (now - room.lastActivity > TWENTY_MINUTES)) {
        expiredRoomIds.push(roomId);
      }
    }

    for (const roomId of expiredRoomIds) {
      this.rooms.delete(roomId);
    }

    // Re-initialize any purged default rooms with clean state
    this.initDefaultRooms();

    return expiredRoomIds;
  }
}

module.exports = new RoomManager();
