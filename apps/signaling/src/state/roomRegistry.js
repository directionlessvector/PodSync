const clients = new Map();
const rooms = new Map();

// Adds or updates a client record with a WebSocket, roomId, role, and alive flag.
function addClient(userId, ws, roomId, role) {
  clients.set(userId, { ws, roomId, role, isAlive: true });
}

// Removes a client entry from the clients map.
function removeClient(userId) {
  clients.delete(userId);
}

// Retrieves client data for a given userId.
function getClient(userId) {
  return clients.get(userId);
}

// Returns the full clients map (used by heartbeat and cleanup loops).
function getAllClients() {
  return clients;
}

// Marks the client as alive after receiving a pong.
function markAlive(userId) {
  const client = clients.get(userId);
  if (client) {
    client.isAlive = true;
  }
}

// Adds a userId into a room set, creating the room if needed.
function addToRoom(roomId, userId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId).add(userId);
}

// Removes a userId from a room and deletes the room if empty.
function removeFromRoom(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) {
    return;
  }
  room.delete(userId);
  if (room.size === 0) {
    rooms.delete(roomId);
  }
}

// Returns room members as a Set, or empty Set when missing.
function getRoomMembers(roomId) {
  return rooms.get(roomId) || new Set();
}

// Sends a message to a specific user via WebSocket (if connected).
function sendTo(userId, message) {
  const client = clients.get(userId);
  if (!client) {
    return;
  }
  const { ws } = client;
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

// Broadcasts a message to all members in the room except excludeUserId.
function broadcastToRoom(roomId, excludeUserId, message) {
  const members = getRoomMembers(roomId);
  for (const memberId of members) {
    if (memberId === excludeUserId) {
      continue;
    }
    sendTo(memberId, message);
  }
}

module.exports = {
  addClient,
  removeClient,
  getClient,
  getAllClients,
  markAlive,
  addToRoom,
  removeFromRoom,
  getRoomMembers,
  sendTo,
  broadcastToRoom
};
