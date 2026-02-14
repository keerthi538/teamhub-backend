import { createApp } from "./app";
import dotenv from "dotenv";
import path from "path";
import { env } from "./config/env";

const envFile = env.isProduction ? ".env.production" : ".env.local";

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

async function start() {
  try {
    const fastify = await createApp();
    await fastify.listen({ port: env.port, host: "0.0.0.0" });
    console.log("Server is running on http://localhost:3000");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
