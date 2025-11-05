import { t } from "elysia";

export const ticketTypeSchema = t.Union(
  [t.Literal("SINGLE_NUMERATION"), t.Literal("MULTIPLE_NUMERATIONS")],
  {
    default: "SINGLE_NUMERATION",
    description: "Type of ticketing system used for the event",
  }
);

export const eventSchema = t.Object(
  {
    id: t.String({
      format: "uuid",
      description: "Unique identifier for the event",
    }),
    name: t.String({
      description: "Name of the event",
      minLength: 3,
    }),
    description: t.Nullable(
      t.String({
        description: "Description of the event",
        maxLength: 500,
      })
    ),
    ticketType: ticketTypeSchema,
    ownerId: t.Nullable(
      t.String({
        format: "uuid",
        description: "Unique identifier for the owner of the event",
      })
    ),
    autoGenerateTicketsTotalPerMember: t.Nullable(t.Number()),
    readOnly: t.Boolean({ default: false }),
    createdAt: t.Date({
      description: "Timestamp when the event was created",
    }),
    updatedAt: t.Date({
      description: "Timestamp when the event was last updated",
    }),
    ticketRanges: t.Array(
      t.Object({
        id: t.String({ format: "uuid" }),
        start: t.Number(),
        end: t.Number(),
        type: t.String(),
        cost: t.Nullable(t.Number()),
      })
    ),
  },
  {
    description:
      "Schema representing an event with its details and ticket ranges",
  }
);
