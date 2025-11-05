import Elysia, { type Static, t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

// Schema para o corpo da criação
const createMemberWithSessionNameBodySchema = t.Object(
  {
    name: t.String(),
    order: t.Optional(t.Number()),
    visionId: t.Optional(t.String()),
    register: t.Optional(t.String()),
    sessionName: t.String(),
    ticketAllocations: t.Optional(
      t.Array(
        t.Object(
          {
            eventTicketRangeId: t.String({ format: "uuid" }),
            quantity: t.Number(),
          },
          {
            description: "Ticket allocation for a specific event ticket range",
          }
        )
      )
    ),
  },
  {
    description:
      "Schema for creating a member with session name and ticket allocations",
  }
);

type CreateMemberWithSessionNameBody = Static<
  typeof createMemberWithSessionNameBodySchema
>;

// Schema para os parâmetros que agora incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: "uuid" }),
});

export const createManyEventMembersRoute = new Elysia().macro(authMacro).post(
  "/many",
  async ({ params, body, set }) => {
    // Verifica se o evento existe e se não está em modo somente leitura
    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
    });
    if (!event) {
      set.status = 404;
      return { error: "Event not found" };
    }

    if (event.readOnly) {
      set.status = 403;
      return { error: "Event is read-only" };
    }

    const b = body as CreateMemberWithSessionNameBody[];
    const sessionNames = Array.from(
      new Set(
        b.map(({ sessionName }) => sessionName?.toLowerCase().trim())
        // first letter to uppercase to any
      )
    );

    const sessions = await prisma.scoutSession.findMany({
      where: {
        name: {
          in: sessionNames,
          mode: "insensitive",
        },
      },
    });

    // biome-ignore lint/suspicious/noConsole: ignore
    console.log(sessions);

    if (sessions.length !== sessionNames.length) {
      const missingSessions = sessionNames.filter(
        (sessionName) =>
          !sessions.find(
            (session) =>
              session.name.toLowerCase() === sessionName.toLowerCase()
          )
      );

      set.status = 400;
      return {
        error: `Sessions not found: ${missingSessions.join(", ")}`,
      };
    }
    // Buscar ranges do evento
    const ranges = await prisma.eventTicketRange.findMany({
      where: { eventId: params.eventId, deletedAt: null },
    });

    // Se o evento não tem autoGenerateTicketsTotalPerMember, cada membro precisa enviar ticketAllocations contendo todos os ranges
    if (event.autoGenerateTicketsTotalPerMember == null) {
      const rangeIds = ranges.map((r) => r.id).sort();

      for (const item of b) {
        const bodyRecord = item as Record<string, unknown>;
        const allocations = bodyRecord.ticketAllocations as unknown as
          | { eventTicketRangeId: string; quantity: number }[]
          | undefined;
        if (!Array.isArray(allocations)) {
          set.status = 400;
          return {
            error:
              "Each member must include ticketAllocations when event.autoGenerateTicketsTotalPerMember is not set",
          };
        }
        const providedIds = allocations.map((a) => a.eventTicketRangeId).sort();
        if (
          rangeIds.length !== providedIds.length ||
          JSON.stringify(rangeIds) !== JSON.stringify(providedIds)
        ) {
          set.status = 400;
          return {
            error:
              "Each member ticketAllocations must include one entry for each ticket range of the event",
          };
        }
      }
    }

    // Criar membros em uma única transação (array de operações) para obter ids sem usar await em loop
    const inputs = b as CreateMemberWithSessionNameBody[];
    const createOps = inputs.map((item) => {
      const sessionName = item.sessionName;
      const session = sessions.find(
        (s) => s.name.toLowerCase() === sessionName.toLowerCase()
      );
      if (!session) {
        // Deveria ter sido validado anteriormente, mas checamos por segurança
        throw new Error(`Session not found for name ${sessionName}`);
      }

      const visionId =
        typeof item.visionId === "string" && item.visionId !== "undefined"
          ? item.visionId
          : null;
      const formattedName = item.name
        .toLowerCase()
        .replace(/(?:^|\s)\S/g, (a: string) => a.toUpperCase());
      const cleanName = item.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      // Exclui ticketAllocations do payload enviado ao modelo Member
      const data: {
        name: string;
        cleanName: string;
        eventId: string;
        visionId: string | null;
        sessionId: string;
        order: number | null;
        register?: string;
      } = {
        name: formattedName,
        cleanName,
        eventId: params.eventId,
        visionId,
        sessionId: session.id,
        order: item.order || null,
      };

      if (typeof item.register === "string") {
        data.register = item.register;
      }

      return prisma.member.create({ data });
    });

    const createdMembers = await prisma.$transaction(createOps);

    // Criar alocações para todos os membros criados (mapeando pelo índice de entrada)
    const allAllocations: {
      memberId: string;
      eventTicketRangeId: string;
      quantity: number;
    }[] = [];
    for (let i = 0; i < createdMembers.length; i++) {
      const member = createdMembers[i];
      const allocations = inputs[i].ticketAllocations;
      if (Array.isArray(allocations)) {
        for (const a of allocations) {
          allAllocations.push({
            memberId: member.id,
            eventTicketRangeId: a.eventTicketRangeId,
            quantity: a.quantity,
          });
        }
      }
    }

    if (allAllocations.length > 0) {
      await prisma.memberTicketAllocation.createMany({
        data: allAllocations,
        skipDuplicates: true,
      });
    }

    set.status = 201;
  },
  {
    auth: true,
    params: eventParamsSchema,
    body: t.Array(createMemberWithSessionNameBodySchema),
    response: {
      201: t.Void({
        description: "Members created successfully",
      }),
      400: t.Object({ error: t.String() }),
    },
    detail: {
      summary: "Create many members for a specific event",
      operationId: "createManyEventMembers",
    },
  }
);
