require('dotenv').config()

const fastify = require('fastify')({ logger: true })
const cors = require('@fastify/cors')

fastify.register(cors, {
  origin: 'http://localhost:3001',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
})

const authRoutes = require('./routes/authRoutes')
fastify.register(authRoutes, { prefix: '/auth' })

const roomRoutes = require('./routes/roomRoutes')
fastify.register(roomRoutes)

const participantRoutes = require('./routes/participantRoutes')
fastify.register(participantRoutes)

fastify.ready(() => {
  console.log(fastify.printRoutes())
})

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('Server running on http://localhost:3000')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()