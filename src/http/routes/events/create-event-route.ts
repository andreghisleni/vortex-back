import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';
import { eventSchema, ticketTypeSchema } from './schemas';

export const createEventRoute = new Elysia().macro(authMacro).post(
  '/',
  async ({ user, body: { ticketRanges, ...body } }) => {
    const event = await prisma.event.create({
      data: {
        ...body,
        ownerId: user.id,
        ticketRanges: {
          createMany: {
            data: ticketRanges,
            skipDuplicates: true,
          },
        },
      },
      include: {
        ticketRanges: true,
      }
    });
    // Após criar o evento e os ticketRanges, recarregue os ranges do banco para garantir IDs persistidos
    const ranges = await prisma.eventTicketRange.findMany({ where: { eventId: event.id, deletedAt: null } });

    // Criar todos os tickets dentro dos ranges (sem atribuir a membros ainda)
    const ticketsToCreate: { number: number; eventId: string; ticketRangeId: string }[] = [];
    for (const r of ranges) {
      for (let n = r.start; n <= r.end; n++) {
        ticketsToCreate.push({ number: n, eventId: event.id, ticketRangeId: r.id });
      }
    }

    if (ticketsToCreate.length > 0) {
      // createMany pode ser grande, mas é a forma mais rápida de pré-popular os tickets
      await prisma.ticket.createMany({ data: ticketsToCreate, skipDuplicates: true });
    }

    // Não atribuímos tickets a membros no momento da criação do evento.
    // Apenas pré-criamos os números (tickets) para os ranges. A atribuição pode ocorrer depois,
    // quando os membros forem criados e as alocações estiverem disponíveis.

    return event;
  },
  {
    detail: {
      tags: ['Events'],
      summary: 'Create a new event',
      operationId: 'createEvent',
    },
    auth: true,
    body: t.Object({
      name: t.String({
        minLength: 3,
        description: 'Name of the event',
      }),
      description: t.Nullable(
        t.String({
          maxLength: 500,
          description: 'Description of the event',
        })
      ),
      autoGenerateTicketsTotalPerMember: t.Optional(t.Number()),
      readOnly: t.Optional(t.Boolean()),
      ticketType: ticketTypeSchema,
      ticketRanges: t.Array(
        t.Object({
          start: t.Number(),
          end: t.Number(),
          type: t.String(),
          cost: t.Number({
            description: 'Cost of tickets in this range',
          })
        }),
        {
          description: 'The ticket ranges for the event',
          default: [],
        }
      ),
    }),
    response: {
      200: eventSchema,
      404: t.Object({
        error: t.String(),
      }, { description: "Creation failed" }),
    },
  }
);
