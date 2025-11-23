import { Prisma } from "@prisma/client";
import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";
import { sessionTypeSchema } from "../../scout-sessions";
import { paymentTypeSchema } from "../payments/get-payment-route";

export const orderTypeSchema = t.Union([t.Literal("asc"), t.Literal("desc")], {
  description: "Type of the order",
});

// Schema do modelo Member (sem alterações)
const memberSchema = t.Object(
  {
    id: t.String({ format: "uuid" }),
    eventId: t.String({ format: "uuid" }),
    order: t.Nullable(t.Number()),
    visionId: t.Nullable(t.String()),
    name: t.String(),
    cleanName: t.String(),
    register: t.Nullable(t.String()),
    isAllConfirmedButNotYetFullyPaid: t.Boolean(),
    session: t.Object({
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
    }),
    createdAt: t.Date(),
    tickets: t.Array(
      t.Object(
        {
          id: t.String({ format: "uuid" }),
          number: t.Number(),
          memberId: t.Nullable(t.String({ format: "uuid" })),
          name: t.Nullable(t.String()),
          phone: t.Nullable(t.String()),
          description: t.Nullable(t.String()),
          deliveredAt: t.Nullable(t.Date()),
          returned: t.Boolean(),
          createdAt: t.Date(),
          created: t.Union([t.Literal("ONTHELOT"), t.Literal("AFTERIMPORT")]),
          eventId: t.String({ format: "uuid" }),
          ticketRangeId: t.Nullable(t.String({ format: "uuid" })),
        },
        {
          description: "Ticket details associated with the member",
        }
      )
    ),

    ticketAllocations: t.Array(
      t.Object(
        {
          id: t.String({ format: "uuid" }),
          eventTicketRangeId: t.String({ format: "uuid" }),
          quantity: t.Number(),
        },
        {
          description: "Ticket allocation details associated with the member",
        }
      )
    ),
    payments: t.Array(
      t.Object(
        {
          id: t.String({ format: "uuid" }),
          visionId: t.Nullable(t.String()),
          amount: t.Number(),
          type: paymentTypeSchema,
          payedAt: t.Date(),
          memberId: t.String({ format: "uuid" }),
          createdAt: t.Date(),
          updatedAt: t.Date(),
          deletedAt: t.Nullable(t.Date()),
          deletedBy: t.Nullable(t.String()),
        },
        {
          description: "Payment details associated with the member",
        }
      )
    ),
    totalTickets: t.Number({
      description: "Total number of tickets associated with the member",
    }),
    totalTicketsToDeliver: t.Number({
      description: "Total number of tickets to be delivered for the member",
    }),
    totalReturned: t.Number({
      description: "Total number of tickets returned by the member",
    }),
    totalAmount: t.Number({
      description: "Total amount paid by the member",
    }),
    totalPayedWithPix: t.Number({
      description: "Total amount paid by the member using Pix",
    }),
    totalPayedWithCash: t.Number({
      description: "Total amount paid by the member using Cash",
    }),
    totalPayed: t.Number({
      description: "Total amount paid by the member",
    }),
    total: t.Number({
      description: "Total amount associated with the member",
    }),
  },
  {
    description:
      "Schema representing a member with tickets, ticket allocations, and payments",
  }
);

// Schema para os parâmetros que agora incluem eventId
const eventParamsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
  },
  {
    description: "Schema for event parameters including eventId",
  }
);

interface RawMemberSqlResult {
  // Colunas diretas da tabela members (snake_case padrão do SQL)
  id: string;
  name: string;
  vision_id: string | null; // visionId é opcional no schema
  session_id: string;

  // Coluna vinda do JOIN com scout_sessions
  session_name: string;

  // Campos calculados (camelCase pois usamos aspas na query SQL: as "totalTickets")
  totalTickets: bigint;          // COUNT retorna BigInt no Postgres
  totalTicketsToDeliver: bigint; // COUNT retorna BigInt
  totalReturned: bigint;         // COUNT retorna BigInt

  // Somas e Cálculos (COALESCE garante que é number, não null)
  totalAmount: number;
  totalPayedWithPix: number;
  totalPayedWithCash: number;
  totalPayed: number;
  total: number;
}

