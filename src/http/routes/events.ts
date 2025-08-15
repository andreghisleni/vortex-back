import Elysia from 'elysia';
import { authMacro } from '~/auth';

export const events = new Elysia({
  prefix: '/events',
  name: 'Events',
})
  .macro(authMacro)
  .get(
    '/',
    ({ user }) => {
      // biome-ignore lint/suspicious/noConsole: <explanation>
      console.log(user);
      return 'Events API';
    },
    { auth: true }
  );
