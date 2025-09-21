import Elysia from "elysia";
import { members } from "./members";
import { payments } from "./payments";
import { ticketRanges } from "./ticket-ranges";
import { tickets } from "./tickets";

export const event = new Elysia({
  prefix: "/event/:eventId",
  name: "Event",
  tags: ["Event"],
})
  .use(members)
  .use(ticketRanges)
  .use(tickets)
  .use(payments);
