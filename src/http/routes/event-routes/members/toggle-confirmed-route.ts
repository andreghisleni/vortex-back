import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

const paramsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
    id: t.String({ format: "uuid" }),
  },
  {
    description: "Parameters for identifying the event and member",
  }
);

export const toggleConfirmedRoute = new Elysia().macro(authMacro).patch(
  "/:id/toggle-confirmed",
  async ({ params, set }) => {
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

    const member = await prisma.member.findUnique({
      where: { id: params.id, eventId: params.eventId },
    });
    if (!member) {
      set.status = 404;
      return { error: "Member not found in this event" };
    }

    const updated = await prisma.member.update({
      where: { id: params.id },
      data: {
        isAllConfirmedButNotYetFullyPaid: !member.isAllConfirmedButNotYetFullyPaid,
      },
      select: {
        id: true,
        isAllConfirmedButNotYetFullyPaid: true,
      },
    });

    return updated;
  },
  {
    auth: true,
    params: paramsSchema,
    response: {
      200: t.Object(
        {
          id: t.String(),
          isAllConfirmedButNotYetFullyPaid: t.Boolean(),
        },
        { description: "Member confirmation status toggled successfully" }
      ),
      403: t.Object({ error: t.String() }, { description: "Forbidden" }),
      404: t.Object(
        { error: t.String() },
        { description: "Member or Event not found" }
      ),
    },
    detail: {
      summary: "Toggle member's isAllConfirmedButNotYetFullyPaid status",
      operationId: "toggleMemberConfirmed",
    },
  }
);

