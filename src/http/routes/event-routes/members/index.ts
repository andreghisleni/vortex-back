import Elysia from 'elysia';
import { createManyEventMembersRoute } from './create-many-members-route';
import { createMemberRoute } from './create-member-route';
import { getMemberRoute } from './get-member-route';
import { getMembersRoute } from './get-members-route';
import { updateMemberRoute } from './update-member-route';

export const members = new Elysia({
  prefix: '/members', // Este prefixo será adicionado ao prefixo do pai
  tags: ['Event - Members'],
})
  .use(createMemberRoute)
  .use(createManyEventMembersRoute)
  .use(getMemberRoute)
  .use(getMembersRoute)
  .use(updateMemberRoute);
