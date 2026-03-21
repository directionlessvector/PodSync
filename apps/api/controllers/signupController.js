const bcrypt = require('bcrypt');
const { createUser, getUserByEmail } = require('../services/userService');

const SALT_ROUNDS = 10;

async function signup(request, reply) {
  try {
    const { email, password, name } = request.body;

    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'email, password, and name are required' });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return reply.status(409).send({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await createUser({ email, hashedPassword, name });

    return reply.status(201).send({ message: 'User created successfully' });
  } catch (err) {
    request.log.error(err);
    return reply.status(500).send({ error: 'Unable to create user' });
  }
}

module.exports = {
  signup,
};
