/** biome-ignore-all lint/suspicious/noConsole: <explanation> */
import {
  PrismaClient,
  type SessionType,
  type TicketCreated,
} from '@prisma/client';
import feijoada from './data/feijoada-2025';
import pizza from './data/pizza-2025';
import pizzaExtra, { sessions } from './data/pizza-extra-2024';

const prisma = new PrismaClient();

async function main() {
  await prisma.scoutSession.createMany({
    data: sessions.map(({ type, created_at, ...rest }) => ({
      ...rest,
      type: type as SessionType,
      createdAt: created_at || new Date(),
    })),
    skipDuplicates: true,
  });

  const user = await prisma.user.findFirst();

  const checkPizzaExtraEvent = await prisma.event.findFirst({
    where: { name: 'Pizza Extra 2024' },
  });

  if (checkPizzaExtraEvent) {
    console.log('Event "Pizza Extra 2024" already exists.');
  } else {
    const { members, tickets } = pizzaExtra;
    const event = await prisma.event.create({
      data: {
        name: 'Pizza Extra 2024',
        ownerId: user?.id,
      },
    });

    await prisma.member.createMany({
      data: members.map(
        ({
          id,
          created_at,
          session_id,
          vision_id,
          name,
          clean_name,
          register,
        }) => ({
          id,
          eventId: event.id,
          order: null,
          visionId: vision_id,
          name,
          cleanName: clean_name,
          register,

          createdAt: created_at || new Date(),
          sessionId: session_id,
        })
      ),
      skipDuplicates: true,
    });

    await prisma.ticket.createMany({
      data: tickets.map(
        ({ created_at, delivered_at, member_id, created, ...rest }) => ({
          ...rest,
          memberId: member_id,
          eventId: event.id,
          createdAt: created_at || new Date(),
          deliveredAt: delivered_at || null,
          created: created as TicketCreated,
        })
      ),
      skipDuplicates: true,
    });

    console.log('Created event:', event);
  }

  const checkPizza2025Event = await prisma.event.findFirst({
    where: { name: 'Pizza 2025' },
  });

  if (checkPizza2025Event) {
    console.log('Event "Pizza 2025" already exists.');
  } else {
    const event = await prisma.event.create({
      data: {
        name: 'Pizza 2025',
        ownerId: user?.id,
        ticketType: 'MULTIPLE_NUMERATIONS',
        ticketRanges: {
          createMany: {
            data: [
              {
                type: 'Calabresa',
                start: 1,
                end: 1000,
              },
              {
                type: 'Mista',
                start: 2000,
                end: 3000,
              },
            ],
            skipDuplicates: true,
          },
        },
      },
    });

    await prisma.member.createMany({
      data: pizza.members.map(
        ({
          id,
          created_at,
          session_id,
          vision_id,
          name,
          clean_name,
          register,
          is_all_confirmed_but_not_yet_fully_paid,
        }) => ({
          id,
          eventId: event.id,
          order: null,
          visionId: vision_id,
          name,
          cleanName: clean_name,
          register,

          createdAt: created_at || new Date(),
          sessionId: session_id,
          isAllConfirmedButNotYetFullyPaid:
            is_all_confirmed_but_not_yet_fully_paid,
        })
      ),
      skipDuplicates: true,
    });

    await prisma.ticketRange.createMany({
      data: pizza.ticketRanges.map(
        ({ created_at, member_id, generated_at, deleted_at, ...rest }) => ({
          ...rest,
          eventId: event.id,
          createdAt: created_at || new Date(),
          memberId: member_id,
          generatedAt: generated_at || null,
          deletedAt: deleted_at || null,
        })
      ),
      skipDuplicates: true,
    });

    await prisma.ticket.createMany({
      data: pizza.tickets.map(
        ({
          created_at,
          delivered_at,
          member_id,
          created,
          ticket_range_id,
          ...rest
        }) => ({
          ...rest,
          memberId: member_id,
          eventId: event.id,
          createdAt: created_at || new Date(),
          deliveredAt: delivered_at || null,
          created: created as TicketCreated,
          oTicketRangeId: ticket_range_id || null,
        })
      ),
      skipDuplicates: true,
    });

    await prisma.payment.createMany({
      data: pizza.ticketPayments.map(
        ({
          created_at,
          member_id,
          paid_at,
          updated_at,
          vision_id,
          deleted_at,
          deleted_by,
          type,
          ...rest
        }) => ({
          ...rest,
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          type: type as any,
          visionId: vision_id,
          payedAt: paid_at || undefined,
          memberId: member_id,
          createdAt: created_at || new Date(),
          updatedAt: updated_at || new Date(),
          deletedAt: deleted_at || null,
          deletedBy: null,
        })
      ),
      skipDuplicates: true,
    });

    console.log('Created event:', event);
  }

  const checkFeijoada2025Event = await prisma.event.findFirst({
    where: { name: 'Feijoada 2025' },
  });

  if (checkFeijoada2025Event) {
    console.log('Event "Feijoada 2025" already exists.');
  } else {
    const event = await prisma.event.create({
      data: {
        name: 'Feijoada 2025',
        ownerId: user?.id,
      },
    });

    await prisma.member.createMany({
      data: feijoada.members.map(
        ({
          id,
          created_at,
          session_id,
          vision_id,
          name,
          clean_name,
          register,
          is_all_confirmed_but_not_yet_fully_paid,
        }) => ({
          id,
          eventId: event.id,
          order: null,
          visionId: vision_id,
          name,
          cleanName: clean_name,
          register,

          createdAt: created_at || new Date(),
          sessionId: session_id,
          isAllConfirmedButNotYetFullyPaid:
            is_all_confirmed_but_not_yet_fully_paid,
        })
      ),
      skipDuplicates: true,
    });

    await prisma.ticketRange.createMany({
      data: feijoada.ticketRanges.map(
        ({ created_at, member_id, generated_at, deleted_at, ...rest }) => ({
          ...rest,
          eventId: event.id,
          createdAt: created_at || new Date(),
          memberId: member_id,
          generatedAt: generated_at || null,
          deletedAt: deleted_at || null,
        })
      ),
      skipDuplicates: true,
    });

    await prisma.ticket.createMany({
      data: feijoada.tickets.map(
        ({
          created_at,
          delivered_at,
          member_id,
          created,
          ticket_range_id,
          ...rest
        }) => ({
          ...rest,
          memberId: member_id,
          eventId: event.id,
          createdAt: created_at || new Date(),
          deliveredAt: delivered_at || null,
          created: created as TicketCreated,
          oTicketRangeId: ticket_range_id || null,
        })
      ),
      skipDuplicates: true,
    });

    await prisma.payment.createMany({
      data: feijoada.ticketPayments.map(
        ({
          created_at,
          member_id,
          paid_at,
          updated_at,
          vision_id,
          deleted_at,
          deleted_by,
          type,
          ...rest
        }) => ({
          ...rest,
          // biome-ignore lint/suspicious/noExplicitAny: <explanation>
          type: type as any,
          visionId: vision_id,
          payedAt: paid_at || undefined,
          memberId: member_id,
          createdAt: created_at || new Date(),
          updatedAt: updated_at || new Date(),
          deletedAt: deleted_at || null,
          deletedBy: null,
        })
      ),
      skipDuplicates: true,
    });

    console.log('Created event:', event);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // biome-ignore lint/suspicious/noConsole: <explanation>
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
