const { getParticipantRole, addParticipant, joinAsSpeaker,
        inviteSpeaker, getRoomParticipants } = require('../services/participantService');
const { getRoomById } = require('../services/roomService');

// GET /rooms/:roomId/my-role
// The frontend calls this when loading the room page.
// It answers: "what role does the currently logged-in user
// have in this room?"
// This is how the frontend knows whether to show SpeakerView
// or redirect to AudienceView.
async function handleGetMyRole(request, reply) {
  try {
    const { roomId } = request.params;

    // First check the room exists at all
    const room = await getRoomById(roomId);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    // Ask the database: what role does this user have?
    const role = await getParticipantRole(roomId, request.user.id);

    // If no row found in room_participants → they are audience
    // This is the safe default: unknown = audience
    return reply.send({
      success: true,
      role: role || 'audience',
      roomId,
      roomName: room.name,
      roomStatus: room.status,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
}

// POST /rooms/:roomId/join
// Called when someone wants to join a room.
// If they have no row in room_participants, adds them as audience.
// If they already have a role (speaker), returns that role.
async function handleJoinRoom(request, reply) {
  try {
    const { roomId } = request.params;

    // Check room exists
    const room = await getRoomById(roomId);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    // Check if room is still joinable
    if (room.status === 'ended') {
      return reply.status(400).send({ error: 'This session has ended' });
    }

    // Check if they already have a role
    const existingRole = await getParticipantRole(roomId, request.user.id);

    if (existingRole) {
      // They already have a role — just return it
      // This handles the case where they refresh the page
      return reply.send({
        success: true,
        role: existingRole,
        roomId,
        roomName: room.name,
      });
    }

    // No existing role → add them as audience
    // IMPORTANT: we always default to audience here
    // Only the host can upgrade someone to speaker (via invite)
    await addParticipant({
      roomId,
      userId: request.user.id,
      role: 'audience',
    });

    return reply.status(201).send({
      success: true,
      role: 'audience',
      roomId,
      roomName: room.name,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
}

// POST /rooms/:roomId/invite
// Host invites a user by email to join as a co-speaker.
// Only the host can call this.
async function handleInviteSpeaker(request, reply) {
  try {
    const { roomId } = request.params;
    const { email } = request.body;

    if (!email || typeof email !== 'string') {
      return reply.status(400).send({ error: 'Email is required' });
    }

    const result = await inviteSpeaker({
      roomId,
      hostId: request.user.id, // service verifies this is the host
      inviteeEmail: email.trim().toLowerCase(),
    });

    return reply.send({
      success: true,
      message: `${email} has been invited as a speaker`,
      userId: result.userId,
    });
  } catch (err) {
    request.log.error(err);
    if (err.message.includes('Only the host')) {
      return reply.status(403).send({ error: err.message });
    }
    if (err.message.includes('No user found')) {
      return reply.status(404).send({ error: err.message });
    }
    return reply.status(500).send({ error: err.message });
  }
}

// GET /rooms/:roomId/participants
// Returns list of all participants and their roles.
// Used by the dashboard and room page.
async function handleGetParticipants(request, reply) {
  try {
    const { roomId } = request.params;

    const room = await getRoomById(roomId);
    if (!room) {
      return reply.status(404).send({ error: 'Room not found' });
    }

    const participants = await getRoomParticipants(roomId);

    return reply.send({
      success: true,
      participants,
    });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
}

// POST /rooms/:roomId/join-as-speaker
// Called by the room page when a user opens the speaker link.
// Upserts them as speaker — upgrades audience → speaker if needed.
async function handleJoinAsSpeaker(request, reply) {
  try {
    const { roomId } = request.params;
    const room = await getRoomById(roomId);
    if (!room) return reply.status(404).send({ error: 'Room not found' });
    if (room.status === 'ended') return reply.status(400).send({ error: 'This session has ended' });

    await joinAsSpeaker({ roomId, userId: request.user.id });

    return reply.send({ success: true, role: 'speaker', roomId, roomName: room.name });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
}

module.exports = {
  handleGetMyRole,
  handleJoinRoom,
  handleJoinAsSpeaker,
  handleInviteSpeaker,
  handleGetParticipants,
};