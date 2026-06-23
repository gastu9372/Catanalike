// server/roomManager.js
const { createGame, processAction } = require('./gameLogic');
const { getBotAction, evaluateTradeOffer } = require('./botPlayer');

// Store all active rooms in memory
const rooms = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]);
  return code;
}

function createRoom(hostId, hostName) {
  const code = generateRoomCode();
  rooms[code] = {
    id: code,
    hostId: hostId,
    players: [
      { id: hostId, name: hostName, isBot: false, socketId: null }
    ],
    game: null,
    createdAt: Date.now()
  };
  return rooms[code];
}

function getRoom(code) {
  return rooms[code.toUpperCase()];
}

function joinRoom(code, playerId, playerName, socketId) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (room.game) return { error: 'Game already started' };
  if (room.players.length >= 4) return { error: 'Room is full' };

  const existingPlayer = room.players.find(p => p.id === playerId);
  if (existingPlayer) {
    existingPlayer.socketId = socketId;
    return { room };
  }

  const newPlayer = { id: playerId, name: playerName, isBot: false, socketId };
  room.players.push(newPlayer);
  return { room };
}

function addBot(code, botName) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (room.game) return { error: 'Game already started' };
  if (room.players.length >= 4) return { error: 'Room is full' };

  const botId = `bot_${Math.random().toString(36).substr(2, 9)}`;
  const botPlayer = { id: botId, name: botName, isBot: true, socketId: null };
  room.players.push(botPlayer);
  return { room };
}

function removePlayer(code, playerId) {
  const room = getRoom(code);
  if (!room) return null;

  room.players = room.players.filter(p => p.id !== playerId);

  const humanPlayers = room.players.filter(p => !p.isBot);
  if (room.players.length === 0 || humanPlayers.length === 0) {
    delete rooms[code];
    return null;
  }

  if (room.hostId === playerId) {
    room.hostId = humanPlayers[0].id;
  }

  return room;
}

function startGame(code) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (room.players.length < 2) return { error: 'Need at least 2 players to start' };
  
  room.game = createGame(room.players);
  return { room };
}

function handleGameAction(code, playerId, action) {
  const room = getRoom(code);
  if (!room || !room.game) return null;

  const success = processAction(room.game, playerId, action);
  if (success) {
    return room;
  }
  return null;
}

/**
 * Orchestrates bot triggers for both active turns and trade offers.
 */
function checkAndTriggerBot(code, io) {
  const room = getRoom(code);
  if (!room || !room.game || room.game.winner) return;

  const game = room.game;

  // --- 1. BOT EVALUATES ACTIVE TRADES ---
  if (game.activeTrade && game.activeTrade.senderId) {
    const sender = game.players.find(p => p.id === game.activeTrade.senderId);
    // If trade was proposed by a human player
    if (sender && !sender.isBot) {
      const eligibleBots = game.players.filter(p => p.isBot && p.id !== game.activeTrade.senderId);
      
      for (let bot of eligibleBots) {
        const accepts = evaluateTradeOffer(bot, game.activeTrade.offer, game.activeTrade.demand);
        if (accepts) {
          // Bots take 2 seconds to decide and accept a trade
          setTimeout(() => {
            const currentRoom = getRoom(code);
            if (!currentRoom || !currentRoom.game || !currentRoom.game.activeTrade) return;

            const success = processAction(currentRoom.game, bot.id, { type: 'accept_trade' });
            if (success) {
              io.to(code).emit('room_update', currentRoom);
              checkAndTriggerBot(code, io);
            }
          }, 2000);
          return; // One bot accepted, stop checking others
        }
      }
    }
  }

  // --- 2. BOT PLAYS ACTIVE TURN ---
  const activePlayerId = game.phase.startsWith('setup')
    ? game.turnOrder[game.setupTurnIndex]
    : game.turnOrder[game.currentTurnIndex];

  const activePlayer = game.players.find(p => p.id === activePlayerId);
  if (!activePlayer || !activePlayer.isBot) return;

  const action = getBotAction(activePlayerId, game);
  if (!action) return;

  setTimeout(() => {
    const currentRoom = getRoom(code);
    if (!currentRoom || !currentRoom.game) return;

    const success = processAction(currentRoom.game, activePlayerId, action);
    if (success) {
      io.to(code).emit('room_update', currentRoom);
      checkAndTriggerBot(code, io);
    }
  }, 1500);
}

module.exports = {
  createRoom,
  getRoom,
  joinRoom,
  addBot,
  removePlayer,
  startGame,
  handleGameAction,
  checkAndTriggerBot,
  rooms
};
