// server/gameLogic.js

// Resource types
const RESOURCES = {
  WOOD: 'wood',
  CLAY: 'clay',
  WHEAT: 'wheat',
  SHEEP: 'sheep',
  ORE: 'ore',
  DESERT: 'desert'
};

// Costs of buildings
const COSTS = {
  road: { [RESOURCES.WOOD]: 1, [RESOURCES.CLAY]: 1 },
  settlement: { [RESOURCES.WOOD]: 1, [RESOURCES.CLAY]: 1, [RESOURCES.WHEAT]: 1, [RESOURCES.SHEEP]: 1 },
  city: { [RESOURCES.WHEAT]: 2, [RESOURCES.ORE]: 3 },
  devCard: { [RESOURCES.WHEAT]: 1, [RESOURCES.SHEEP]: 1, [RESOURCES.ORE]: 1 }
};

// Hex size for layout math
const HEX_SIZE = 60;

/**
 * Generate coordinates for the 19 Catan hexagons.
 * Axial coordinate system (q, r).
 */
function generateHexCoordinates() {
  const hexes = [];
  const coords = [
    { q: 0, r: -2 }, { q: 1, r: -2 }, { q: 2, r: -2 },
    { q: -1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: 2, r: -1 },
    { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
    { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
    { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 }
  ];
  return coords;
}

/**
 * Calculates absolute X and Y pixel positions for a hex.
 */
function getHexCenter(q, r, size) {
  const x = size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const y = size * (3 / 2 * r);
  return { x, y };
}

/**
 * Shuffle array helper.
 */
function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Generates vertices and edges for the Catan board.
 */
function buildBoardTopology(hexes) {
  const vertices = [];
  const edges = [];
  const tolerance = 5.0;

  function getOrCreateVertex(x, y, hexIndex) {
    for (let v of vertices) {
      const dist = Math.hypot(v.x - x, v.y - y);
      if (dist < tolerance) {
        if (!v.hexes.includes(hexIndex)) {
          v.hexes.push(hexIndex);
        }
        return v.id;
      }
    }
    const newId = vertices.length;
    vertices.push({ id: newId, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, hexes: [hexIndex] });
    return newId;
  }

  hexes.forEach((hex, hexIdx) => {
    const center = getHexCenter(hex.q, hex.r, HEX_SIZE);
    const corners = [];

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i + 30);
      const cx = center.x + HEX_SIZE * Math.cos(angle);
      const cy = center.y + HEX_SIZE * Math.sin(angle);
      const vId = getOrCreateVertex(cx, cy, hexIdx);
      corners.push(vId);
    }

    for (let i = 0; i < 6; i++) {
      const v1 = corners[i];
      const v2 = corners[(i + 1) % 6];
      const edgeId = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;

      if (!edges.some(e => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          v1: Math.min(v1, v2),
          v2: Math.max(v1, v2)
        });
      }
    }
  });

  return { vertices, edges };
}

/**
 * Initialize a new board state with hexes, vertices, edges and ports.
 */
function createBoard() {
  const resourcesList = [
    RESOURCES.DESERT,
    RESOURCES.WOOD, RESOURCES.WOOD, RESOURCES.WOOD, RESOURCES.WOOD,
    RESOURCES.WHEAT, RESOURCES.WHEAT, RESOURCES.WHEAT, RESOURCES.WHEAT,
    RESOURCES.SHEEP, RESOURCES.SHEEP, RESOURCES.SHEEP, RESOURCES.SHEEP,
    RESOURCES.CLAY, RESOURCES.CLAY, RESOURCES.CLAY,
    RESOURCES.ORE, RESOURCES.ORE, RESOURCES.ORE
  ];

  const numbersList = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

  const shuffledResources = shuffle(resourcesList);
  const shuffledNumbers = shuffle(numbersList);

  const coords = generateHexCoordinates();
  let numIndex = 0;

  const hexes = coords.map((coord, idx) => {
    const resource = shuffledResources[idx];
    let number = null;
    if (resource !== RESOURCES.DESERT) {
      number = shuffledNumbers[numIndex++];
    }
    const center = getHexCenter(coord.q, coord.r, HEX_SIZE);
    return {
      id: idx,
      q: coord.q,
      r: coord.r,
      x: center.x,
      y: center.y,
      resource,
      number
    };
  });

  const { vertices, edges } = buildBoardTopology(hexes);

  const vertexStates = {};
  vertices.forEach(v => {
    vertexStates[v.id] = { owner: null, type: null };
  });

  const edgeStates = {};
  edges.forEach(e => {
    edgeStates[e.id] = { owner: null };
  });

  // GENERATE 9 STANDARD SPACED PORTS (Zero adjacency, identical to Catan layout)
  const ports = [];
  
  // 1. Find all border vertices (vertices touching only 1 or 2 hexes)
  const borderVertices = vertices.filter(v => v.hexes.length <= 2);
  
  // 2. Sort border vertices clockwise around the center (0,0)
  borderVertices.sort((a, b) => {
    const angleA = Math.atan2(a.y, a.x);
    const angleB = Math.atan2(b.y, b.x);
    return angleA - angleB;
  });

  // 3. Define port indices mapping (each port uses 2 consecutive vertices, separated by gaps)
  // We have exactly 30 border vertices. The indices of the 9 ports in the sorted list:
  const portVertexPairs = [
    [0, 1],
    [3, 4],
    [6, 7],
    [10, 11],
    [13, 14],
    [16, 17],
    [20, 21],
    [23, 24],
    [26, 27]
  ];

  // 4. Define and shuffle the 9 port types (4 generic 3:1, 5 resource 2:1)
  const portTypes = shuffle([
    'generic', 'wood', 'clay', 'wheat', 'sheep', 'ore', 'generic', 'generic', 'generic'
  ]);

  // 5. Build ports
  portVertexPairs.forEach((pair, pIdx) => {
    const v1 = borderVertices[pair[0]];
    const v2 = borderVertices[pair[1]];
    const type = portTypes[pIdx];

    // Midpoint
    const mx = (v1.x + v2.x) / 2;
    const my = (v1.y + v2.y) / 2;
    const dist = Math.hypot(mx, my) || 1;
    
    // Shift outwards by 16 units
    const px = mx + (mx / dist) * 16;
    const py = my + (my / dist) * 16;

    ports.push({
      id: pIdx,
      type,
      vertexIds: [v1.id, v2.id],
      x: Math.round(px * 100) / 100,
      y: Math.round(py * 100) / 100
    });
  });

  // Initial Robber placement: on desert hex
  const desertHexIdx = hexes.findIndex(h => h.resource === RESOURCES.DESERT);
  const robberHexId = desertHexIdx !== -1 ? desertHexIdx : 0;

  return {
    hexes,
    vertices,
    edges,
    vertexStates,
    edgeStates,
    ports,
    robberHexId
  };
}

