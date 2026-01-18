import { createApp } from "./app";

async function start() {
  try {
    const fastify = await createApp();
    await fastify.listen({ port: 3000 });
    console.log("Server is running on http://localhost:3000");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
