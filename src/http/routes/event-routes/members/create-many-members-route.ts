import Elysia, { type Static, t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

// Schema para o corpo da criação
const createMemberWithSessionNameBodySchema = t.Object({
  name: t.String(),
  order: t.Optional(t.Number()),
  visionId: t.Optional(t.String()),
  register: t.Optional(t.String()),
  sessionName: t.String(),
});

type CreateMemberWithSessionNameBody = Static<
  typeof createMemberWithSessionNameBodySchema
>;

// Schema para os parâmetros que agora incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
});

export const createManyEventMembersRoute = new Elysia()
  .macro(authMacro)
  .post(
    '/many',
    async ({ params, body, set }) => {
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
            mode: 'insensitive',
          },
        },
      });

      // biome-ignore lint/suspicious/noConsole: ignore
      console.log(sessions);

      if (sessions.length !== sessionNames.length) {
        const missingSessions = sessionNames.filter(
          (sessionName) =>
            !sessions.find((session) => session.name.toLowerCase() === sessionName.toLowerCase())
        );

        set.status = 400;
        return {
          error: `Sessions not found: ${missingSessions.join(', ')}`,
        };
      }

      await prisma.member.createMany({
        data: b.map(({ sessionName, ...d }) => {
          // const se = sessions.find((s) => s.name === sessionName.toLowerCase());
          // if (!se) {
          //   console.error('Session not found for name:', sessionName);
          //   console.log()
          // }
          return {
            ...d,
            eventId: params.eventId,
            visionId: d.visionId === 'undefined' ? null : d.visionId,
            name: d.name
              .toLowerCase()
              .replace(/(?:^|\s)\S/g, (a) => a.toUpperCase()),
            cleanName: d.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, ''),
            // biome-ignore lint/style/noNonNullAssertion: ignore
            sessionId: sessions.find((s) => s.name.toLowerCase() === sessionName.toLowerCase())!.id,
            order: d.order || null,
          }
        }),
        skipDuplicates: true,
      })

      set.status = 201;
    },
    {
      auth: true,
      params: eventParamsSchema,
      body: t.Array(createMemberWithSessionNameBodySchema),
      response: {
        201: t.Void({
          description: 'Members created successfully',
        }),
        400: t.Object({ error: t.String() })
      },
      detail: {
        summary: 'Create many members for a specific event',
        operationId: 'createManyEventMembers',
      },
    }
  );
