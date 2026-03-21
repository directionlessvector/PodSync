const jwt = require('jsonwebtoken');
const { getUserById } = require('../services/userService');

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set in environment variables');
}

async function authenticate(request, reply) {
  try {
    const authHeader = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, jwtSecret);

    if (!decoded || !decoded.userId) {
      return reply.status(401).send({ error: 'Invalid token payload' });
    }

    const user = await getUserById(decoded.userId);
    if (!user) {
      return reply.status(401).send({ error: 'User not found' });
    }

    // Attach safe user data to request for downstream handlers
    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    return;
  } catch (err) {
    request.log.error(err);
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

module.exports = {
  authenticate,
};
