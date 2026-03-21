async function profile(request, reply) {
  return reply.send({ user: request.user });
}

module.exports = {
  profile,
};
