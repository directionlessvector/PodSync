const {
  getClient,
  removeClient,
  removeFromRoom,
  broadcastToRoom
} = require('../state/roomRegistry');

function handleLeave(userId) {
  const client = getClient(userId);

  if (!client) {
    return;
  }

  const { roomId, role } = client;

  removeClient(userId);
  removeFromRoom(roomId, userId);

  broadcastToRoom(roomId, userId, {
    event: 'room:peer-left',
    userId,
    role
  });

  console.log(`room:leave - userId=${userId}, role=${role}, roomId=${roomId}`);
}

module.exports = { handleLeave };
