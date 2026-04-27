const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { checkDatabaseConnection, getUserByEmail } = require('../services/userService');

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be set in environment variables');
}

const JWT_EXPIRES_IN = '7d';

async function login(request, reply) {
  try {
    // Check database connection
    await checkDatabaseConnection();
    request.log.info('Database connection verified');

    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'email and password are required' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      jwtSecret,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return reply.send({ token });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Unable to log in' });
  }
}

module.exports = {
  login,
};
