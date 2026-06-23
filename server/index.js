// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const {
  createRoom,
  getRoom,
  joinRoom,
  addBot,
  removePlayer,
  startGame,
  handleGameAction,
  checkAndTriggerBot
} = require('./roomManager');

const app = express();
app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.send({ status: 'ok', uptime: process.uptime() });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for local testing and easy deployment
    methods: ['GET', 'POST']
  }
});

// Map to track which room and player ID is associated with a socket ID
const socketToPlayerMap = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new room
  socket.on('create_room', ({ playerName, playerId }) => {
    const room = createRoom(playerId, playerName);
    room.players[0].socketId = socket.id;
    
    socketToPlayerMap[socket.id] = { roomCode: room.id, playerId };
    socket.join(room.id);
    
    socket.emit('room_created', room);
    console.log(`Room created: ${room.id} by host ${playerName}`);
  });

  // Join an existing room
  socket.on('join_room', ({ roomCode, playerName, playerId }) => {
    const code = roomCode.toUpperCase();
    const result = joinRoom(code, playerId, playerName, socket.id);

    if (result.error) {
      socket.emit('join_error', result.error);
      return;
    }

    socketToPlayerMap[socket.id] = { roomCode: code, playerId };
    socket.join(code);
    
    io.to(code).emit('room_update', result.room);
    console.log(`Player ${playerName} joined room: ${code}`);
  });

  // Add a bot (Host only)
  socket.on('add_bot', ({ roomCode, botName, playerId }) => {
    const room = getRoom(roomCode);
    if (!room || room.hostId !== playerId) return;

    const result = addBot(roomCode, botName);
    if (!result.error) {
      io.to(roomCode).emit('room_update', result.room);
      console.log(`Bot ${botName} added to room: ${roomCode}`);
    }
  });

  // Kick player or bot (Host only)
  socket.on('kick_player', ({ roomCode, targetPlayerId, playerId }) => {
    const room = getRoom(roomCode);
    if (!room || room.hostId !== playerId) return;

    // If kicking a human player, disconnect their socket from the room
    const targetPlayer = room.players.find(p => p.id === targetPlayerId);
    if (targetPlayer && targetPlayer.socketId) {
      const targetSocket = io.sockets.sockets.get(targetPlayer.socketId);
      if (targetSocket) {
        targetSocket.leave(roomCode);
        targetSocket.emit('kicked');
      }
    }

    const updatedRoom = removePlayer(roomCode, targetPlayerId);
    if (updatedRoom) {
      io.to(roomCode).emit('room_update', updatedRoom);
    } else {
      io.to(roomCode).emit('room_closed');
    }
    console.log(`Kicked player/bot ${targetPlayerId} from room: ${roomCode}`);
  });

  // Start the game (Host only)
  socket.on('start_game', ({ roomCode, playerId }) => {
    const room = getRoom(roomCode);
    if (!room || room.hostId !== playerId) return;

    const result = startGame(roomCode);
    if (!result.error) {
      io.to(roomCode).emit('room_update', result.room);
      console.log(`Game started in room: ${roomCode}`);

      // Check if it starts on a bot's turn (e.g. if bot is player 0)
      checkAndTriggerBot(roomCode, io);
    }
  });

  // Make a game action
  socket.on('game_action', ({ roomCode, playerId, action }) => {
    const updatedRoom = handleGameAction(roomCode, playerId, action);
    if (updatedRoom) {
      io.to(roomCode).emit('room_update', updatedRoom);
      
      // Check if the next turn or state is a bot's turn
      checkAndTriggerBot(roomCode, io);
    }
  });

  // Reset game (Return to lobby)
  socket.on('reset_game', ({ roomCode, playerId }) => {
    const room = getRoom(roomCode);
    if (!room || room.hostId !== playerId) return;

    room.game = null; // Clear active game state
    io.to(roomCode).emit('room_update', room);
    console.log(`Game reset/returned to lobby in room: ${roomCode}`);
  });

  // Handle player disconnects
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const mapping = socketToPlayerMap[socket.id];
    
    if (mapping) {
      const { roomCode, playerId } = mapping;
      delete socketToPlayerMap[socket.id];

      const room = getRoom(roomCode);
      if (room) {
        // If game has NOT started yet, remove them from room entirely
        if (!room.game) {
          const updatedRoom = removePlayer(roomCode, playerId);
          if (updatedRoom) {
            io.to(roomCode).emit('room_update', updatedRoom);
          } else {
            io.to(roomCode).emit('room_closed');
            console.log(`Room ${roomCode} closed due to no players`);
          }
        } else {
          // If game started, keep them in room, just set socketId to null
          // They can potentially reconnect by joining again
          const player = room.players.find(p => p.id === playerId);
          if (player) {
            player.socketId = null;
            io.to(roomCode).emit('room_update', room);
            console.log(`Player ${player.name} disconnected during active game in room ${roomCode}`);
          }
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
