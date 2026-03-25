const { getAllClients } = require('./state/roomRegistry');
const { handleLeave } = require('./handlers/leaveHandler');

function startHeartbeat() {
  const interval = setInterval(() => {
    const clients = getAllClients();

    for (const [userId, client] of clients.entries()) {
      if (!client) {
        continue;
      }

      if (client.isAlive === false) {
        console.log(`heartbeat failed - userId=${userId}, roomId=${client.roomId}`);
        if (client.ws) {
          client.ws.terminate();
        }
        handleLeave(userId);
        continue;
      }

      client.isAlive = false;
      if (client.ws && typeof client.ws.ping === 'function') {
        client.ws.ping();
      }
    }
  }, 30000);

  return interval;
}

module.exports = { startHeartbeat };
