import {
  PrismaClient,
  type SessionType,
  type TicketCreated,
} from '@prisma/client';
import { members, sessions, tickets } from './data/pizza-extra-2024';

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

  // biome-ignore lint/suspicious/noConsole: <explanation>
  console.log('Created event:', event);
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
