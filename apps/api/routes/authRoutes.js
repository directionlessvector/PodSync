const signupRoutes = require('./signupRoutes')
const loginRoutes = require('./loginRoutes')
const profileRoutes = require('./profileRoutes')

async function authRoutes(fastify) {
  fastify.register(signupRoutes)
  fastify.register(loginRoutes)
  fastify.register(profileRoutes)
}

module.exports = authRoutes