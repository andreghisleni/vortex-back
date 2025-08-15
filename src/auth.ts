/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation> */
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin, openAPI } from 'better-auth/plugins';
import { prisma } from './db/client';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [admin(), openAPI()],
  basePath: '/api',
  trustedOrigins: ['http://localhost:5173'],
});

let _schema: ReturnType<typeof auth.api.generateOpenAPISchema>;
// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
const getSchema = async () => (_schema ??= auth.api.generateOpenAPISchema());

export const OpenAPI = {
  getPaths: (prefix = '/auth/api') =>
    getSchema().then(({ paths }) => {
      const reference: typeof paths = Object.create(null);

      for (const path of Object.keys(paths)) {
        const key = prefix + path;
        reference[key] = paths[path];

        for (const method of Object.keys(paths[path])) {
          const operation = (reference[key] as any)[method];

          operation.tags = ['Better Auth'];
        }
      }

      return reference;
    }) as Promise<any>,
  components: getSchema().then(({ components }) => components) as Promise<any>,
} as const;

export const authMacro = {
  auth: {
    async resolve({ status, request: { headers } }: any) {
      const session = await auth.api.getSession({
        headers,
      });

      // biome-ignore lint/style/useBlockStatements: <explanation>
      if (!session) return status(401);

      return {
        user: session.user,
        session: session.session,
      };
    },
  },
};