/**
 * Checks if a vertex satisfies the distance rule.
 */
function isValidSettlementPlacement(vertexId, vertexStates, edges) {
  const vId = parseInt(vertexId);
  if (vertexStates[vId].owner !== null) return false;

  const adjacentVertexIds = [];
  edges.forEach(e => {
    if (e.v1 === vId) adjacentVertexIds.push(e.v2);
    if (e.v2 === vId) adjacentVertexIds.push(e.v1);
  });

  for (let adjId of adjacentVertexIds) {
    if (vertexStates[adjId].owner !== null) {
      return false;
    }
  }
  return true;
}

/**
 * Checks road connection to player buildings.
 */
function hasRoadConnection(playerId, vertexId, edgeStates, edges) {
  const vId = parseInt(vertexId);
  let connected = false;
  edges.forEach(e => {
    if ((e.v1 === vId || e.v2 === vId) && edgeStates[e.id].owner === playerId) {
      connected = true;
    }
  });
  return connected;
}

/**
 * Calculate player trade rate for a specific resource based on ports.
 */
function getTradeRate(player, board, resource) {
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
}

/**
 * Initialize a new Catan game.
 */
function createGame(players) {
  const board = createBoard();
  
  const playersState = players.map((p, idx) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot || false,
    color: ['#ff4d4d', '#4da6ff', '#5cd65c', '#ffcc00'][idx],
    resources: {
      [RESOURCES.WOOD]: 0,
      [RESOURCES.CLAY]: 0,
      [RESOURCES.WHEAT]: 0,
      [RESOURCES.SHEEP]: 0,
      [RESOURCES.ORE]: 0
    },
    devCards: {
      knight: 0,
      victoryPoint: 0,
      roadBuilding: 0,
      yearOfPlenty: 0,
      monopoly: 0
    },
    playedDevCards: {
      knight: 0
    },
    boughtDevCardsThisTurn: {
      knight: 0,
      victoryPoint: 0,
      roadBuilding: 0,
      yearOfPlenty: 0,
      monopoly: 0
    },
    victoryPoints: 0,
    publicVictoryPoints: 0,
    stats: {
      resourcesCollected: 0,
      devCardsBought: 0
    }
  }));

  // Setup standard dev card deck (14 Knights, 5 VPs, 2 Road Building, 2 Year of Plenty, 2 Monopoly)
  const devCardsList = [
    ...Array(14).fill('knight'),
    ...Array(5).fill('victoryPoint'),
    ...Array(2).fill('roadBuilding'),
    ...Array(2).fill('yearOfPlenty'),
    ...Array(2).fill('monopoly')
  ];
  const shuffledDevCards = shuffle(devCardsList);

  return {
    board,
    players: playersState,
    turnOrder: playersState.map(p => p.id),
    currentTurnIndex: 0,
    phase: 'setup_round_1',
    setupTurnIndex: 0,
    dice: [1, 1],
    diceRolled: false,
    devCardsDeck: shuffledDevCards,
    activeTrade: null,
    freeRoadsToBuild: 0,
    stealCandidates: [],
    devCardPlayedThisTurn: false,
    longestRoadHolder: null,
    longestRoadLength: 0,
    largestArmyHolder: null,
    largestArmySize: 0,
    diceStats: {
      2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0
    },
    winner: null,
    log: []
  };
}

