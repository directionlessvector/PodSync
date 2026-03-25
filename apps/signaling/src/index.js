require('dotenv').config();

const { WebSocketServer } = require('ws');
const {
  getAllClients,
  markAlive,
  getClient
} = require('./state/roomRegistry');
const { handleJoin } = require('./handlers/joinHandler');
const { handleLeave } = require('./handlers/leaveHandler');
const { handleSignal } = require('./handlers/signalHandler');
const { startHeartbeat } = require('./heartbeat');

const PORT = process.env.SIGNALING_PORT || 5000;

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  console.log('new signaling connection established');

  ws.on('pong', () => {
    for (const [userId, client] of getAllClients().entries()) {
      if (client && client.ws === ws) {
        markAlive(userId);
        break;
      }
    }
  });

  ws.on('message', (raw) => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch (err) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ event: 'error', message: 'Invalid JSON' }));
      }
      return;
    }

    const { event, userId } = message || {};

    if (!event) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ event: 'error', message: 'Missing event field' }));
      }
      return;
    }

    switch (event) {
      case 'room:join':
        handleJoin(ws, message);
        break;

      case 'room:leave':
        if (userId) {
          handleLeave(userId);
        }
        break;

      case 'signal:offer':
      case 'signal:answer':
      case 'signal:ice-candidate':
        if (userId) {
          handleSignal(userId, event, message);
        }
        break;

      default:
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ event: 'error', message: `Unknown event: ${event}` }));
        }
        break;
    }
  });

  ws.on('close', () => {
    for (const [userId, client] of getAllClients().entries()) {
      if (client && client.ws === ws) {
        handleLeave(userId);
        break;
      }
    }
  });

  ws.on('error', (err) => {
    console.error('ws error:', err.message || err);
  });
});

const heartbeatInterval = startHeartbeat();

console.log(`Signaling server running on ws://localhost:${PORT}`);

function shutdown() {
  clearInterval(heartbeatInterval);
  wss.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
