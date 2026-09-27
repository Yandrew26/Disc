import { z } from "zod";

export const createTeamInput = z.object({
  name: z.string().trim().min(1).max(80),
});

export const addTeamMemberInput = z.object({
  email: z.string().email(),
  roleId: z.string().uuid().optional(),
  isAdmin: z.boolean().default(false),
  teamId: z.string().uuid(),
});
