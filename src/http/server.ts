
import cors from '@elysiajs/cors';
import swagger from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { auth } from '~/auth';
import { env } from '~/env';
import { tracing } from '~/tracing';
import { events } from './routes/events';
import { users } from './routes/users';

const app = new Elysia()
  .use(tracing)
  .use(
    cors({
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )
  .use(
    swagger({
      path: '/docs',
      documentation: {
        info: {
          title: 'Vortex API',
          version: '1.0.0',
        },
        // components: await OpenAPI.components,
        // paths: await OpenAPI.getPaths(),
      },
    })
  )
  .mount(auth.handler)
  .use(events)
  .use(users)
  .get('/', () => 'Hello Elysia')
  .listen({
    hostname: '0.0.0.0',
    port: env.PORT,
  });

// biome-ignore lint/suspicious/noConsole: show port and hostname
console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
