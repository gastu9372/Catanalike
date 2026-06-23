// client/src/components/GameBoard.jsx
import React, { useState, useEffect } from 'react';
import translations from '../i18n';

const HEX_SIZE = 60;

// Mapping port types to short representations/emojis
const PORT_EMOJIS = {
  generic: '3:1',
  wood: '🪵',
  clay: '🧱',
  wheat: '🌾',
  sheep: '🐑',
  ore: '🪨'
};

function GameBoard({ game, playerId, buildMode, onAction, language }) {
  const t = translations[language];

  // Local state for setup phase selection
  const [selectedSetupVertex, setSelectedSetupVertex] = useState(null);

  const activePlayerId = game.phase.startsWith('setup')
    ? game.turnOrder[game.setupTurnIndex]
    : game.turnOrder[game.currentTurnIndex];

  const isMyTurn = activePlayerId === playerId;

  useEffect(() => {
    setSelectedSetupVertex(null);
  }, [game.phase, game.currentTurnIndex, game.setupTurnIndex]);

  // --- GEOMETRIC HELPERS ---
  const getCornersPointsString = (cx, cy) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i + 30);
      const x = cx + HEX_SIZE * Math.cos(angle);
      const y = cy + HEX_SIZE * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  // --- VALIDATION HELPERS (CLIENT-SIDE) ---
  const checkDistanceRule = (vertexId) => {
    const vId = parseInt(vertexId);
    if (game.board.vertexStates[vId].owner !== null) return false;

    const adjacentVertices = [];
    game.board.edges.forEach(e => {
      if (e.v1 === vId) adjacentVertices.push(e.v2);
      if (e.v2 === vId) adjacentVertices.push(e.v1);
    });

    for (let adjId of adjacentVertices) {
      if (game.board.vertexStates[adjId].owner !== null) {
        return false;
      }
    }
    return true;
  };

  const checkRoadConnection = (vertexId) => {
    const vId = parseInt(vertexId);
    let connected = false;
    game.board.edges.forEach(e => {
      if ((e.v1 === vId || e.v2 === vId) && game.board.edgeStates[e.id].owner === playerId) {
        connected = true;
      }
    });
    return connected;
  };

  const getSelectableVertices = () => {
    if (!isMyTurn) return [];

    // Setup Phase
    if (game.phase.startsWith('setup')) {
      if (selectedSetupVertex !== null) return [];
      return game.board.vertices.filter(v => checkDistanceRule(v.id)).map(v => v.id);
    }

    // Normal Phase
    if (game.phase === 'normal') {
      if (!game.diceRolled) return [];

      if (buildMode === 'settlement') {
        return game.board.vertices
          .filter(v => checkDistanceRule(v.id) && checkRoadConnection(v.id))
          .map(v => v.id);
      }

      if (buildMode === 'city') {
        return game.board.vertices
          .filter(v => game.board.vertexStates[v.id].owner === playerId && game.board.vertexStates[v.id].type === 'settlement')
          .map(v => v.id);
      }
    }

    return [];
  };

  const getSelectableEdges = () => {
    if (!isMyTurn) return [];

    // Setup Phase
    if (game.phase.startsWith('setup')) {
      if (selectedSetupVertex === null) return [];
      return game.board.edges
        .filter(e => (e.v1 === selectedSetupVertex || e.v2 === selectedSetupVertex) && game.board.edgeStates[e.id].owner === null)
        .map(e => e.id);
    }

    // Normal Phase
    if (game.phase === 'normal' && game.diceRolled && buildMode === 'road') {
      return game.board.edges
        .filter(edge => {
          if (game.board.edgeStates[edge.id].owner !== null) return false;

          let isConnected = false;
          if (game.board.vertexStates[edge.v1].owner === playerId || game.board.vertexStates[edge.v2].owner === playerId) {
            isConnected = true;
          }
          game.board.edges.forEach(e => {
            if (e.id !== edge.id && game.board.edgeStates[e.id].owner === playerId) {
              if (e.v1 === edge.v1 || e.v1 === edge.v2 || e.v2 === edge.v1 || e.v2 === edge.v2) {
                isConnected = true;
              }
            }
          });
          return isConnected;
        })
        .map(e => e.id);
    }

    // Road Building Card Phase
    if (game.phase === 'road_building_phase') {
      return game.board.edges
        .filter(edge => {
          if (game.board.edgeStates[edge.id].owner !== null) return false;

          let isConnected = false;
          if (game.board.vertexStates[edge.v1].owner === playerId || game.board.vertexStates[edge.v2].owner === playerId) {
            isConnected = true;
          }
          game.board.edges.forEach(e => {
            if (e.id !== edge.id && game.board.edgeStates[e.id].owner === playerId) {
              if (e.v1 === edge.v1 || e.v1 === edge.v2 || e.v2 === edge.v1 || e.v2 === edge.v2) {
                isConnected = true;
              }
            }
          });
          return isConnected;
        })
        .map(e => e.id);
    }

    return [];
  };

  const selectableVertices = getSelectableVertices();
  const selectableEdges = getSelectableEdges();

  // --- ACTIONS HANDLERS ---
  const handleVertexClick = (vId) => {
    if (!isMyTurn) return;

    if (game.phase.startsWith('setup')) {
      setSelectedSetupVertex(vId);
    } else if (game.phase === 'normal') {
      if (buildMode === 'settlement') {
        onAction('build_settlement', { vertexId: vId });
      } else if (buildMode === 'city') {
        onAction('build_city', { vertexId: vId });
      }
    }
  };

  const handleEdgeClick = (edgeId) => {
    if (!isMyTurn) return;

    if (game.phase.startsWith('setup') && selectedSetupVertex !== null) {
      onAction('build_setup', { vertexId: selectedSetupVertex, edgeId });
      setSelectedSetupVertex(null);
    } else if (game.phase === 'normal' && buildMode === 'road') {
      onAction('build_road', { edgeId });
    } else if (game.phase === 'road_building_phase') {
      onAction('build_road', { edgeId });
    }
  };

  const handleHexClick = (hexId) => {
    if (isMyTurn && game.phase === 'robber_move') {
      if (hexId !== game.board.robberHexId) {
        onAction('move_robber', { hexId });
      }
    }
  };

  const getPlayerColor = (pId) => {
    const p = game.players.find(player => player.id === pId);
    return p ? p.color : '#ccc';
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      
      {/* Status banner */}
      {isMyTurn && (
        <div style={{ position: 'absolute', top: '15px', zIndex: 10, background: 'rgba(0,0,0,0.85)', padding: '0.4rem 1.2rem', borderRadius: '20px', border: '1px solid var(--accent)', fontSize: '0.9rem', color: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
          {game.phase.startsWith('setup') ? (
            selectedSetupVertex === null 
              ? (language === 'es' ? 'Fase de Fundación: Selecciona un Poblado' : 'Setup Phase: Select a Settlement placement')
              : (language === 'es' ? 'Fase de Fundación: Selecciona un Camino conectado' : 'Setup Phase: Select a connected Road')
          ) : game.phase === 'robber_move' ? (
            `🕵️ ${t.robber_move_title}: ${t.robber_move_instruction}`
          ) : game.phase === 'robber_steal' ? (
            `👥 ${t.robber_steal_title}`
          ) : game.phase === 'road_building_phase' ? (
            language === 'es' ? `🛠️ Construcción de Carreteras: Coloca un camino gratis (${game.freeRoadsToBuild} restantes)` : `🛠️ Road Building: Place a free road (${game.freeRoadsToBuild} left)`
          ) : (
            buildMode 
              ? `🏗️ ${t.building_mode} (${buildMode === 'road' ? t.build_road : buildMode === 'settlement' ? t.build_settlement : t.build_city})`
              : (language === 'es' ? '🟢 ¡Es tu turno!' : "🟢 It's your turn!")
          )}
          {buildMode && (
            <button 
              onClick={() => onAction(null)} 
              style={{ marginLeft: '10px', background: '#ef4444', color: '#fff', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              {t.cancel}
            </button>
          )}
        </div>
      )}

      {/* SVG Board Map: Increased ViewBox from -250 -220 500 440 to -320 -260 640 520 for perfect fitting */}
      <svg 
        viewBox="-320 -260 640 520" 
        className="svg-board"
      >
        {/* 1. DRAW PORT CONNECTING LINES & NODES */}
        <g id="ports">
          {game.board.ports?.map(port => {
            const v1 = game.board.vertices.find(v => v.id === port.vertexIds[0]);
            const v2 = game.board.vertices.find(v => v.id === port.vertexIds[1]);
            if (!v1 || !v2) return null;

            return (
              <g key={port.id}>
                {/* Dashed guidelines to vertices */}
                <line x1={port.x} y1={port.y} x2={v1.x} y2={v1.y} className="port-line" />
                <line x1={port.x} y1={port.y} x2={v2.x} y2={v2.y} className="port-line" />
                
                {/* Port anchor node */}
                <circle cx={port.x} cy={port.y} r="11" className="port-node" />
                <text cx={port.x} cy={port.y} x={port.x} y={port.y} className="port-text">
                  {PORT_EMOJIS[port.type] || '3:1'}
                </text>
              </g>
            );
          })}
        </g>

        {/* 2. DRAW HEX TILES */}
        <g id="hexes">
          {game.board.hexes.map(hex => {
            const isRobberHere = hex.id === game.board.robberHexId;
            const isSelectableForRobber = isMyTurn && game.phase === 'robber_move' && !isRobberHere;

            return (
              <g 
                key={hex.id} 
                transform={`translate(${hex.x}, ${hex.y})`}
                onClick={() => handleHexClick(hex.id)}
                style={{ cursor: isSelectableForRobber ? 'pointer' : 'default' }}
              >
                <polygon
                  points={getCornersPointsString(0, 0)}
                  className={`hex-tile hex-${hex.resource}`}
                  style={{
                    stroke: isSelectableForRobber ? 'var(--accent)' : 'rgba(255, 255, 255, 0.12)',
                    strokeWidth: isSelectableForRobber ? 4 : 2.5,
                    filter: isSelectableForRobber ? 'drop-shadow(0 0 8px var(--accent))' : 'none'
                  }}
                />
                
                {/* Hex numerical token */}
                {hex.number && (
                  <g>
                    <circle r="16" className="hex-number-token" />
                    <text
                      className={`hex-number-text ${[6, 8].includes(hex.number) ? 'high-prob' : ''}`}
                    >
                      {hex.number}
                    </text>
                  </g>
                )}

                {/* DRAW ROBBER TOKEN OVER THE CENTER */}
                {isRobberHere && (
                  <g>
                    <circle r="14" className="robber-token" />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{ fontSize: '15px' }}
                    >
                      🥷
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* 3. DRAW ROADS (EDGES) */}
        <g id="roads">
          {game.board.edges.map(edge => {
            const v1 = game.board.vertices.find(v => v.id === edge.v1);
            const v2 = game.board.vertices.find(v => v.id === edge.v2);
            if (!v1 || !v2) return null;

            const edgeState = game.board.edgeStates[edge.id];
            const isSelectable = selectableEdges.includes(edge.id);

            return (
              <g key={edge.id}>
                {edgeState.owner !== null && (
                  <line
                    x1={v1.x}
                    y1={v1.y}
                    x2={v2.x}
                    y2={v2.y}
                    className="built-road"
                    stroke={getPlayerColor(edgeState.owner)}
                  />
                )}

                {isSelectable && (
                  <line
                    x1={v1.x}
                    y1={v1.y}
                    x2={v2.x}
                    y2={v2.y}
                    className="interactive-edge selectable active-selection"
                    onClick={() => handleEdgeClick(edge.id)}
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* 4. DRAW SETTLEMENTS & CITIES (VERTICES) */}
        <g id="buildings">
          {game.board.vertices.map(vertex => {
            const buildState = game.board.vertexStates[vertex.id];
            const isSelectable = selectableVertices.includes(vertex.id);
            const isSetupSelected = selectedSetupVertex === vertex.id;

            return (
              <g key={vertex.id}>
                {buildState.owner !== null && buildState.type === 'settlement' && (
                  <polygon
                    points={`${vertex.x},${vertex.y - 7} ${vertex.x - 7},${vertex.y} ${vertex.x - 7},${vertex.y + 7} ${vertex.x + 7},${vertex.y + 7} ${vertex.x + 7},${vertex.y}`}
                    className="built-settlement"
                    fill={getPlayerColor(buildState.owner)}
                  />
                )}

                {buildState.owner !== null && buildState.type === 'city' && (
                  <polygon
                    points={`${vertex.x},${vertex.y - 10} ${vertex.x - 5},${vertex.y - 5} ${vertex.x - 5},${vertex.y} ${vertex.x - 10},${vertex.y} ${vertex.x - 10},${vertex.y + 10} ${vertex.x + 10},${vertex.y + 10} ${vertex.x + 10},${vertex.y - 5}`}
                    className="built-city"
                    fill={getPlayerColor(buildState.owner)}
                  />
                )}

                {isSelectable && (
                  <circle
                    cx={vertex.x}
                    cy={vertex.y}
                    r="8"
                    className="interactive-vertex selectable active-selection"
                    onClick={() => handleVertexClick(vertex.id)}
                  />
                )}

                {isSetupSelected && (
                  <polygon
                    points={`${vertex.x},${vertex.y - 7} ${vertex.x - 7},${vertex.y} ${vertex.x - 7},${vertex.y + 7} ${vertex.x + 7},${vertex.y + 7} ${vertex.x + 7},${vertex.y}`}
                    className="built-settlement"
                    fill={getPlayerColor(playerId)}
                    style={{ opacity: 0.6 }}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export default GameBoard;
