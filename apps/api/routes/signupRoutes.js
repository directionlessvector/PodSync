const { signup } = require('../controllers/signupController');

async function signupRoutes(fastify) {
  fastify.post(
    '/signup',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            name: { type: 'string' },
          },
        },
      },
    },
    signup
  );
}

module.exports = signupRoutes;
