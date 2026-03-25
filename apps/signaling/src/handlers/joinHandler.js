const {
  addClient,
  addToRoom,
  getRoomMembers,
  getClient,
  sendTo,
  broadcastToRoom
} = require('../state/roomRegistry');

function handleJoin(ws, message) {
  const { userId, roomId, role } = message;

  if (!userId || !roomId || !role) {
    if (ws && ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          event: 'error',
          message: 'room:join missing userId, roomId, or role'
        })
      );
    }
    return;
  }

  addClient(userId, ws, roomId, role);
  addToRoom(roomId, userId);

  const peers = [];
  const members = getRoomMembers(roomId);
  for (const memberId of members) {
    if (memberId === userId) {
      continue;
    }
    const client = getClient(memberId);
    if (client) {
      peers.push({ userId: memberId, role: client.role });
    }
  }

  sendTo(userId, {
    event: 'room:joined',
    roomId,
    role,
    peers
  });

  broadcastToRoom(roomId, userId, {
    event: 'room:peer-joined',
    userId,
    role
  });

  console.log(
    `room:join - userId=${userId}, role=${role}, roomId=${roomId}, peerCount=${peers.length}`
  );
}

module.exports = { handleJoin };
