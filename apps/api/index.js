require('dotenv').config()

const fastify = require('fastify')({ logger: true }) 
const cors = require('@fastify/cors')

fastify.register(cors, {
  origin: "http://localhost:3001",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
})

// routes
const authRoutes = require('./routes/authRoutes')
fastify.register(authRoutes)

// start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" })
    console.log("Server running on http://localhost:3000")
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()