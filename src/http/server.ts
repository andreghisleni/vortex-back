import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import swagger from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { z } from "zod/v4";
import { auth } from "~/auth";
import { env } from "~/env";
import { tracing } from "~/tracing";
import { event } from "./routes/event-routes";
import { events } from "./routes/events";
import { scoutSessions } from "./routes/scout-sessions";
import { users } from "./routes/users";

const app = new Elysia()
  .use(tracing)
  .use(
    cors({
      origin: "http://localhost:5173",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  .use(
    openapi({
      path: "/docs",
      documentation: {
        info: {
          title: "Vortex API",
          version: "1.0.0",
        },
      },
      mapJsonSchema: {
        zod: z.toJSONSchema,
      },
    })
  )
  .use(
    swagger({
      path: "/docs2",
      documentation: {
        info: {
          title: "Vortex API",
          version: "1.0.0",
        },
        // components: await OpenAPI.components,
        // paths: await OpenAPI.getPaths(),
      },
    })
  )
  .mount(auth.handler)
  .use(events)
  .use(scoutSessions)
  .use(users)
  .use(event)
  .get("/", () => "Hello Elysia")
  .listen({
    hostname: "0.0.0.0",
    port: env.PORT,
  });

// biome-ignore lint/suspicious/noConsole: show port and hostname
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
