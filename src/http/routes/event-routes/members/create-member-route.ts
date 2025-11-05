import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

// Schema para o corpo da criação
const createMemberBodySchema = t.Object(
  {
    sessionId: t.String({ format: "uuid" }),
    name: t.String(),
    order: t.Optional(t.Number()),
    visionId: t.Optional(t.String()),
    register: t.Optional(t.String()),
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
      "Schema for creating a member with session ID and ticket allocations",
  }
);

// Schema para os parâmetros que agora incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: "uuid" }),
});

export const createMemberRoute = new Elysia().macro(authMacro).post(
  "/",
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

    const cleanName = body.name.trim().toLowerCase();

    // Busca os ticket ranges do evento para validação quando necessário
    // const ranges = await prisma.eventTicketRange.findMany({ where: { eventId: params.eventId, deletedAt: null } });

    // // Se o evento não tem autoGenerateTicketsTotalPerMember, ticketAllocations é obrigatório e deve conter uma entrada por range
    // if (event.autoGenerateTicketsTotalPerMember == null) {
    //   const bodyRecord = body as Record<string, unknown>;
    //   const allocations = (bodyRecord.ticketAllocations as unknown) as { eventTicketRangeId: string; quantity: number }[] | undefined;
    //   if (!Array.isArray(allocations)) {
    //     set.status = 400;
    //     return { error: 'ticketAllocations is required when event.autoGenerateTicketsTotalPerMember is not set' };
    //   }

    //   const rangeIds = ranges.map((r) => r.id).sort();
    //   const providedIds = allocations.map((a) => a.eventTicketRangeId).sort();
    //   if (rangeIds.length !== providedIds.length || JSON.stringify(rangeIds) !== JSON.stringify(providedIds)) {
    //     set.status = 400;
    //     return { error: 'ticketAllocations must include one entry for each ticket range of the event' };
    //   }
    // }

    // Adicionamos o eventId dos parâmetros da URL aos dados
    const created = await prisma.member.create({
      data: {
        ...body,
        eventId: params.eventId, // <-- Ponto chave!
        cleanName,
      },
    });

    // Se vieram allocations, crie os registros de MemberTicketAllocation
    const allocationsToCreate = (body as Record<string, unknown>)
      .ticketAllocations as unknown as
      | { eventTicketRangeId: string; quantity: number }[]
      | undefined;
    if (allocationsToCreate && allocationsToCreate.length > 0) {
      await prisma.memberTicketAllocation.createMany({
        data: allocationsToCreate.map((a) => ({
          memberId: created.id,
          eventTicketRangeId: a.eventTicketRangeId,
          quantity: a.quantity,
        })),
        skipDuplicates: true,
      });
    }

    set.status = 201;
  },
  {
    auth: true,
    params: eventParamsSchema,
    body: createMemberBodySchema,
    response: {
      201: t.Void({
        description: "Member created successfully",
      }),
    },
    detail: {
      summary: "Create a new member for a specific event",
      operationId: "createEventMember",
    },
  }
);