function logEvent(game, message) {
  game.log.push({
    timestamp: Date.now(),
    message
  });
  if (game.log.length > 40) {
    game.log.shift();
  }
}

/**
 * Distribute resources based on dice roll.
 */
function handleDiceRoll(game, roll1, roll2) {
  const total = roll1 + roll2;
  game.dice = [roll1, roll2];
  game.diceRolled = true;

  // Track dice roll stats
  if (game.diceStats) {
    game.diceStats[total] = (game.diceStats[total] || 0) + 1;
  }

  const roller = game.players.find(p => p.id === game.turnOrder[game.currentTurnIndex]);
  logEvent(game, {
    en: `${roller.name} rolled a ${total}!`,
    es: `¡${roller.name} tiró un ${total}!`
  });

  if (total === 7) {
    logEvent(game, {
      en: "7 rolled! Robber activated. Players with >7 cards must discard.",
      es: "¡Tirada de 7! Ladrón activado. Jugadores con >7 cartas descartan la mitad."
    });

    // Auto discard half cards for players with > 7 cards
    game.players.forEach(p => {
      const cards = Object.entries(p.resources);
      const totalCards = cards.reduce((sum, [, count]) => sum + count, 0);
      if (totalCards > 7) {
        const toDiscard = Math.floor(totalCards / 2);
        let discardedCount = 0;
        
        while (discardedCount < toDiscard) {
          const availableRes = Object.entries(p.resources).filter(([, count]) => count > 0);
          if (availableRes.length === 0) break;
          const randomIdx = Math.floor(Math.random() * availableRes.length);
          const [res] = availableRes[randomIdx];
          p.resources[res]--;
          discardedCount++;
        }

        logEvent(game, {
          en: `💨 ${p.name} automatically discarded ${toDiscard} cards because of 7 roll`,
          es: `💨 ${p.name} descartó automáticamente ${toDiscard} cartas por la tirada de 7`
        });
      }
    });

    // Switch phase to robber placement
    game.phase = 'robber_move';
    return;
  }

  // Normal distribution (excluding hex containing the robber!)
  const activeHexes = game.board.hexes.filter(h => h.number === total && h.id !== game.board.robberHexId);
  if (activeHexes.length === 0) return;

  activeHexes.forEach(hex => {
    game.board.vertices.forEach(v => {
      if (v.hexes.includes(hex.id)) {
        const buildState = game.board.vertexStates[v.id];
        if (buildState.owner !== null) {
          const player = game.players.find(p => p.id === buildState.owner);
          if (player) {
            const amount = buildState.type === 'city' ? 2 : 1;
            player.resources[hex.resource] += amount;
            if (player.stats) {
              player.stats.resourcesCollected += amount;
            }
            
            logEvent(game, {
              en: `${player.name} received ${amount} ${hex.resource} from hex ${hex.id}`,
              es: `${player.name} recibió ${amount} de ${hex.resource} del hexágono ${hex.id}`
            });
          }
        }
      }
    });
  });
}

function hasResources(player, type) {
  const cost = COSTS[type];
  for (let res in cost) {
    if (player.resources[res] < cost[res]) return false;
  }
  return true;
}

function deductResources(player, type) {
  const cost = COSTS[type];
  for (let res in cost) {
    player.resources[res] -= cost[res];
  }
}

function getPlayerLongestRoad(game, playerId) {
  // 1. Get all edges owned by this player
  const playerEdges = game.board.edges.filter(e => game.board.edgeStates[e.id].owner === playerId);
  if (playerEdges.length === 0) return 0;

  // 2. Build adjacency list of vertices
  const adj = {};
  playerEdges.forEach(e => {
    if (!adj[e.v1]) adj[e.v1] = [];
    if (!adj[e.v2]) adj[e.v2] = [];
    adj[e.v1].push({ edgeId: e.id, neighborId: e.v2 });
    adj[e.v2].push({ edgeId: e.id, neighborId: e.v1 });
  });

  let maxLen = 0;

  // Helper DFS traversal
  function dfs(currVertex, visitedEdges) {
    // Check if vertex is blocked by an opponent's building
    const buildState = game.board.vertexStates[currVertex];
    if (buildState && buildState.owner !== null && buildState.owner !== playerId) {
      // Opponent settlement/city blocks the path
      return 0;
    }

    let localMax = 0;
    const connections = adj[currVertex] || [];

    for (let conn of connections) {
      if (!visitedEdges.has(conn.edgeId)) {
        visitedEdges.add(conn.edgeId);
        const pathLen = 1 + dfs(conn.neighborId, visitedEdges);
        if (pathLen > localMax) {
          localMax = pathLen;
        }
        visitedEdges.delete(conn.edgeId); // backtrack
      }
    }

    return localMax;
  }

  // 3. DFS search from every vertex
  const vertices = Object.keys(adj).map(Number);
  vertices.forEach(v => {
    const visited = new Set();
    const len = dfs(v, visited);
    if (len > maxLen) {
      maxLen = len;
    }
  });

  return maxLen;
}

