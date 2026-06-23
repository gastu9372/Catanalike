// client/src/App.jsx
import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import translations from './i18n';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import GamePanel from './components/GamePanel';

// Socket server URL
// For local testing: http://localhost:3001
// For production: will be configured via environment or fallback to current origin for unified hosting
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3001' 
    : window.location.origin);

// Get or generate player ID
const getPlayerId = () => {
  let id = localStorage.getItem('catan_player_id');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('catan_player_id', id);
  }
  return id;
};

// Get stored player name
const getStoredName = () => {
  return localStorage.getItem('catan_player_name') || '';
};

function App() {
  const [socket, setSocket] = useState(null);
  const [playerId] = useState(getPlayerId);
  const [playerName, setPlayerName] = useState(getStoredName);
  const [nameSubmitted, setNameSubmitted] = useState(!!getStoredName());
  
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  
  const [language, setLanguage] = useState('es'); // Default Spanish
  const [kicked, setKicked] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  
  // Track building mode selection on client: 'road', 'settlement', 'city', or null
  const [buildMode, setBuildMode] = useState(null);

  // Game over overlay tab selection
  const [gameOverTab, setGameOverTab] = useState('awards');

  const t = translations[language];

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SERVER_URL, {
      autoConnect: true
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to socket server:', newSocket.id);
    });

    newSocket.on('room_created', (roomData) => {
      setRoom(roomData);
      setError('');
    });

    newSocket.on('room_update', (roomData) => {
      setRoom(roomData);
      setError('');
    });

    newSocket.on('join_error', (errMsg) => {
      setError(errMsg);
    });

    newSocket.on('kicked', () => {
      setKicked(true);
      setRoom(null);
    });

    newSocket.on('room_closed', () => {
      setRoomClosed(true);
      setRoom(null);
    });

    return () => {
      newSocket.off('connect');
      newSocket.off('room_created');
      newSocket.off('room_update');
      newSocket.off('join_error');
      newSocket.off('kicked');
      newSocket.off('room_closed');
      newSocket.disconnect();
    };
  }, []);

  const handleSaveName = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    localStorage.setItem('catan_player_name', playerName.trim());
    setNameSubmitted(true);
  };

  const handleCreateRoom = () => {
    if (!socket) return;
    socket.emit('create_room', { playerName, playerId });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!socket || !roomCodeInput.trim()) return;
    socket.emit('join_room', {
      roomCode: roomCodeInput.trim().toUpperCase(),
      playerName,
      playerId
    });
  };

  const handleAddBot = () => {
    if (!socket || !room) return;
    const botNameList = t.bot_names;
    // Count current bots to pick a unique name
    const currentBotsCount = room.players.filter(p => p.isBot).length;
    const botName = botNameList[currentBotsCount % botNameList.length] || `Bot ${currentBotsCount + 1}`;
    
    socket.emit('add_bot', {
      roomCode: room.id,
      botName,
      playerId
    });
  };

  const handleKickPlayer = (targetPlayerId) => {
    if (!socket || !room) return;
    socket.emit('kick_player', {
      roomCode: room.id,
      targetPlayerId,
      playerId
    });
  };

  const handleStartGame = () => {
    if (!socket || !room) return;
    socket.emit('start_game', {
      roomCode: room.id,
      playerId
    });
  };

  const handleGameAction = (actionType, payload = {}) => {
    if (!socket || !room) return;
    socket.emit('game_action', {
      roomCode: room.id,
      playerId,
      action: {
        type: actionType,
        payload
      }
    });
    // Reset client build mode after sending action
    setBuildMode(null);
  };

  const handleResetGame = () => {
    if (!socket || !room) return;
    socket.emit('reset_game', {
      roomCode: room.id,
      playerId
    });
  };

  const toggleLanguage = () => {
    setLanguage(prev => (prev === 'es' ? 'en' : 'es'));
  };

  const resetModals = () => {
    setKicked(false);
    setRoomClosed(false);
  };

  // --- RENDERING ROUTER ---

  // 1. Modals/Notices
  if (kicked || roomClosed) {
    return (
      <div className="modal-overlay">
        <div className="glass-panel modal-content">
          <h2>{t.title}</h2>
          <p style={{ margin: '1.5rem 0', fontSize: '1.2rem' }}>
            {kicked ? t.kicked_msg : t.room_closed_msg}
          </p>
          <button className="btn-primary" onClick={resetModals}>
            OK
          </button>
        </div>
      </div>
    );
  }

  // 2. Name setup screen
  if (!nameSubmitted) {
    return (
      <div className="welcome-screen">
        <div className="glass-panel auth-card">
          <h1 className="auth-title">{t.title}</h1>
          <form onSubmit={handleSaveName}>
            <div className="input-group">
              <label className="input-label">{t.player_name}</label>
              <input
                type="text"
                className="styled-input"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={15}
                required
                placeholder="Ex: Gaston"
              />
            </div>
            <button type="submit" className="btn-primary">
              Continue
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Welcome/Join room screen
  if (!room) {
    return (
      <div className="welcome-screen">
        <div className="glass-panel auth-card" style={{ position: 'relative' }}>
          <button 
            className="btn-lang" 
            style={{ position: 'absolute', top: '15px', right: '15px' }}
            onClick={toggleLanguage}
          >
            {t.lang_btn}
          </button>

          <h1 className="auth-title">{t.title}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {language === 'es' ? `Hola, ${playerName}` : `Hello, ${playerName}`}
          </p>

          <button className="btn-primary" onClick={handleCreateRoom}>
            {t.create_room}
          </button>

          <div className="divider">OR</div>

          <form onSubmit={handleJoinRoom}>
            <div className="input-group">
              <label className="input-label">{t.room_code}</label>
              <input
                type="text"
                className="styled-input"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value)}
                placeholder={t.enter_code}
                maxLength={4}
                required
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>}
            <button type="submit" className="btn-secondary">
              {t.join_room}
            </button>
          </form>
          
          <button 
            className="btn-link" 
            onClick={() => setNameSubmitted(false)}
            style={{ marginTop: '1.5rem', background: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem' }}
          >
            {language === 'es' ? 'Cambiar Nombre' : 'Change Name'}
          </button>
        </div>
      </div>
    );
  }

  // 4. In-room Lobby (waiting for game)
  if (room && !room.game) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">🎲 {t.title}</div>
          <button className="btn-lang" onClick={toggleLanguage}>
            {t.lang_btn}
          </button>
        </header>
        <Lobby
          room={room}
          playerId={playerId}
          onAddBot={handleAddBot}
          onKick={handleKickPlayer}
          onStart={handleStartGame}
          language={language}
        />
      </div>
    );
  }

  // Stats calculations for game over screen
  const game = room?.game;
  const totalRolls = game?.diceStats
    ? Object.values(game.diceStats).reduce((a, b) => a + b, 0)
    : 0;

  let maxResourcesCollected = 0;
  let maxResPlayers = [];
  if (game?.players) {
    game.players.forEach(p => {
      const rc = p.stats?.resourcesCollected || 0;
      if (rc > maxResourcesCollected) {
        maxResourcesCollected = rc;
        maxResPlayers = [p.name];
      } else if (rc === maxResourcesCollected && rc > 0) {
        maxResPlayers.push(p.name);
      }
    });
  }

  let maxDevCardsBought = 0;
  let maxDevPlayers = [];
  if (game?.players) {
    game.players.forEach(p => {
      const dcb = p.stats?.devCardsBought || 0;
      if (dcb > maxDevCardsBought) {
        maxDevCardsBought = dcb;
        maxDevPlayers = [p.name];
      } else if (dcb === maxDevCardsBought && dcb > 0) {
        maxDevPlayers.push(p.name);
      }
    });
  }

  const roadWinner = game?.longestRoadHolder 
    ? game.players.find(p => p.id === game.longestRoadHolder)?.name 
    : null;

  const armyWinner = game?.largestArmyHolder
    ? game.players.find(p => p.id === game.largestArmyHolder)?.name
    : null;

  const winnerPlayer = game?.players?.find(p => p.id === game.winner);
  const isHost = room?.hostId === playerId;

  // 5. Active Game Layout
  return (
    <div className="app-container">
      {game?.winner && (
        <div className="game-over-overlay">
          <div className="glass-panel game-over-modal">
            <h1 className="game-over-title">🏆 {language === 'es' ? 'Partida Concluida' : 'Game Finished'} 🏆</h1>
            <p className="game-over-winner-announcement">
              {language === 'es' ? 'Felicidades a' : 'Congratulations to'}{' '}
              <strong style={{ color: winnerPlayer?.color }}>{winnerPlayer?.name}</strong>{' '}
              {language === 'es' ? `por ganar con ${winnerPlayer?.victoryPoints} puntos!` : `for winning with ${winnerPlayer?.victoryPoints} points!`}
            </p>

            {/* Tab buttons */}
            <div className="stats-tabs">
              <button 
                className={`tab-btn ${gameOverTab === 'awards' ? 'active' : ''}`}
                onClick={() => setGameOverTab('awards')}
              >
                🏅 {language === 'es' ? 'Premios y Logros' : 'Awards & Achievements'}
              </button>
              <button 
                className={`tab-btn ${gameOverTab === 'dice' ? 'active' : ''}`}
                onClick={() => setGameOverTab('dice')}
              >
                📊 {language === 'es' ? 'Tiradas de Dados' : 'Dice Statistics'}
              </button>
            </div>

            {/* Tab content */}
            <div className="stats-tab-content">
              {gameOverTab === 'awards' ? (
                <div className="awards-list">
                  <div className="award-item">
                    <div className="award-icon">🌾</div>
                    <div className="award-details">
                      <strong>{language === 'es' ? 'El Gran Agricultor' : 'The Grand Farmer'}</strong>
                      <span>{language === 'es' ? 'Más recursos recolectados:' : 'Most resources collected:'} {maxResourcesCollected}</span>
                      <small>{maxResPlayers.length > 0 ? maxResPlayers.join(', ') : '---'}</small>
                    </div>
                  </div>

                  <div className="award-item">
                    <div className="award-icon">📜</div>
                    <div className="award-details">
                      <strong>{language === 'es' ? 'El Erudito de las Cartas' : 'The Card Scholar'}</strong>
                      <span>{language === 'es' ? 'Más cartas de desarrollo compradas:' : 'Most dev cards bought:'} {maxDevCardsBought}</span>
                      <small>{maxDevPlayers.length > 0 ? maxDevPlayers.join(', ') : '---'}</small>
                    </div>
                  </div>

                  <div className="award-item">
                    <div className="award-icon">⚔️</div>
                    <div className="award-details">
                      <strong>{language === 'es' ? 'El Gran General' : 'The Grand General'}</strong>
                      <span>{language === 'es' ? 'Mayor ejército (Caballeros jugados):' : 'Largest Army (Played Knights):'} {game?.largestArmySize || 0}</span>
                      <small>{armyWinner || '---'}</small>
                    </div>
                  </div>

                  <div className="award-item">
                    <div className="award-icon">🛣️</div>
                    <div className="award-details">
                      <strong>{language === 'es' ? 'El Gran Arquitecto' : 'The Grand Architect'}</strong>
                      <span>{language === 'es' ? 'Mayor ruta comercial (Caminos consecutivos):' : 'Longest Road (Consecutive Roads):'} {game?.longestRoadLength || 0}</span>
                      <small>{roadWinner || '---'}</small>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="dice-stats-panel">
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    {language === 'es' ? `Total de tiradas: ${totalRolls}` : `Total rolls: ${totalRolls}`}
                  </h3>
                  <div className="dice-bars-container">
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => {
                      const count = game?.diceStats ? (game.diceStats[num] || 0) : 0;
                      const pct = totalRolls > 0 ? Math.round((count / totalRolls) * 100) : 0;
                      
                      return (
                        <div key={num} className="dice-bar-row">
                          <span className="dice-bar-number">{num}</span>
                          <div className="dice-bar-wrapper">
                            <div className="dice-bar-fill" style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                          <span className="dice-bar-value">{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="game-over-actions">
              {isHost ? (
                <button 
                  className="btn-action-main"
                  onClick={handleResetGame}
                  style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #d97706 100%)', width: 'auto', padding: '0.8rem 2.5rem' }}
                >
                  🔄 {language === 'es' ? 'Volver a la Sala' : 'Return to Lobby'}
                </button>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontStyle: 'italic', margin: 0 }}>
                  ⌛ {language === 'es' ? 'Esperando que el anfitrión vuelva a la sala...' : 'Waiting for host to return to lobby...'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <header className="app-header">
        <div className="logo">🎲 {t.title}</div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {t.room_code}: <strong style={{ color: 'var(--accent)' }}>{room.id}</strong>
          </span>
          <button className="btn-lang" onClick={toggleLanguage}>
            {t.lang_btn}
          </button>
        </div>
      </header>

      <main className="game-container">
        <div className="glass-panel board-area">
          <GameBoard
            game={room.game}
            playerId={playerId}
            buildMode={buildMode}
            onAction={handleGameAction}
            language={language}
          />
        </div>
        
        <div className="glass-panel side-panel">
          <GamePanel
            game={room.game}
            playerId={playerId}
            buildMode={buildMode}
            setBuildMode={setBuildMode}
            onAction={handleGameAction}
            language={language}
            isHost={room.hostId === playerId}
            onResetGame={handleResetGame}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
