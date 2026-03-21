const { profile } = require('../controllers/profileController');
const { authenticate } = require('../middleware/authMiddleware');

async function profileRoutes(fastify) {
  fastify.get('/profile', { preHandler: authenticate }, profile);
}

module.exports = profileRoutes;
