const { createRoom, getRoomById,
        updateRoomStatus, getRoomsByHost } = require('../services/roomService');

// POST /rooms
// Creates a new room. Host is automatically added as speaker.
async function handleCreateRoom(request, reply) {
  try {
    const { name, episodeTitle } = request.body;

    // Basic validation — name is required
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return reply.status(400).send({ error: 'Room name is required' });
    }

    // request.user.id comes from authMiddleware
    // The host is whoever is currently logged in
    const room = await createRoom({
      name: name.trim(),
      episodeTitle: episodeTitle?.trim() || null,
      hostId: request.user.id,
    });

    // Build the two URLs the frontend needs to display
    // FRONTEND_URL comes from .env — in dev it's http://localhost:3001
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    return reply.status(201).send({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        status: room.status,
        createdAt: room.created_at,
      },
      // Speaker link — only share with co-hosts who have accounts
      speakerUrl: `${baseUrl}/room/${room.id}`,
      // Audience link — share publicly, no login needed
      audienceUrl: `${baseUrl}/watch/${room.id}`,
    });
  } catch (err) {
    request.log.error(err)

    if (err.message.includes('already have a room with this name')) {
      return reply.status(409).send({ error: err.message })
    }

    return reply.status(500).send({ error: err.message })
  }
}

// GET /rooms/:roomId
// Returns room info. Public — no auth needed.
// Used by the watch page to confirm room exists before rendering.
async function handleGetRoom(request, reply) {
  try {
    const { roomId } = request.params;

    const room = await getRoomById(roomId);

    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    return reply.send({
      success: true,
      room: {
        id: room.id,
        name: room.name,
        status: room.status,
        hostId: room.host_id,
        createdAt: room.created_at,
      },
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
}

// PATCH /rooms/:roomId/status
// Updates room status: 'waiting' → 'live' → 'ended'
// Only the host can do this. Auth required.
async function handleUpdateRoomStatus(request, reply) {
  try {
    const { roomId } = request.params;
    const { status } = request.body;

    // Validate the status value
    const validStatuses = ['waiting', 'live', 'ended'];
    if (!validStatuses.includes(status)) {
      return reply.status(400).send({
        error: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const updated = await updateRoomStatus({
      roomId,
      status,
      hostId: request.user.id, // service will verify this is actually the host
    });

    return reply.send({
      success: true,
      room: updated,
    });
  } catch (err) {
    request.log.error(err);
    // If the error is "Only the host can...", return 403 not 500
    if (err.message.includes('Only the host')) {
      return reply.status(403).send({ error: err.message });
    }
    return reply.status(500).send({ error: err.message });
  }
}

// GET /rooms/my-rooms
// Returns all rooms created by the logged-in user.
// Used on the dashboard to list "Your podcasts".
async function handleGetMyRooms(request, reply) {
  try {
    const rooms = await getRoomsByHost(request.user.id);

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    // Add URLs to each room so frontend doesn't have to construct them
    const roomsWithUrls = rooms.map((room) => ({
      id: room.id,
      name: room.name,
      status: room.status,
      createdAt: room.created_at,
      speakerUrl: `${baseUrl}/room/${room.id}`,
      audienceUrl: `${baseUrl}/watch/${room.id}`,
    }));

    return reply.send({
      success: true,
      rooms: roomsWithUrls,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
}

module.exports = {
  handleCreateRoom,
  handleGetRoom,
  handleUpdateRoomStatus,
  handleGetMyRooms,
};

