import Fastify from "fastify";
const fastify = Fastify({
  logger: true,
});

fastify.get("/ping", async function handler(request, reply) {
  return { pong: "It works" };
});

// Run the server!
try {
  await fastify.listen({ port: 3000 });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