function updateAchievements(game) {
  // --- 1. LONGEST ROAD ---
  const roadLengths = {};
  game.players.forEach(player => {
    roadLengths[player.id] = getPlayerLongestRoad(game, player.id);
  });

  const currentRoadHolderId = game.longestRoadHolder;
  const currentRoadLen = game.longestRoadLength || 0;

  if (currentRoadHolderId) {
    const holderLen = roadLengths[currentRoadHolderId] || 0;
    if (holderLen < 5) {
      // Holder lost it
      game.longestRoadHolder = null;
      game.longestRoadLength = 0;
    } else {
      game.longestRoadLength = holderLen;
      let newHolderId = currentRoadHolderId;
      let bestLen = holderLen;

      game.players.forEach(player => {
        const len = roadLengths[player.id];
        if (len > bestLen) {
          bestLen = len;
          newHolderId = player.id;
        }
      });

      if (newHolderId !== currentRoadHolderId) {
        game.longestRoadHolder = newHolderId;
        game.longestRoadLength = bestLen;

        const newHolder = game.players.find(p => p.id === newHolderId);
        logEvent(game, {
          en: `👑 ${newHolder.name} took the Longest Road card with ${bestLen} roads!`,
          es: `👑 ¡${newHolder.name} tomó la Mayor Ruta Comercial con ${bestLen} caminos!`
        });
      }
    }
  }

  // If no one holds it (or it was just vacated), check if someone qualifies (must be single maximum >= 5)
  if (!game.longestRoadHolder) {
    let maxQualifyingLen = 4;
    let qualifyingPlayers = [];

    game.players.forEach(player => {
      const len = roadLengths[player.id];
      if (len > maxQualifyingLen) {
        maxQualifyingLen = len;
        qualifyingPlayers = [player.id];
      } else if (len === maxQualifyingLen && len >= 5) {
        qualifyingPlayers.push(player.id);
      }
    });

    if (qualifyingPlayers.length === 1) {
      const bestQualifyingPlayerId = qualifyingPlayers[0];
      game.longestRoadHolder = bestQualifyingPlayerId;
      game.longestRoadLength = maxQualifyingLen;

      const holder = game.players.find(p => p.id === bestQualifyingPlayerId);
      logEvent(game, {
        en: `👑 ${holder.name} claimed the Longest Road card with ${maxQualifyingLen} roads!`,
        es: `👑 ¡${holder.name} consiguió la Mayor Ruta Comercial con ${maxQualifyingLen} caminos!`
      });
    }
  }

  // --- 2. LARGEST ARMY ---
  const armySizes = {};
  game.players.forEach(player => {
    armySizes[player.id] = player.playedDevCards.knight || 0;
  });

  const currentArmyHolderId = game.largestArmyHolder;

  if (currentArmyHolderId) {
    const holderSize = armySizes[currentArmyHolderId] || 0;
    game.largestArmySize = holderSize;
    let newHolderId = currentArmyHolderId;
    let bestSize = holderSize;

    game.players.forEach(player => {
      const size = armySizes[player.id];
      if (size > bestSize) {
        bestSize = size;
        newHolderId = player.id;
      }
    });

    if (newHolderId !== currentArmyHolderId) {
      game.largestArmyHolder = newHolderId;
      game.largestArmySize = bestSize;

      const newHolder = game.players.find(p => p.id === newHolderId);
      logEvent(game, {
        en: `⚔️ ${newHolder.name} took the Largest Army card with ${bestSize} knights!`,
        es: `⚔️ ¡${newHolder.name} tomó el Mayor Ejército con ${bestSize} caballeros!`
      });
    }
  } else {
    // If no one holds it, check if someone qualifies (must be single maximum >= 3)
    let maxQualifyingSize = 2;
    let qualifyingPlayers = [];

    game.players.forEach(player => {
      const size = armySizes[player.id];
      if (size > maxQualifyingSize) {
        maxQualifyingSize = size;
        qualifyingPlayers = [player.id];
      } else if (size === maxQualifyingSize && size >= 3) {
        qualifyingPlayers.push(player.id);
      }
    });

    if (qualifyingPlayers.length === 1) {
      const bestQualifyingPlayerId = qualifyingPlayers[0];
      game.largestArmyHolder = bestQualifyingPlayerId;
      game.largestArmySize = maxQualifyingSize;

      const holder = game.players.find(p => p.id === bestQualifyingPlayerId);
      logEvent(game, {
        en: `⚔️ ${holder.name} claimed the Largest Army card with ${maxQualifyingSize} knights!`,
        es: `⚔️ ¡${holder.name} consiguió el Mayor Ejército con ${maxQualifyingSize} caballeros!`
      });
    }
  }
}

