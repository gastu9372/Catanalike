// client/src/components/GamePanel.jsx
import React, { useState } from 'react';
import translations from '../i18n';

const COSTS = {
  road: { wood: 1, clay: 1 },
  settlement: { wood: 1, clay: 1, wheat: 1, sheep: 1 },
  city: { wheat: 2, ore: 3 },
  devCard: { wheat: 1, sheep: 1, ore: 1 }
};

// Client-side helper to calculate bank trade rates based on owned ports
const getTradeRate = (player, board, resource) => {
  if (!player || !board || !board.ports) return 4;
  let bestRate = 4;
  board.ports.forEach(port => {
    const isOwned = port.vertexIds.some(vId => board.vertexStates[vId].owner === player.id);
    if (isOwned) {
      if (port.type === 'generic' && bestRate > 3) {
        bestRate = 3;
      } else if (port.type === resource && bestRate > 2) {
        bestRate = 2;
      }
    }
  });
  return bestRate;
};

function GamePanel({ game, playerId, buildMode, setBuildMode, onAction, language, isHost, onResetGame }) {
  const t = translations[language];

  // Active player and turn tracking
  const activePlayerId = game.phase.startsWith('setup')
    ? game.turnOrder[game.setupTurnIndex]
    : game.turnOrder[game.currentTurnIndex];

  const activePlayer = game.players.find(p => p.id === activePlayerId);
  const isMyTurn = activePlayerId === playerId;
  const me = game.players.find(p => p.id === playerId);

  const isDevMode = new URLSearchParams(window.location.search).get('dev') === 'true' || new URLSearchParams(window.location.search).get('debug') === 'true';

  // --- LOCAL COMPONENT STATES ---
  // Bank trading inputs
  const [bankGiveRes, setBankGiveRes] = useState('wood');
  const [bankGetRes, setBankGetRes] = useState('clay');

  // Player-to-player trade creation inputs
  const [tradeOffer, setTradeOffer] = useState({ wood: 0, clay: 0, wheat: 0, sheep: 0, ore: 0 });
  const [tradeDemand, setTradeDemand] = useState({ wood: 0, clay: 0, wheat: 0, sheep: 0, ore: 0 });

  // Play development cards sub-states
  const [playingMonopoly, setPlayingMonopoly] = useState(false);
  const [playingYoP, setPlayingYoP] = useState(false);
  const [yopSelected, setYopSelected] = useState([]); // tracks res1, res2 selection

  // Local decline track
  const [declinedTradeId, setDeclinedTradeId] = useState(null);

  // Dev mode toggle state
  const [showDevPanel, setShowDevPanel] = useState(false);

  // Reset local states
  const resetTradeForm = () => {
    setTradeOffer({ wood: 0, clay: 0, wheat: 0, sheep: 0, ore: 0 });
    setTradeDemand({ wood: 0, clay: 0, wheat: 0, sheep: 0, ore: 0 });
  };

  // Helper to count total resources in hand
  const getTotalCards = (player) => {
    if (!player) return 0;
    return Object.values(player.resources).reduce((sum, count) => sum + count, 0);
  };

  const canAfford = (player, type) => {
    if (!player) return false;
    const cost = COSTS[type];
    for (let res in cost) {
      if ((player.resources[res] || 0) < cost[res]) return false;
    }
    return true;
  };

  const handleBuildSelect = (type) => {
    setBuildMode(buildMode === type ? null : type);
  };

  // --- BANK TRADE EXECUTION ---
  const handleBankTradeSubmit = (e) => {
    e.preventDefault();
    if (bankGiveRes === bankGetRes) return;
    onAction('bank_trade', { giveResource: bankGiveRes, getResource: bankGetRes });
  };

  // --- PLAYER TRADE SUBMIT ---
  const handlePlayerTradeSubmit = (e) => {
    e.preventDefault();
    // Validate we are offering at least one resource and demanding at least one
    const offerSum = Object.values(tradeOffer).reduce((a, b) => a + b, 0);
    const demandSum = Object.values(tradeDemand).reduce((a, b) => a + b, 0);
    if (offerSum === 0 || demandSum === 0) return;

    onAction('offer_trade', { offer: tradeOffer, demand: tradeDemand });
    resetTradeForm();
  };

  // --- DEV CARD PLAY HANDLERS ---
  const handlePlayKnight = () => {
    onAction('play_dev_card', { cardType: 'knight', options: {} });
  };

  const handlePlayRoadBuilding = () => {
    onAction('play_dev_card', { cardType: 'roadBuilding', options: {} });
  };

  const handlePlayMonopolySelect = (res) => {
    onAction('play_dev_card', { cardType: 'monopoly', options: { resource: res } });
    setPlayingMonopoly(false);
  };

  const handlePlayYoPSelect = (res) => {
    const selected = [...yopSelected, res];
    if (selected.length === 2) {
      onAction('play_dev_card', { 
        cardType: 'yearOfPlenty', 
        options: { res1: selected[0], res2: selected[1] } 
      });
      setYopSelected([]);
      setPlayingYoP(false);
    } else {
      setYopSelected(selected);
    }
  };

  const renderResourceName = (res) => {
    return t[res] || res;
  };

  // Calculate current dynamic rate for the bank trade panel
  const currentBankRate = me ? getTradeRate(me, game.board, bankGiveRes) : 4;

  return (
    <>

      {/* 1. TURN STATE BANNER */}
      <div className="panel-header">
        <div className="turn-banner" style={{ borderLeft: `5px solid ${activePlayer?.color}` }}>
          <span>
            {t.turn_of} <strong style={{ color: activePlayer?.color }}>{activePlayer?.name}</strong>
          </span>
        </div>
        {game.phase.startsWith('setup') ? (
          <span className="active-phase-badge">{t.setup_phase}</span>
        ) : game.phase === 'robber_move' ? (
          <span className="active-phase-badge" style={{ backgroundColor: '#7f8c8d' }}>
            🕵️ {t.robber_move_title}
          </span>
        ) : game.phase === 'robber_steal' ? (
          <span className="active-phase-badge" style={{ backgroundColor: '#7f8c8d' }}>
            👥 {t.robber_steal_title}
          </span>
        ) : game.phase === 'road_building_phase' ? (
          <span className="active-phase-badge" style={{ backgroundColor: 'var(--accent)' }}>
            🛠️ {t.roadBuilding}
          </span>
        ) : (
          isMyTurn && !game.diceRolled && (
            <span className="active-phase-badge" style={{ backgroundColor: 'var(--accent)' }}>
              {language === 'es' ? 'Tira los dados' : 'Roll the dice'}
            </span>
          )
        )}
      </div>

      {/* 2. INCOMING TRADE BANNER NOTIFICATION */}
      {game.activeTrade && game.activeTrade.senderId !== playerId && declinedTradeId !== game.activeTrade && (
        <div className="trade-banner">
          <h4 style={{ color: '#fbc02d', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            🤝 {t.incoming_trade}
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.4rem 0' }}>
            {t.trade_offered_by}: <strong>{game.players.find(p => p.id === game.activeTrade.senderId)?.name}</strong>
          </p>
          <div className="trade-exchange-row">
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.give}:</span>
              <div style={{ marginTop: '0.2rem' }}>
                {Object.entries(game.activeTrade.demand).map(([res, qty]) => qty > 0 && (
                  <span key={res} className="trade-res-pill">
                    {qty} {res === 'wood' ? '🪵' : res === 'clay' ? '🧱' : res === 'wheat' ? '🌾' : res === 'sheep' ? '🐑' : '🪨'}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '25px', alignSelf: 'center' }} />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.receive}:</span>
              <div style={{ marginTop: '0.2rem' }}>
                {Object.entries(game.activeTrade.offer).map(([res, qty]) => qty > 0 && (
                  <span key={res} className="trade-res-pill">
                    {qty} {res === 'wood' ? '🪵' : res === 'clay' ? '🧱' : res === 'wheat' ? '🌾' : res === 'sheep' ? '🐑' : '🪨'}
                  </span>
                ))}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
            <button 
              className="btn-build" 
              onClick={() => onAction('accept_trade')}
              style={{ background: 'var(--accent)', flex: 1, padding: '0.5rem', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}
            >
              ✔️ {t.accept}
            </button>
            <button 
              className="btn-build" 
              onClick={() => setDeclinedTradeId(game.activeTrade)}
              style={{ flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: 'none', borderRadius: '6px' }}
            >
              ❌ {t.decline}
            </button>
          </div>
        </div>
      )}

      {/* 3. ROBBER STEALING CANDIDATES BUTTONS */}
      {isMyTurn && game.phase === 'robber_steal' && game.stealCandidates?.length > 0 && (
        <div className="sub-panel-card" style={{ border: '1px solid #ff4d4d', background: 'rgba(255, 77, 77, 0.05)' }}>
          <h4 style={{ color: '#ff4d4d', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            👤 {t.robber_steal_title}
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>
            {t.robber_steal_instruction}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {game.stealCandidates.map(candId => {
              const target = game.players.find(p => p.id === candId);
              return target && (
                <button
                  key={candId}
                  className="btn-primary"
                  onClick={() => onAction('steal_card', { targetPlayerId: candId })}
                  style={{ background: target.color, padding: '0.7rem', color: '#000', filter: 'brightness(0.95)', textShadow: '0 1px 1px rgba(255,255,255,0.2)' }}
                >
                  🎭 {target.name} ({getTotalCards(target)} {language === 'es' ? 'cartas' : 'cards'})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. PLAYERS STATS LIST */}
      <div className="players-stats">
        {game.players.map(p => (
          <div 
            key={p.id} 
            className={`player-stat-card ${p.id === activePlayerId ? 'active-turn' : ''}`}
          >
             <div className="player-stat-name" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
               <div 
                 className="player-color-dot" 
                 style={{ backgroundColor: p.color, color: p.color }} 
               />
               <span style={{ textDecoration: p.id === activePlayerId ? 'underline' : 'none' }}>
                 {p.name} {p.isBot && '(Bot)'}
               </span>
               {game.longestRoadHolder === p.id && (
                 <span className="achievement-badge road" title={language === 'es' ? `Mayor ruta comercial (${game.longestRoadLength} caminos) (+2 Ptos)` : `Longest Road (${game.longestRoadLength} roads) (+2 Pts)`}>
                   👑🛣️
                 </span>
               )}
               {game.largestArmyHolder === p.id && (
                 <span className="achievement-badge army" title={language === 'es' ? `Mayor ejército (${game.largestArmySize} caballeros) (+2 Ptos)` : `Largest Army (${game.largestArmySize} knights) (+2 Pts)`}>
                   👑⚔️
                 </span>
               )}
             </div>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                🎴 {getTotalCards(p)}
              </span>
              <div className="player-stat-vps">
                {t.victory_points}: <span>{p.id === playerId ? p.victoryPoints : p.publicVictoryPoints}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 5. PLAYER RESOURCE HAND */}
      {me && (
        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
          <h4 style={{ marginBottom: '0.8rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            {t.resources}
          </h4>
          <div className="resources-grid">
            <div className="resource-card wood">
              <div>🪵</div>
              <div className="resource-count">{me.resources.wood}</div>
            </div>
            <div className="resource-card clay">
              <div>🧱</div>
              <div className="resource-count">{me.resources.clay}</div>
            </div>
            <div className="resource-card wheat">
              <div>🌾</div>
              <div className="resource-count">{me.resources.wheat}</div>
            </div>
            <div className="resource-card sheep">
              <div>🐑</div>
              <div className="resource-count">{me.resources.sheep}</div>
            </div>
            <div className="resource-card ore">
              <div>🪨</div>
              <div className="resource-count">{me.resources.ore}</div>
            </div>
          </div>
        </div>
      )}

      {/* 6. TURN ACTIONS CONTROLLER */}
      {isMyTurn && game.phase === 'normal' && (
        <div className="player-actions">
          {!game.diceRolled ? (
            <button 
              className="btn-action-main" 
              onClick={() => onAction('roll_dice')}
            >
              🎲 {t.roll_dice}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              
              {/* Show dice faces */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', margin: '0.3rem 0' }}>
                <div className="dice-face">{game.dice[0]}</div>
                <div className="dice-face">{game.dice[1]}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                  = {game.dice[0] + game.dice[1]}
                </div>
              </div>

              {/* Build buttons grid */}
              <div className="build-buttons-group">
                <button 
                  className={`btn-build ${buildMode === 'road' ? 'active-selection' : ''}`}
                  disabled={!canAfford(me, 'road')}
                  onClick={() => handleBuildSelect('road')}
                >
                  🛠️ {t.build_road}
                </button>
                <button 
                  className={`btn-build ${buildMode === 'settlement' ? 'active-selection' : ''}`}
                  disabled={!canAfford(me, 'settlement')}
                  onClick={() => handleBuildSelect('settlement')}
                >
                  🏠 {t.build_settlement}
                </button>
                <button 
                  className={`btn-build ${buildMode === 'city' ? 'active-selection' : ''}`}
                  disabled={!canAfford(me, 'city')}
                  onClick={() => handleBuildSelect('city')}
                >
                  🏰 {t.build_city}
                </button>
              </div>

              {/* End turn button */}
              <button 
                className="btn-action-main" 
                onClick={() => onAction('end_turn')}
                style={{ background: 'linear-gradient(135deg, #4b5563 0%, #1f2937 100%)', boxShadow: 'none' }}
              >
                ⏭️ {t.end_turn}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 7. DEVELOPMENT CARDS PANEL */}
      {me && (
        <div className="sub-panel-card">
          <div className="sub-panel-title">
            <span>✨ {t.dev_cards_title}</span>
            {isMyTurn && game.phase === 'normal' && game.diceRolled && (
              <button 
                onClick={() => onAction('buy_dev_card')}
                disabled={!canAfford(me, 'devCard')}
                style={{ background: 'none', border: 'none', color: canAfford(me, 'devCard') ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 'bold', fontSize: '0.8rem', textDecoration: canAfford(me, 'devCard') ? 'underline' : 'none', cursor: canAfford(me, 'devCard') ? 'pointer' : 'not-allowed' }}
              >
                {t.buy_dev_card}
              </button>
            )}
          </div>

          {/* Dev Card list display */}
          <div className="dev-cards-row">
            {me.devCards && Object.entries(me.devCards).map(([card, count]) => count > 0 && (
              <div key={card} className="dev-card-pill">
                <span className="dev-card-count">{count}</span>
                <span style={{ fontSize: '0.75rem', textAlign: 'center' }}>{t[card]}</span>
                {isMyTurn && game.phase === 'normal' && game.diceRolled && card !== 'victoryPoint' && (() => {
                  const boughtThisTurn = me.boughtDevCardsThisTurn?.[card] || 0;
                  const isBoughtThisTurn = count - boughtThisTurn <= 0;
                  const isDisabled = game.devCardPlayedThisTurn || isBoughtThisTurn;
                  
                  let tooltip = '';
                  if (game.devCardPlayedThisTurn) {
                    tooltip = language === 'es' ? 'Ya jugaste una carta este turno' : 'Already played a card this turn';
                  } else if (isBoughtThisTurn) {
                    tooltip = language === 'es' ? 'No puedes jugar una carta en el mismo turno que la compraste' : 'You cannot play a card on the same turn you bought it';
                  }

                  return (
                    <button 
                      className="btn-play-card"
                      disabled={isDisabled}
                      style={{
                        opacity: isDisabled ? 0.5 : 1,
                        cursor: isDisabled ? 'not-allowed' : 'pointer'
                      }}
                      title={tooltip}
                      onClick={() => {
                        if (card === 'knight') handlePlayKnight();
                        else if (card === 'roadBuilding') handlePlayRoadBuilding();
                        else if (card === 'monopoly') setPlayingMonopoly(true);
                        else if (card === 'yearOfPlenty') setPlayingYoP(true);
                      }}
                    >
                      {t.play}
                    </button>
                  );
                })()}
              </div>
            ))}
            {(!me.devCards || Object.values(me.devCards).reduce((a,b)=>a+b,0) === 0) && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                {t.no_dev_cards}
              </span>
            )}
          </div>

          {/* Inline Monopoly resource selector */}
          {playingMonopoly && (
            <div className="sub-panel-card" style={{ marginTop: '0.8rem', border: '1px solid var(--accent)' }}>
              <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>{t.monopoly_select}</p>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {['wood', 'clay', 'wheat', 'sheep', 'ore'].map(res => (
                  <button 
                    key={res} 
                    className="btn-build"
                    onClick={() => handlePlayMonopolySelect(res)}
                  >
                    {res === 'wood' ? '🪵' : res === 'clay' ? '🧱' : res === 'wheat' ? '🌾' : res === 'sheep' ? '🐑' : '🪨'}
                  </button>
                ))}
                <button className="btn-build" onClick={() => setPlayingMonopoly(false)} style={{ background: '#ef4444' }}>
                  X
                </button>
              </div>
            </div>
          )}

          {/* Inline Year of Plenty selector */}
          {playingYoP && (
            <div className="sub-panel-card" style={{ marginTop: '0.8rem', border: '1px solid var(--accent)' }}>
              <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                {t.yop_select} ({yopSelected.length}/2)
              </p>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {['wood', 'clay', 'wheat', 'sheep', 'ore'].map(res => (
                  <button 
                    key={res} 
                    className="btn-build"
                    onClick={() => handlePlayYoPSelect(res)}
                  >
                    {res === 'wood' ? '🪵' : res === 'clay' ? '🧱' : res === 'wheat' ? '🌾' : res === 'sheep' ? '🐑' : '🪨'}
                  </button>
                ))}
                <button className="btn-build" onClick={() => { setPlayingYoP(false); setYopSelected([]); }} style={{ background: '#ef4444' }}>
                  X
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. TRADING CONTROL PANEL */}
      {me && isMyTurn && game.phase === 'normal' && game.diceRolled && (
        <div className="sub-panel-card">
          <div className="sub-panel-title">
            <span>🤝 {t.trade_title}</span>
          </div>

          {/* A: BANK TRADING FORM */}
          <form onSubmit={handleBankTradeSubmit} style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.8rem', marginBottom: '0.8rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
              🏦 {t.trade_bank}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem' }}>{t.give} {currentBankRate}:</span>
              <select 
                value={bankGiveRes} 
                onChange={(e) => setBankGiveRes(e.target.value)}
                style={{ background: '#111827', border: '1px solid var(--border-glass)', color: '#fff', padding: '0.2rem', borderRadius: '4px' }}
              >
                {['wood', 'clay', 'wheat', 'sheep', 'ore'].map(res => (
                  <option key={res} value={res}>{renderResourceName(res)}</option>
                ))}
              </select>

              <span style={{ fontSize: '0.8rem' }}>{t.receive} 1:</span>
              <select 
                value={bankGetRes} 
                onChange={(e) => setBankGetRes(e.target.value)}
                style={{ background: '#111827', border: '1px solid var(--border-glass)', color: '#fff', padding: '0.2rem', borderRadius: '4px' }}
              >
                {['wood', 'clay', 'wheat', 'sheep', 'ore'].map(res => (
                  <option key={res} value={res}>{renderResourceName(res)}</option>
                ))}
              </select>
              
              <button 
                type="submit" 
                className="btn-build"
                disabled={me.resources[bankGiveRes] < currentBankRate || bankGiveRes === bankGetRes}
                style={{ flexGrow: 1 }}
              >
                💱
              </button>
            </div>
          </form>

          {/* B: PLAYER TRADING FORM */}
          {!game.activeTrade ? (
            <form onSubmit={handlePlayerTradeSubmit}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                👥 {t.trade_players}
              </span>
              
              {/* Give resources list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.give}:</span>
                <div style={{ display: 'flex', gap: '0.2rem' }}>
                  {['wood', 'clay', 'wheat', 'sheep', 'ore'].map(res => (
                    <div key={res} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <span style={{ fontSize: '0.9rem' }}>{res === 'wood' ? '🪵' : res === 'clay' ? '🧱' : res === 'wheat' ? '🌾' : res === 'sheep' ? '🐑' : '🪨'}</span>
                      <input 
                        type="number" 
                        min="0" 
                        max={me.resources[res] || 0}
                        value={tradeOffer[res]}
                        onChange={(e) => setTradeOffer({...tradeOffer, [res]: parseInt(e.target.value) || 0})}
                        style={{ width: '100%', background: '#111827', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.8rem', padding: '0.1rem', borderRadius: '4px', textAlign: 'center' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Demand resources list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.8rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.receive}:</span>
                <div style={{ display: 'flex', gap: '0.2rem' }}>
                  {['wood', 'clay', 'wheat', 'sheep', 'ore'].map(res => (
                    <div key={res} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <span style={{ fontSize: '0.9rem' }}>{res === 'wood' ? '🪵' : res === 'clay' ? '🧱' : res === 'wheat' ? '🌾' : res === 'sheep' ? '🐑' : '🪨'}</span>
                      <input 
                        type="number" 
                        min="0" 
                        max="9"
                        value={tradeDemand[res]}
                        onChange={(e) => setTradeDemand({...tradeDemand, [res]: parseInt(e.target.value) || 0})}
                        style={{ width: '100%', background: '#111827', border: '1px solid var(--border-glass)', color: '#fff', fontSize: '0.8rem', padding: '0.1rem', borderRadius: '4px', textAlign: 'center' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                📢 {t.propose_trade}
              </button>
            </form>
          ) : (
            <div>
              <p style={{ fontSize: '0.85rem', color: '#fbc02d', marginBottom: '0.5rem' }}>
                ⚠️ {language === 'es' ? 'Oferta propuesta enviada a la sala...' : 'Trade offer sent to players...'}
              </p>
              <button 
                className="btn-primary" 
                onClick={() => onAction('cancel_trade')}
                style={{ background: '#ef4444', padding: '0.5rem', fontSize: '0.85rem' }}
              >
                🚫 {t.cancel}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 9. BUILDING COST TABLE */}
      <div className="building-costs">
        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
          {t.costs}
        </h4>
        <div className="costs-list">
          <div className="cost-row">
            <span>🏠 {t.build_settlement}</span>
            <div className="cost-items">
              <span className="cost-pill wood">1</span>
              <span className="cost-pill clay">1</span>
              <span className="cost-pill wheat">1</span>
              <span className="cost-pill sheep">1</span>
            </div>
          </div>
          <div className="cost-row">
            <span>🛠️ {t.build_road}</span>
            <div className="cost-items">
              <span className="cost-pill wood">1</span>
              <span className="cost-pill clay">1</span>
            </div>
          </div>
          <div className="cost-row">
            <span>🏰 {t.build_city}</span>
            <div className="cost-items">
              <span className="cost-pill wheat">2</span>
              <span className="cost-pill ore">3</span>
            </div>
          </div>
        </div>
      </div>

      {/* 10. LOG PANEL HISTORY */}
      <div className="logs-panel">
        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          📜 {t.log_title}
        </h4>
        <div className="logs-list">
          {[...game.log].reverse().map((entry, idx) => (
            <div key={idx} className="log-row">
              {entry.message[language] || entry.message.en}
            </div>
          ))}
        </div>
      </div>

      {/* 11. DEV/DEBUGGING PANEL */}
      {isDevMode && (
        <div className="sub-panel-card" style={{ marginTop: '1rem', border: '1px solid var(--border-glass)', background: 'rgba(255, 255, 255, 0.03)' }}>
          <button 
            onClick={() => setShowDevPanel(!showDevPanel)}
            style={{ width: '100%', background: 'none', border: 'none', color: '#a0aec0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: 0 }}
          >
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>🔧 {language === 'es' ? 'Modo de Depuración (Dev)' : 'Debug Mode (Dev)'}</span>
            <span style={{ fontSize: '0.8rem' }}>{showDevPanel ? '▲' : '▼'}</span>
          </button>
  
          {showDevPanel && (
            <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.8rem' }}>
              {/* Resources, Played Knights, and Instant Win */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button 
                  className="btn-build"
                  onClick={() => onAction('dev_action', { command: 'add_resources', payload: {} })}
                  style={{ flex: '1 1 45%', fontSize: '0.8rem', padding: '0.4rem 0' }}
                >
                  📥 +5 {language === 'es' ? 'Recursos' : 'Resources'}
                </button>
                <button 
                  className="btn-build"
                  onClick={() => onAction('dev_action', { command: 'add_played_knight', payload: {} })}
                  style={{ flex: '1 1 45%', fontSize: '0.8rem', padding: '0.4rem 0' }}
                >
                  ⚔️ +1 {language === 'es' ? 'Cab. Jugado' : 'Pl. Knight'}
                </button>
                <button 
                  className="btn-build"
                  onClick={() => onAction('dev_action', { command: 'win_game', payload: {} })}
                  style={{ flex: '1 1 100%', fontSize: '0.8rem', padding: '0.4rem 0', background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', color: '#fff', border: 'none' }}
                >
                  👑 {language === 'es' ? 'Ganar Partida' : 'Win Game'}
                </button>
              </div>
  
              {/* Dev Cards row */}
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  🎴 {language === 'es' ? 'Agregar Carta de Desarrollo' : 'Add Development Card'}:
                </span>
                <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                  {[
                    { type: 'victoryPoint', emoji: '🏆', label: 'VP' },
                    { type: 'knight', emoji: '🛡️', label: 'Kn' },
                    { type: 'roadBuilding', emoji: '🛠️', label: 'Rd' },
                    { type: 'yearOfPlenty', emoji: '🌾', label: 'YoP' },
                    { type: 'monopoly', emoji: '📜', label: 'Mon' }
                  ].map(card => (
                    <button
                      key={card.type}
                      className="btn-build"
                      onClick={() => onAction('dev_action', { command: 'add_dev_card', payload: { cardType: card.type } })}
                      style={{ flex: '1 0 18%', fontSize: '0.7rem', padding: '0.3rem 0' }}
                      title={card.type}
                    >
                      {card.emoji} {card.label}
                    </button>
                  ))}
                </div>
              </div>
  
              {/* Dice forced rolls */}
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>
                  🎲 {language === 'es' ? 'Forzar Tirada de Dados' : 'Force Dice Roll'}:
                </span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {[
                    { r1: 3, r2: 4, label: '7 (Ladrón)' },
                    { r1: 3, r2: 3, label: '6' },
                    { r1: 4, r2: 4, label: '8' }
                  ].map(roll => (
                    <button
                      key={roll.label}
                      className="btn-build"
                      onClick={() => onAction('dev_action', { command: 'set_dice', payload: { roll1: roll.r1, roll2: roll.r2 } })}
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.3rem 0' }}
                    >
                      🎲 {roll.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default GamePanel;
