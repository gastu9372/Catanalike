// server/botPlayer.js
const { isValidSettlementPlacement, hasRoadConnection, COSTS } = require('./gameLogic');

const NUMBER_WEIGHTS = {
  2: 1, 12: 1,
  3: 2, 11: 2,
  4: 3, 10: 3,
  5: 4, 9: 4,
  6: 5, 8: 5,
  null: 0
};

function evaluateVertex(vertexId, game) {
  const vertex = game.board.vertices.find(v => v.id === vertexId);
  if (!vertex) return 0;

  let score = 0;
  vertex.hexes.forEach(hexId => {
    const hex = game.board.hexes.find(h => h.id === hexId);
    if (hex && hex.number) {
      score += NUMBER_WEIGHTS[hex.number];
    }
  });
  return score;
}

function getValidSettlementVertices(playerId, game, requireRoad = true) {
  const valid = [];
  game.board.vertices.forEach(v => {
    if (!isValidSettlementPlacement(v.id, game.board.vertexStates, game.board.edges)) return;
    if (requireRoad && !hasRoadConnection(playerId, v.id, game.board.edgeStates, game.board.edges)) return;
    valid.push(v.id);
  });
  return valid;
}

function getValidRoadEdges(playerId, game) {
  const validEdges = [];
  game.board.edges.forEach(edge => {
    if (game.board.edgeStates[edge.id].owner !== null) return;
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

    if (isConnected) {
      validEdges.push(edge.id);
    }
  });
  return validEdges;
}

function canAfford(player, type) {
  const cost = COSTS[type];
  for (let res in cost) {
    if ((player.resources[res] || 0) < cost[res]) return false;
  }
  return true;
}

/**
 * Evaluates trade offers from human players.
 * Bots accept if they have surplus (>1) of demanded resources and need the offered resources.
 */
function evaluateTradeOffer(botPlayer, offer, demand) {
  // Check if bot has demanded resources in surplus
  for (let res in demand) {
    const demandCount = demand[res];
    const botCount = botPlayer.resources[res] || 0;
    // Bot wants to keep at least 1 card after trade
    if (botCount - demandCount < 1) return false;
  }

  // Check if bot actually needs the offered resources (e.g. has 0 or 1 card)
  let needsOffered = false;
  for (let res in offer) {
    if (offer[res] > 0 && (botPlayer.resources[res] || 0) < 2) {
      needsOffered = true;
    }
  }

  // 60% probability of accepting if conditions met
  return needsOffered && Math.random() < 0.6;
}

/**
 * Generates the next action for a bot.
 */
