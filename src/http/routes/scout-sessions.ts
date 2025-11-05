import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

// Schema para o tipo de sessão.
export const sessionTypeSchema = t.Union(
  [
    t.Literal("LOBINHO"),
    t.Literal("ESCOTEIRO"),
    t.Literal("SENIOR"),
    t.Literal("PIONEIRO"),
    t.Literal("OUTRO"),
  ],
  {
    description: "Type of the scout session",
  }
);

// Schema para o modelo ScoutSession
const scoutSessionSchema = t.Object(
  {
    id: t.String({
      format: "uuid",
      description: "Unique identifier for the scout session",
    }),
    name: t.String({
      description: "Name of the scout session",
      minLength: 3,
    }),
    type: sessionTypeSchema,
    createdAt: t.Date({
      description: "Timestamp when the session was created",
    }),
    updatedAt: t.Date({
      description: "Timestamp when the session was last updated",
    }),
  },
  {
    description: "Scout session details",
  }
);

export const scoutSessions = new Elysia({
  prefix: "/scout-sessions",
  name: "Scout Sessions",
  tags: ["Scout Sessions"],
})
  .macro(authMacro)
  .get(
    "/",
    async () => {
      const sessions = await prisma.scoutSession.findMany();
      return sessions;
    },
    {
      auth: true,
      detail: {
        tags: ["Scout Sessions"],
        summary: "Get all scout sessions",
        operationId: "getAllScoutSessions",
      },
      response: {
        200: t.Array(scoutSessionSchema, {
          description: "List of all scout sessions",
        }),
      },
    }
  )
  .post(
    "/",
    async ({ body }) => {
      // Removido o ownerId, pois não existe no novo modelo
      const session = await prisma.scoutSession.create({
        data: body,
      });
      return session;
    },
    {
      detail: {
        tags: ["Scout Sessions"],
        summary: "Create a new scout session",
        operationId: "createScoutSession",
      },
      auth: true,
      body: t.Object({
        name: t.String({
          minLength: 3,
          description: "Name of the scout session",
        }),
        type: sessionTypeSchema,
      }),
      response: {
        201: scoutSessionSchema, // Usando 201 para criação de recurso
        400: t.Object(
          {
            // Resposta para dados inválidos
            error: t.String(),
          },
          { description: "Invalid input data" }
        ),
      },
    }
  )
  .get(
    "/:id",
    async ({ params, set }) => {
      const session = await prisma.scoutSession.findUnique({
        where: { id: params.id },
      });

      if (!session) {
        set.status = 404;
        return {
          error: "Scout session not found",
        };
      }

      return session;
    },
    {
      detail: {
        tags: ["Scout Sessions"],
        summary: "Get scout session by ID",
        operationId: "getScoutSessionById",
      },
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      response: {
        200: scoutSessionSchema,
        404: t.Object(
          {
            error: t.String(),
          },
          { description: "Scout session not found" }
        ),
      },
    }
  )
  .put(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const session = await prisma.scoutSession.update({
          where: { id: params.id },
          data: body,
        });
        return session;
      } catch {
        set.status = 404;
        return {
          error: "Scout session not found or could not be updated",
        };
      }
    },
    {
      detail: {
        tags: ["Scout Sessions"],
        summary: "Update scout session by ID",
        operationId: "updateScoutSessionById",
      },
      auth: true,
      params: t.Object(
        {
          id: t.String({ format: "uuid" }),
        },
        {
          description: "Parameters including scout session ID",
        }
      ),
      body: t.Object(
        {
          name: t.Optional(
            t.String({
              minLength: 3,
              description: "Name of the scout session",
            })
          ),
          type: t.Optional(sessionTypeSchema),
        },
        {
          description: "Fields to update for the scout session",
        }
      ),
      response: {
        200: scoutSessionSchema,
        400: t.Object(
          {
            error: t.String({
              description: "Error message",
            }),
          },
          { description: "Invalid input data" }
        ),
        404: t.Object(
          {
            error: t.String({
              description: "Error message",
            }),
          },
          { description: "Scout session not found" }
        ), // Resposta para sessão não encontrada
      },
    }
  );
