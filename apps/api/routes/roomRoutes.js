const { authenticate } = require('../middleware/authMiddleware');
const {
  handleCreateRoom,
  handleGetRoom,
  handleUpdateRoomStatus,
  handleUpdateRecordingState,
  handleGetMyRooms,
  handleGetLiveKitToken,
} = require('../controllers/roomController');

async function roomRoutes(fastify, options) {
  // GET /rooms/my-rooms
  // Must be registered BEFORE /rooms/:roomId
  // otherwise Fastify treats "my-rooms" as a roomId param
  fastify.get(
    '/rooms/my-rooms',
    { preHandler: authenticate },  // auth required
    handleGetMyRooms
  );

  // POST /rooms — create a new room
  fastify.post(
    '/rooms',
    { preHandler: authenticate },  // must be logged in to create
    handleCreateRoom
  );

  // GET /rooms/:roomId — get room info
  // NO auth required — audience watch page needs this
  fastify.get(
    '/rooms/:roomId',
    handleGetRoom  // no preHandler = public route
  );

  // PATCH /rooms/:roomId/status — update room status
  fastify.patch(
    '/rooms/:roomId/status',
    { preHandler: authenticate },  // only host can do this
    handleUpdateRoomStatus
  );

  // PATCH /rooms/:roomId/recording — update global recording state
  fastify.patch(
    '/rooms/:roomId/recording',
    { preHandler: authenticate },  // only host can do this
    handleUpdateRecordingState
  );

  // GET /rooms/:roomId/livekit-token — generate LiveKit token
  fastify.get(
    '/rooms/:roomId/livekit-token',
    { preHandler: authenticate },  // must be logged in to get a token with roles
    handleGetLiveKitToken
  );
}

module.exports = roomRoutes;