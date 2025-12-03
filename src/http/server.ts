import cors from "@elysiajs/cors";
import swagger from "@elysiajs/swagger";
import { Elysia, t } from "elysia";
import { auth, OpenAPI } from "~/auth";
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
      origin: env.BETTER_AUTH_URL,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
  // .use(
  //   openapi({
  //     path: "/docs",
  //     documentation: {
  //       info: {
  //         title: "Vortex API",
  //         version: "1.0.0",
  //       },
  //     },
  //     mapJsonSchema: {
  //       zod: z.toJSONSchema,
  //     },
  //   })
  // )
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: "Vortex API",
          version: "1.0.0",
        },
        components: await OpenAPI.components,
        paths: await OpenAPI.getPaths(),
      },
    })
  )
  .mount(auth.handler)
  .use(events)
  .use(scoutSessions)
  .use(users)
  .use(event)
  .get("/", () => "Hello Elysia", {
    detail: {
      summary: "API Health Check",
      description: "Returns a simple greeting to verify the API is running",
      operationId: "healthCheck",
    },
    response: {
      200: t.String({ description: "API greeting message" }),
    },
  })
  .get("/debug/db-info", () => {
    const dbUrl = env.DATABASE_URL;
    const devDbPrefix = "postgresql://postgres:docker@localhost:5432";
    const isProduction = !dbUrl.startsWith(devDbPrefix);
    
    // Extrai o host da URL do banco (sem expor credenciais)
    const hostMatch = dbUrl.match(/@([^:\/]+)/);
    const host = hostMatch ? hostMatch[1] : "unknown";
    
    return {
      isProduction,
      host,
      warning: isProduction ? "⚠️ CONECTADO AO BANCO DE PRODUÇÃO!" : null,
      nodeEnv: process.env.NODE_ENV ?? "undefined",
    };
  }, {
    detail: {
      summary: "Database Info (Dev Only)",
      description: "Returns information about the current database connection",
      operationId: "dbInfo",
    },
    response: {
      200: t.Object({
        isProduction: t.Boolean(),
        host: t.String(),
        warning: t.Union([t.String(), t.Null()]),
        nodeEnv: t.String(),
      }),
    },
  })
  .listen({
    hostname: "0.0.0.0",
    port: env.PORT,
  });

// biome-ignore lint/suspicious/noConsole: show port and hostname
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
