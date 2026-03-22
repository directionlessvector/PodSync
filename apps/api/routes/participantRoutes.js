const { authenticate } = require('../middleware/authMiddleware');
const {
  handleGetMyRole,
  handleJoinRoom,
  handleInviteSpeaker,
  handleGetParticipants,
} = require('../controllers/participantController');

async function participantRoutes(fastify, options) {
  // GET /rooms/:roomId/my-role
  // Called by frontend room page to get the current user's role
  // Auth required — we need to know WHO is asking
  fastify.get(
    '/rooms/:roomId/my-role',
    { preHandler: authenticate },
    handleGetMyRole
  );

  // POST /rooms/:roomId/join
  // Join a room — adds user as audience if no existing role
  fastify.post(
    '/rooms/:roomId/join',
    { preHandler: authenticate },
    handleJoinRoom
  );

  // POST /rooms/:roomId/invite
  // Host invites a co-speaker by email
  fastify.post(
    '/rooms/:roomId/invite',
    { preHandler: authenticate },
    handleInviteSpeaker
  );

  // GET /rooms/:roomId/participants
  // List all participants and roles
  // No auth — public info
  fastify.get(
    '/rooms/:roomId/participants',
    handleGetParticipants
  );
}

module.exports = participantRoutes;