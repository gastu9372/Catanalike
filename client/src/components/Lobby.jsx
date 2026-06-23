// client/src/components/Lobby.jsx
import React from 'react';
import translations from '../i18n';

function Lobby({ room, playerId, onAddBot, onKick, onStart, language }) {
  const t = translations[language];
  const isHost = room.hostId === playerId;
  const canStart = room.players.length >= 2;

  return (
    <div className="lobby-grid">
      <div className="glass-panel lobby-panel">
        <h2>{t.players}</h2>
        <div className="players-list">
          {room.players.map((player, idx) => {
            const playerColor = ['#ff4d4d', '#4da6ff', '#5cd65c', '#ffcc00'][idx];
            const isPlayerHost = room.hostId === player.id;
            
            return (
              <div key={player.id} className="player-row">
                <div className="player-info">
                  <div 
                    className="player-color-dot" 
                    style={{ backgroundColor: playerColor, color: playerColor }} 
                  />
                  <span className="player-name">{player.name}</span>
                  {player.isBot && <span className="player-badge">IA / BOT</span>}
                  {isPlayerHost && <span className="player-badge host">{t.host}</span>}
                </div>
                
                {isHost && player.id !== playerId && (
                  <button 
                    className="btn-kick" 
                    onClick={() => onKick(player.id)}
                  >
                    {t.kick}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-panel lobby-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h3>{t.room_code}</h3>
          <div className="lobby-code-display">{room.id}</div>
          <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {language === 'es' 
              ? 'Comparte este código con tus amigos para que se unan a la partida.'
              : 'Share this code with your friends so they can join the game.'
            }
          </p>
        </div>

        <div className="action-buttons" style={{ marginTop: '2rem' }}>
          {isHost ? (
            <>
              {room.players.length < 4 && (
                <button className="btn-secondary" onClick={onAddBot}>
                  ➕ {t.add_bot}
                </button>
              )}
              <button 
                className="btn-primary" 
                onClick={onStart}
                disabled={!canStart}
                style={{ opacity: canStart ? 1 : 0.5 }}
              >
                🎮 {t.start_game}
              </button>
              {!canStart && (
                <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', marginTop: '0.5rem' }}>
                  {t.need_players}
                </p>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>
              <span className="loading-spinner">⌛</span> {t.waiting_for_host}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Lobby;