function updateVictoryPoints(game) {
  // Update achievements first
  updateAchievements(game);

  game.players.forEach(player => {
    let publicVp = 0;
    Object.values(game.board.vertexStates).forEach(v => {
      if (v.owner === player.id) {
        publicVp += v.type === 'city' ? 2 : 1;
      }
    });

    // Add +2 for Longest Road
    if (game.longestRoadHolder === player.id) {
      publicVp += 2;
    }
    // Add +2 for Largest Army
    if (game.largestArmyHolder === player.id) {
      publicVp += 2;
    }

    player.publicVictoryPoints = publicVp;
    player.victoryPoints = publicVp + (player.devCards.victoryPoint || 0);

    if (player.victoryPoints >= 10 && !game.winner) {
      game.winner = player.id;
      logEvent(game, {
        en: `🎉 ${player.name} has won the game with ${player.victoryPoints} Victory Points!`,
        es: `🎉 ¡${player.name} ha ganado la partida con ${player.victoryPoints} Puntos de Victoria!`
      });
    }
  });
}

/**
 * Game engine state transitions.
 */
function processAction(game, playerId, action) {
  if (action.type === 'dev_action') {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;

    const { command, payload } = action.payload;
    if (command === 'add_resources') {
      Object.keys(player.resources).forEach(res => {
        player.resources[res] += 5;
      });
      logEvent(game, {
        en: `🔧 [DEV] ${player.name} added +5 of all resources`,
        es: `🔧 [DEV] ${player.name} se sumó +5 de todos los recursos`
      });
    } else if (command === 'add_dev_card') {
      const { cardType } = payload;
      player.devCards[cardType] = (player.devCards[cardType] || 0) + 1;
      logEvent(game, {
        en: `🔧 [DEV] ${player.name} added a ${cardType} card`,
        es: `🔧 [DEV] ${player.name} se sumó una carta de ${cardType}`
      });
      updateVictoryPoints(game);
    } else if (command === 'set_dice') {
      const { roll1, roll2 } = payload;
      if (game.phase.startsWith('setup')) {
        game.phase = 'normal';
        game.currentTurnIndex = 0;
      }
      game.diceRolled = false; // Reset so handleDiceRoll can run
      handleDiceRoll(game, roll1, roll2);
    } else if (command === 'win_game') {
      player.devCards.victoryPoint = (player.devCards.victoryPoint || 0) + 10;
      updateVictoryPoints(game);
    } else if (command === 'add_played_knight') {
      player.playedDevCards.knight = (player.playedDevCards.knight || 0) + 1;
      logEvent(game, {
        en: `🔧 [DEV] ${player.name} added +1 played Knight`,
        es: `🔧 [DEV] ${player.name} se sumó +1 Caballero jugado`
      });
      updateVictoryPoints(game);
    }
    return true;
  }

  if (game.winner) return false;

  const activePlayerId = game.phase.startsWith('setup') 
    ? game.turnOrder[game.setupTurnIndex]
    : game.turnOrder[game.currentTurnIndex];

  // For accepting trades, another player can trigger action during active player's turn!
  if (action.type === 'accept_trade') {
    // Handled separately below
  } else if (activePlayerId !== playerId) {
    return false;
  }

  const player = game.players.find(p => p.id === playerId);

  // --- SETUP PHASE ---
  if (game.phase.startsWith('setup')) {
    if (action.type === 'build_setup') {
      const { vertexId, edgeId } = action.payload;

      if (vertexId === undefined || edgeId === undefined) return false;
      if (!isValidSettlementPlacement(vertexId, game.board.vertexStates, game.board.edges)) return false;
      if (game.board.edgeStates[edgeId].owner !== null) return false;

      const edge = game.board.edges.find(e => e.id === edgeId);
      if (!edge || (edge.v1 !== vertexId && edge.v2 !== vertexId)) return false;

      game.board.vertexStates[vertexId] = { owner: playerId, type: 'settlement' };
      game.board.edgeStates[edgeId] = { owner: playerId };

      logEvent(game, {
        en: `${player.name} built starting settlement and road`,
        es: `${player.name} construyó poblado y camino inicial`
      });

      if (game.phase === 'setup_round_2') {
        const vertexObj = game.board.vertices.find(v => v.id === vertexId);
        vertexObj.hexes.forEach(hexId => {
          const hex = game.board.hexes.find(h => h.id === hexId);
          if (hex && hex.resource !== RESOURCES.DESERT) {
            player.resources[hex.resource] += 1;
            logEvent(game, {
              en: `${player.name} started with 1 ${hex.resource}`,
              es: `${player.name} inició con 1 de ${hex.resource}`
            });
          }
        });
      }

      updateVictoryPoints(game);

      const totalPlayers = game.players.length;
      if (game.phase === 'setup_round_1') {
        if (game.setupTurnIndex < totalPlayers - 1) {
          game.setupTurnIndex++;
        } else {
          game.phase = 'setup_round_2';
        }
      } else if (game.phase === 'setup_round_2') {
        if (game.setupTurnIndex > 0) {
          game.setupTurnIndex--;
        } else {
          game.phase = 'normal';
          game.currentTurnIndex = 0;
          game.diceRolled = false;
          logEvent(game, {
            en: "Setup complete! Standard game begins.",
            es: "¡Fundación completada! Comienza el juego estándar."
          });
        }
      }
      return true;
    }
    return false;
  }

  // --- ROBBER MOVE PHASE ---
  if (game.phase === 'robber_move') {
    if (action.type === 'move_robber') {
      const { hexId } = action.payload;
      if (hexId === undefined || hexId === game.board.robberHexId) return false;

      // Update robber position
      game.board.robberHexId = hexId;
      const targetHex = game.board.hexes.find(h => h.id === hexId);

      // Find players with settlements/cities touching this hex
      const candidates = new Set();
      game.board.vertices.forEach(v => {
        if (v.hexes.includes(hexId)) {
          const buildState = game.board.vertexStates[v.id];
          if (buildState.owner !== null && buildState.owner !== playerId) {
            candidates.add(buildState.owner);
          }
        }
      });

      logEvent(game, {
        en: `${player.name} moved the robber to hex ${hexId} (${targetHex?.resource})`,
        es: `${player.name} movió el ladrón al hexágono ${hexId} (${targetHex?.resource})`
      });

      if (candidates.size > 0) {
        game.phase = 'robber_steal';
        game.stealCandidates = Array.from(candidates);
      } else {
        game.phase = 'normal';
        game.stealCandidates = [];
      }
      return true;
    }
    return false;
  }

  // --- ROBBER STEAL PHASE ---
  if (game.phase === 'robber_steal') {
    if (action.type === 'steal_card') {
      const { targetPlayerId } = action.payload;
      if (!game.stealCandidates.includes(targetPlayerId)) return false;

      const target = game.players.find(p => p.id === targetPlayerId);
      if (!target) return false;

      // Collect all cards currently in target's hand
      const cards = [];
      Object.entries(target.resources).forEach(([res, count]) => {
        for (let i = 0; i < count; i++) cards.push(res);
      });

      if (cards.length > 0) {
        const randomCard = cards[Math.floor(Math.random() * cards.length)];
        target.resources[randomCard]--;
        player.resources[randomCard]++;
        if (player.stats) {
          player.stats.resourcesCollected += 1;
        }
        
        logEvent(game, {
          en: `${player.name} stole a card from ${target.name}`,
          es: `${player.name} robó una carta a ${target.name}`
        });
      } else {
        logEvent(game, {
          en: `${player.name} tried to steal from ${target.name} but they had no cards`,
          es: `${player.name} intentó robar a ${target.name} pero no tenía cartas`
        });
      }

      game.phase = 'normal';
      game.stealCandidates = [];
      return true;
    }
    return false;
  }

  // --- ROAD BUILDING CARD PHASE ---
  if (game.phase === 'road_building_phase') {
    if (action.type === 'build_road') {
      const { edgeId } = action.payload;
      if (game.board.edgeStates[edgeId].owner !== null) return false;

      const edge = game.board.edges.find(e => e.id === edgeId);
      if (!edge) return false;

      let hasConnection = false;
      if (game.board.vertexStates[edge.v1].owner === playerId || game.board.vertexStates[edge.v2].owner === playerId) {
        hasConnection = true;
      }
      game.board.edges.forEach(e => {
        if (e.id !== edgeId && game.board.edgeStates[e.id].owner === playerId) {
          if (e.v1 === edge.v1 || e.v1 === edge.v2 || e.v2 === edge.v1 || e.v2 === edge.v2) {
            hasConnection = true;
          }
        }
      });

      if (!hasConnection) return false;

      // Place road for free
      game.board.edgeStates[edgeId].owner = playerId;
      game.freeRoadsToBuild--;

      logEvent(game, {
        en: `${player.name} built a free road (Road Building Card)`,
        es: `${player.name} construyó un camino gratis (Carta de Carreteras)`
      });

      if (game.freeRoadsToBuild <= 0) {
        game.phase = 'normal';
      }
      return true;
    }
    return false;
  }

  // --- NORMAL PHASE ---
  if (game.phase === 'normal') {
    // 1. ROLL DICE
    if (action.type === 'roll_dice') {
      if (game.diceRolled) return false;
      const r1 = Math.floor(Math.random() * 6) + 1;
      const r2 = Math.floor(Math.random() * 6) + 1;
      handleDiceRoll(game, r1, r2);
      return true;
    }

    // Actions below require dice to be rolled first
    if (!game.diceRolled) return false;

    // 2. BUILD ROAD
    if (action.type === 'build_road') {
      const { edgeId } = action.payload;
      if (game.board.edgeStates[edgeId].owner !== null) return false;

      const edge = game.board.edges.find(e => e.id === edgeId);
      if (!edge) return false;

      let hasConnection = false;
      if (game.board.vertexStates[edge.v1].owner === playerId || game.board.vertexStates[edge.v2].owner === playerId) {
        hasConnection = true;
      }
      game.board.edges.forEach(e => {
        if (e.id !== edgeId && game.board.edgeStates[e.id].owner === playerId) {
          if (e.v1 === edge.v1 || e.v1 === edge.v2 || e.v2 === edge.v1 || e.v2 === edge.v2) {
            hasConnection = true;
          }
        }
      });

      if (!hasConnection) return false;
      if (!hasResources(player, 'road')) return false;

      deductResources(player, 'road');
      game.board.edgeStates[edgeId].owner = playerId;
      
      logEvent(game, {
        en: `${player.name} built a road`,
        es: `${player.name} construyó un camino`
      });
      return true;
    }

    // 3. BUILD SETTLEMENT
    if (action.type === 'build_settlement') {
      const { vertexId } = action.payload;

      if (!isValidSettlementPlacement(vertexId, game.board.vertexStates, game.board.edges)) return false;
      if (!hasRoadConnection(playerId, vertexId, game.board.edgeStates, game.board.edges)) return false;
      if (!hasResources(player, 'settlement')) return false;

      deductResources(player, 'settlement');
      game.board.vertexStates[vertexId] = { owner: playerId, type: 'settlement' };
      
      logEvent(game, {
        en: `${player.name} built a settlement`,
        es: `${player.name} construyó un poblado`
      });
      updateVictoryPoints(game);
      return true;
    }

    // 4. BUILD CITY
    if (action.type === 'build_city') {
      const { vertexId } = action.payload;
      const buildState = game.board.vertexStates[vertexId];

      if (buildState.owner !== playerId || buildState.type !== 'settlement') return false;
      if (!hasResources(player, 'city')) return false;

      deductResources(player, 'city');
      game.board.vertexStates[vertexId] = { owner: playerId, type: 'city' };

      logEvent(game, {
        en: `${player.name} upgraded a settlement to a city`,
        es: `${player.name} transformó un poblado en ciudad`
      });
      updateVictoryPoints(game);
      return true;
    }

    // 5. BUY DEV CARD
    if (action.type === 'buy_dev_card') {
      if (game.devCardsDeck.length === 0) return false;
      if (!hasResources(player, 'devCard')) return false;

      deductResources(player, 'devCard');
      const card = game.devCardsDeck.pop();
      player.devCards[card] = (player.devCards[card] || 0) + 1;
      if (player.boughtDevCardsThisTurn) {
        player.boughtDevCardsThisTurn[card] = (player.boughtDevCardsThisTurn[card] || 0) + 1;
      }
      if (player.stats) {
        player.stats.devCardsBought++;
      }

      logEvent(game, {
        en: `${player.name} bought a development card`,
        es: `${player.name} compró una carta de desarrollo`
      });
      
      updateVictoryPoints(game); // Recheck if it was a VP card
      return true;
    }

    // 6. PLAY DEV CARD
    if (action.type === 'play_dev_card') {
      if (game.devCardPlayedThisTurn) return false;
      const { cardType, options } = action.payload;
      if (!player.devCards[cardType] || player.devCards[cardType] <= 0) return false;

      // Cannot play a card bought on this turn (except Victory Points, which aren't active anyway)
      const boughtThisTurn = player.boughtDevCardsThisTurn?.[cardType] || 0;
      const totalOwned = player.devCards[cardType] || 0;
      if (totalOwned - boughtThisTurn <= 0) return false;

      player.devCards[cardType]--;
      player.playedDevCards[cardType] = (player.playedDevCards[cardType] || 0) + 1;
      game.devCardPlayedThisTurn = true;

      if (cardType === 'knight') {
        game.phase = 'robber_move';
        logEvent(game, {
          en: `${player.name} played a Knight card! Moving the robber.`,
          es: `¡${player.name} jugó un Caballero! Moviendo el ladrón.`
        });
      } else if (cardType === 'monopoly') {
        const { resource } = options;
        let totalStolen = 0;
        game.players.forEach(p => {
          if (p.id !== playerId) {
            const count = p.resources[resource] || 0;
            p.resources[resource] = 0;
            totalStolen += count;
          }
        });
        player.resources[resource] += totalStolen;
        if (player.stats) {
          player.stats.resourcesCollected += totalStolen;
        }
        logEvent(game, {
          en: `${player.name} played Monopoly on ${resource}, stealing ${totalStolen} cards`,
          es: `¡${player.name} jugó Monopolio de ${resource} y robó ${totalStolen} cartas!`
        });
      } else if (cardType === 'yearOfPlenty') {
        const { res1, res2 } = options;
        player.resources[res1]++;
        player.resources[res2]++;
        if (player.stats) {
          player.stats.resourcesCollected += 2;
        }
        logEvent(game, {
          en: `${player.name} played Year of Plenty and took 1 ${res1} and 1 ${res2}`,
          es: `¡${player.name} jugó Año de Abundancia y tomó 1 de ${res1} y 1 de ${res2}!`
        });
      } else if (cardType === 'roadBuilding') {
        game.freeRoadsToBuild = 2;
        game.phase = 'road_building_phase';
        logEvent(game, {
          en: `${player.name} played Road Building! Building 2 free roads.`,
          es: `¡${player.name} jugó Construcción de Carreteras! Colocando 2 caminos gratis.`
        });
      }

      updateVictoryPoints(game);
      return true;
    }

    // 7. BANK TRADE
    if (action.type === 'bank_trade') {
      const { giveResource, getResource } = action.payload;
      const rate = getTradeRate(player, game.board, giveResource);

      if (player.resources[giveResource] < rate) return false;

      player.resources[giveResource] -= rate;
      player.resources[getResource]++;
      if (player.stats) {
        player.stats.resourcesCollected += 1;
      }

      logEvent(game, {
        en: `${player.name} traded ${rate} ${giveResource} for 1 ${getResource} with the bank`,
        es: `${player.name} cambió ${rate} de ${giveResource} por 1 de ${getResource} con la banca`
      });
      return true;
    }

    // 8. OFFER TRADE (PLAYER TO PLAYERS)
    if (action.type === 'offer_trade') {
      const { offer, demand } = action.payload;
      
      // Verify sender has offered resources
      for (let res in offer) {
        if ((player.resources[res] || 0) < offer[res]) return false;
      }

      game.activeTrade = {
        senderId: playerId,
        offer,
        demand
      };

      const offerStr = Object.entries(offer).map(([r, q]) => `${q} ${r}`).join(', ');
      const demandStr = Object.entries(demand).map(([r, q]) => `${q} ${r}`).join(', ');

      logEvent(game, {
        en: `${player.name} offered trade: Give [${offerStr}] for [${demandStr}]`,
        es: `${player.name} propuso intercambio: Da [${offerStr}] por [${demandStr}]`
      });
      return true;
    }

    // 9. CANCEL TRADE
    if (action.type === 'cancel_trade') {
      if (!game.activeTrade || game.activeTrade.senderId !== playerId) return false;
      game.activeTrade = null;
      logEvent(game, {
        en: `${player.name} cancelled their trade offer`,
        es: `${player.name} canceló su oferta de intercambio`
      });
      return true;
    }

    // 10. END TURN
    if (action.type === 'end_turn') {
      game.diceRolled = false;
      game.devCardPlayedThisTurn = false;

      // Reset bought dev cards this turn for the player ending their turn
      const endingPlayer = game.players.find(p => p.id === playerId);
      if (endingPlayer && endingPlayer.boughtDevCardsThisTurn) {
        Object.keys(endingPlayer.boughtDevCardsThisTurn).forEach(k => {
          endingPlayer.boughtDevCardsThisTurn[k] = 0;
        });
      }

      game.activeTrade = null; // Clear active trades
      game.currentTurnIndex = (game.currentTurnIndex + 1) % game.players.length;
      
      const nextPlayer = game.players.find(p => p.id === game.turnOrder[game.currentTurnIndex]);
      logEvent(game, {
        en: `Turn passed to ${nextPlayer.name}`,
        es: `Turno pasado a ${nextPlayer.name}`
      });
      return true;
    }
  }

  // --- ACCEPT TRADE ACTION (ANY TURN - INCOMING FOR ACCEPTOR) ---
  if (action.type === 'accept_trade') {
    if (!game.activeTrade) return false;
    const { senderId, offer, demand } = game.activeTrade;

    if (playerId === senderId) return false; // Cannot accept own trade

    const sender = game.players.find(p => p.id === senderId);
    const acceptor = game.players.find(p => p.id === playerId);

    if (!sender || !acceptor) return false;

    // Verify sender still has offered resources
    for (let res in offer) {
      if ((sender.resources[res] || 0) < offer[res]) return false;
    }

    // Verify acceptor has demanded resources
    for (let res in demand) {
      if ((acceptor.resources[res] || 0) < demand[res]) return false;
    }

    // Swap resources
    let offerTotal = 0;
    let demandTotal = 0;
    for (let res in offer) {
      sender.resources[res] -= offer[res];
      acceptor.resources[res] += offer[res];
      offerTotal += offer[res];
    }
    for (let res in demand) {
      acceptor.resources[res] -= demand[res];
      sender.resources[res] += demand[res];
      demandTotal += demand[res];
    }
    if (acceptor.stats) {
      acceptor.stats.resourcesCollected += offerTotal;
    }
    if (sender.stats) {
      sender.stats.resourcesCollected += demandTotal;
    }

    logEvent(game, {
      en: `🤝 Trade accepted! ${acceptor.name} traded with ${sender.name}`,
      es: `🤝 ¡Intercambio aceptado! ${acceptor.name} comerció con ${sender.name}`
    });

    game.activeTrade = null;
    return true;
  }

  return false;
}

module.exports = {
  RESOURCES,
  COSTS,
  createGame,
  isValidSettlementPlacement,
  hasRoadConnection,
  processAction
};