export const getMembersRoute = new Elysia().macro(authMacro).get(
  "/",
  async ({ params, query }) => {
    const page = query["p.page"] ?? 1;
    const pageSize = query["p.pageSize"] ?? 20;
    const offset = (page - 1) * pageSize;
    const eventId = params.eventId;

    // 1. Construção dinâmica do filtro WHERE para SQL
    // Nota: No SQL Raw precisamos construir as condições manualmente
    const filters: Prisma.Sql[] = [Prisma.sql`m.event_id = ${eventId}`];

    if (query["f.sessionId"]) {
      filters.push(Prisma.sql`m.session_id = ${query["f.sessionId"]}`);
    }

    if (query["f.filter"]) {
      const search = `%${query["f.filter"]}%`;
      const searchInt = Number.parseInt(query["f.filter"], 10);
      const isNumber = !Number.isNaN(searchInt);

      const orConditions = [
        Prisma.sql`m.vision_id ILIKE ${search}`,
        Prisma.sql`m.name ILIKE ${search}`,
        Prisma.sql`m.register ILIKE ${search}`,
      ];

      // Subquery para buscar pelo número do ingresso
      if (isNumber) {
        orConditions.push(Prisma.sql`EXISTS (
          SELECT 1 FROM tickets t 
          WHERE t.member_id = m.id 
          AND t.number = ${searchInt}
        )`);
      }

      filters.push(Prisma.sql`(${Prisma.join(orConditions, " OR ")})`);
    }

    const whereClause = filters.length
      ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
      : Prisma.empty;

    // 2. Definir a ordenação baseada na query string
    // Mapeia o parametro da URL para a coluna calculada ou real
    let orderByClause = Prisma.sql`ORDER BY m.name ASC`; // Default

    // Verifica qual ordenação foi pedida (prioridade definida pela ordem dos ifs)
    if (query["ob.totalAmount"]) {
      const dir = query["ob.totalAmount"] === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
      orderByClause = Prisma.sql`ORDER BY "totalAmount" ${dir}`;
    } else if (query["ob.totalPayed"]) {
      const dir = query["ob.totalPayed"] === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
      orderByClause = Prisma.sql`ORDER BY "totalPayed" ${dir}`;
    } else if (query["ob.total"]) {
      // Ordenar pelo saldo (total)
      const dir = query["ob.total"] === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
      orderByClause = Prisma.sql`ORDER BY "total" ${dir}`;
    } else if (query["ob.visionId"]) {
      const dir = query["ob.visionId"] === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
      orderByClause = Prisma.sql`ORDER BY m.vision_id ${dir}`;
    } else if (query["ob.name"]) {
      const dir = query["ob.name"] === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
      orderByClause = Prisma.sql`ORDER BY m.name ${dir}`;
    } else if (query["ob.session-name"]) {
      // Ordenação por join simples
      const dir = query["ob.session-name"] === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
      orderByClause = Prisma.sql`ORDER BY ss.name ${dir}`;
    }

    // 3. Query Principal (CTE para calcular agregados + Paginação)
    // Usamos LEFT JOINS e subqueries para calcular os valores antes da paginação
    const rawQuery = Prisma.sql`
      WITH MemberStats AS (
        SELECT 
          m.id,
          m.name,
          m.vision_id,
          m.session_id,
          ss.name as session_name,
          
          -- Total Tickets
          (SELECT COUNT(*) FROM tickets t WHERE t.member_id = m.id) as "totalTickets",
          
          -- Total Tickets To Deliver
          (SELECT COUNT(*) FROM tickets t WHERE t.member_id = m.id AND t.delivered_at IS NULL) as "totalTicketsToDeliver",
          
          -- Total Returned
          (SELECT COUNT(*) FROM tickets t WHERE t.member_id = m.id AND t.returned = TRUE) as "totalReturned",

          -- Total Amount (Custo dos ingressos não devolvidos)
          COALESCE((
            SELECT SUM(etr.cost) 
            FROM tickets t
            JOIN event_ticket_ranges etr ON t.ticket_range_id = etr.id
            WHERE t.member_id = m.id AND t.returned = FALSE
          ), 0) as "totalAmount",

          -- PIX Payed
          COALESCE((
            SELECT SUM(p.amount) 
            FROM payments p 
            WHERE p.member_id = m.id AND p.type = 'PIX' AND p.deleted_at IS NULL
          ), 0) as "totalPayedWithPix",

          -- CASH Payed
          COALESCE((
            SELECT SUM(p.amount) 
            FROM payments p 
            WHERE p.member_id = m.id AND p.type = 'CASH' AND p.deleted_at IS NULL
          ), 0) as "totalPayedWithCash"

        FROM members m
        JOIN scout_sessions ss ON m.session_id = ss.id
        ${whereClause}
      )
      SELECT 
        *,
        ("totalPayedWithPix" + "totalPayedWithCash") as "totalPayed",
        (("totalPayedWithPix" + "totalPayedWithCash") - "totalAmount") as "total"
      FROM MemberStats m
      ${orderByClause}
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    // Query para contar o total de registros (para paginação)
    const countQuery = Prisma.sql`
      SELECT COUNT(*) as total 
      FROM members m 
      JOIN scout_sessions ss ON m.session_id = ss.id
      ${whereClause}
    `;

    // Executa as queries em paralelo
    const [rawMembers, totalResult] = await Promise.all([
      prisma.$queryRaw<RawMemberSqlResult[]>(rawQuery),
      prisma.$queryRaw<[{ total: bigint }]>(countQuery),
    ]);

    const total = Number(totalResult[0]?.total || 0);

    // Se não houver membros, retorna vazio
    if (rawMembers.length === 0) {
      return {
        data: [],
        meta: { total, page, pageSize, totalPages: 0 },
      };
    }

    // 4. Hydration: Buscar as relações aninhadas (Tickets, Payments, etc) usando o Prisma Type-Safe
    // Isso evita ter que fazer JSON_AGG complexo no SQL Raw
    const memberIds = rawMembers.map((rm) => rm.id);

    const detailedMembers = await prisma.member.findMany({
      where: { id: { in: memberIds } },
      include: {
        tickets: true,
        session: true,
        ticketAllocations: true,
        payments: { where: { deletedAt: null } },
      },
    });

    // 5. Merge: Combinar os dados calculados do SQL Raw com os objetos detalhados do Prisma
    // Mantendo a ordem retornada pelo SQL (que já está ordenado corretamente)
    const resultData = rawMembers
      .map((raw) => {
        const details = detailedMembers.find((d) => d.id === raw.id);

        if (!details) { return null; }

        return {
          ...details,
          // Conversões de BigInt para Number são obrigatórias para JSON
          totalTickets: Number(raw.totalTickets),
          totalTicketsToDeliver: Number(raw.totalTicketsToDeliver),
          totalReturned: Number(raw.totalReturned),
          totalAmount: raw.totalAmount,
          totalPayedWithPix: raw.totalPayedWithPix,
          totalPayedWithCash: raw.totalPayedWithCash,
          totalPayed: raw.totalPayed,
          total: raw.total,
        };
      })
      // CORREÇÃO PRINCIPAL: Type Guard explícito para remover null
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      data: resultData,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },
  {
    auth: true,
    params: eventParamsSchema, // Usando o schema de parâmetros
    query: t.Object({
      "f.filter": t.Optional(
        t.String({
          description:
            "Filter by member filter on visionId, name register, or tickets",
        })
      ),
      "f.sessionId": t.Optional(
        t.String({
          description: "Filter by session ID",
        })
      ),
      "p.page": t.Optional(
        t.Number({
          description: "Page number",
          default: 1,
        })
      ),
      "p.pageSize": t.Optional(
        t.Number({
          description: "Page size",
          default: 20,
        })
      ),
      "ob.order": t.Optional(orderTypeSchema),
      "ob.visionId": t.Optional(orderTypeSchema),
      "ob.name": t.Optional(orderTypeSchema),
      "ob.register": t.Optional(orderTypeSchema),
      "ob.totalTickets": t.Optional(orderTypeSchema),
      "ob.tickets": t.Optional(orderTypeSchema),
      "ob.session-name": t.Optional(orderTypeSchema),
      "ob.totalAmount": t.Optional(orderTypeSchema),
      "ob.totalPayed": t.Optional(orderTypeSchema),
      "ob.total": t.Optional(orderTypeSchema),
    }),
    response: {
      200: t.Object(
        {
          data: t.Array(memberSchema),
          meta: t.Object({
            total: t.Number(),
            page: t.Number(),
            pageSize: t.Number(),
            totalPages: t.Number(),
          }),
        },
        { description: "Paginated list of event members" }
      ),
    },
    detail: {
      summary: "Get all members for a specific event",
      operationId: "getEventMembers",
    },
  }
);