function getBotAction(playerId, game) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  // --- SETUP PHASE ---
  if (game.phase.startsWith('setup')) {
    const validVertices = getValidSettlementVertices(playerId, game, false);
    if (validVertices.length === 0) return null;

    let bestVertexId = validVertices[0];
    let maxScore = -1;
    validVertices.forEach(vId => {
      const score = evaluateVertex(vId, game);
      if (score > maxScore) {
        maxScore = score;
        bestVertexId = vId;
      }
    });

    const connectedEdges = game.board.edges.filter(e => 
      (e.v1 === bestVertexId || e.v2 === bestVertexId) && game.board.edgeStates[e.id].owner === null
    );

    if (connectedEdges.length === 0) return null;
    const randomEdge = connectedEdges[Math.floor(Math.random() * connectedEdges.length)];

    return {
      type: 'build_setup',
      payload: {
        vertexId: bestVertexId,
        edgeId: randomEdge.id
      }
    };
  }

  // --- ROBBER MOVE PHASE ---
  if (game.phase === 'robber_move') {
    // Bot should move the robber to a hex where:
    // 1. Robber is not currently on.
    // 2. Contains opponents' settlements/cities (highest score hex).
    // 3. Produces high-value resources.
    let bestHexId = null;
    let maxHexScore = -1;

    game.board.hexes.forEach(hex => {
      if (hex.id === game.board.robberHexId) return;

      // Count opponents' settlements/cities touching this hex
      let opponentBuildingsCount = 0;
      let scoreWeight = NUMBER_WEIGHTS[hex.number] || 0;

      game.board.vertices.forEach(v => {
        if (v.hexes.includes(hex.id)) {
          const state = game.board.vertexStates[v.id];
          if (state.owner !== null && state.owner !== playerId) {
            opponentBuildingsCount += state.type === 'city' ? 2 : 1;
          }
        }
      });

      // Score for this hex is buildings * weight of tile number
      const hexScore = opponentBuildingsCount * scoreWeight;
      if (hexScore > maxHexScore) {
        maxHexScore = hexScore;
        bestHexId = hex.id;
      }
    });

    // Fallback: pick any random hex other than current robber
    if (bestHexId === null) {
      const availableHexes = game.board.hexes.filter(h => h.id !== game.board.robberHexId);
      bestHexId = availableHexes[Math.floor(Math.random() * availableHexes.length)].id;
    }

    return {
      type: 'move_robber',
      payload: { hexId: bestHexId }
    };
  }

  // --- ROBBER STEAL PHASE ---
  if (game.phase === 'robber_steal') {
    if (game.stealCandidates.length === 0) return null;
    
    // Bot steals from player with most resources in hand
    let richestCandidate = game.stealCandidates[0];
    let maxResourcesCount = -1;

    game.stealCandidates.forEach(candId => {
      const cand = game.players.find(p => p.id === candId);
      if (cand) {
        const total = Object.values(cand.resources).reduce((s, c) => s + c, 0);
        if (total > maxResourcesCount) {
          maxResourcesCount = total;
          richestCandidate = candId;
        }
      }
    });

    return {
      type: 'steal_card',
      payload: { targetPlayerId: richestCandidate }
    };
  }

  // --- ROAD BUILDING CARD PHASE ---
  if (game.phase === 'road_building_phase') {
    const validRoads = getValidRoadEdges(playerId, game);
    if (validRoads.length > 0) {
      const randomRoadId = validRoads[Math.floor(Math.random() * validRoads.length)];
      return {
        type: 'build_road',
        payload: { edgeId: randomRoadId }
      };
    }
    // If no road can be built, end phase by sending some action or game handles it.
    // For safety, the bot can just send normal build to advance.
    return { type: 'end_turn' }; 
  }

  // --- NORMAL PHASE ---
  if (game.phase === 'normal') {
    if (!game.diceRolled) {
      return { type: 'roll_dice' };
    }

    // 1. Play Dev Cards if available
    if (!game.devCardPlayedThisTurn) {
      // Play Knight card if robber is blocking one of the bot's owned high-yield hexes
      const knightCount = player.devCards.knight || 0;
      const boughtKnights = player.boughtDevCardsThisTurn?.knight || 0;
      if (knightCount - boughtKnights > 0) {
        let isBlocked = false;
        const robberHexId = game.board.robberHexId;
        
        // Check if bot touches robber hex
        game.board.vertices.forEach(v => {
          if (v.hexes.includes(robberHexId) && game.board.vertexStates[v.id].owner === playerId) {
            isBlocked = true;
          }
        });

        if (isBlocked) {
          return {
            type: 'play_dev_card',
            payload: { cardType: 'knight', options: {} }
          };
        }
      }

      // Play Year of Plenty
      const yopCount = player.devCards.yearOfPlenty || 0;
      const boughtYop = player.boughtDevCardsThisTurn?.yearOfPlenty || 0;
      if (yopCount - boughtYop > 0) {
        // Take Wheat and Ore (often needed for cities/settlements)
        return {
          type: 'play_dev_card',
          payload: {
            cardType: 'yearOfPlenty',
            options: { res1: 'wheat', res2: 'ore' }
          }
        };
      }

      // Play Monopoly (on resource bot has 0 of, but wants)
      const monoCount = player.devCards.monopoly || 0;
      const boughtMono = player.boughtDevCardsThisTurn?.monopoly || 0;
      if (monoCount - boughtMono > 0) {
        const neededResources = Object.entries(player.resources)
          .filter(([, count]) => count === 0)
          .map(([res]) => res);

        const targetResource = neededResources.length > 0 ? neededResources[0] : 'wood';
        return {
          type: 'play_dev_card',
          payload: {
            cardType: 'monopoly',
            options: { resource: targetResource }
          }
        };
      }

      // Play Road Building
      const rbCount = player.devCards.roadBuilding || 0;
      const boughtRb = player.boughtDevCardsThisTurn?.roadBuilding || 0;
      if (rbCount - boughtRb > 0) {
        return {
          type: 'play_dev_card',
          payload: { cardType: 'roadBuilding', options: {} }
        };
      }
    }

    // 2. Build items
    // A: Build City
    if (canAfford(player, 'city')) {
      const botSettlements = Object.entries(game.board.vertexStates)
        .filter(([, state]) => state.owner === playerId && state.type === 'settlement')
        .map(([vId]) => parseInt(vId));
      
      if (botSettlements.length > 0) {
        let bestSettlementId = botSettlements[0];
        let maxScore = -1;
        botSettlements.forEach(vId => {
          const score = evaluateVertex(vId, game);
          if (score > maxScore) {
            maxScore = score;
            bestSettlementId = vId;
          }
        });
        return {
          type: 'build_city',
          payload: { vertexId: bestSettlementId }
        };
      }
    }

    // B: Build Settlement
    if (canAfford(player, 'settlement')) {
      const validVertices = getValidSettlementVertices(playerId, game, true);
      if (validVertices.length > 0) {
        let bestVertexId = validVertices[0];
        let maxScore = -1;
        validVertices.forEach(vId => {
          const score = evaluateVertex(vId, game);
          if (score > maxScore) {
            maxScore = score;
            bestVertexId = vId;
          }
        });
        return {
          type: 'build_settlement',
          payload: { vertexId: bestVertexId }
        };
      }
    }

    // C: Buy Dev Card (if bot can afford it, and has > 4 victory points or wants to take a chance)
    if (canAfford(player, 'devCard') && (player.victoryPoints > 3 || Math.random() < 0.5)) {
      return { type: 'buy_dev_card' };
    }

    // D: Build Road
    if (canAfford(player, 'road')) {
      const validRoads = getValidRoadEdges(playerId, game);
      if (validRoads.length > 0) {
        const myRoadsCount = Object.values(game.board.edgeStates).filter(e => e.owner === playerId).length;
        const myBuildingsCount = Object.values(game.board.vertexStates).filter(v => v.owner === playerId).length;
        
        if (myRoadsCount < myBuildingsCount * 2 || Math.random() < 0.4) {
          const randomRoadId = validRoads[Math.floor(Math.random() * validRoads.length)];
          return {
            type: 'build_road',
            payload: { edgeId: randomRoadId }
          };
        }
      }
    }

    // E: Bank Trade (if bot has > 4 cards of one resource, trade it for something it has 0 of)
    const surplusRes = Object.entries(player.resources).find(([, count]) => count >= 4);
    const missingRes = Object.entries(player.resources).find(([, count]) => count === 0);
    if (surplusRes && missingRes) {
      const giveResource = surplusRes[0];
      const getResource = missingRes[0];
      return {
        type: 'bank_trade',
        payload: { giveResource, getResource }
      };
    }

    // 3. End turn
    return { type: 'end_turn' };
  }

  return null;
}

module.exports = {
  getBotAction,
  evaluateTradeOffer
};
