import { z } from "zod";

export const createEventInput = z.object({
  teamId: z.string().uuid(),
  type: z.enum(["practice", "game", "tournament"]).default("practice"),
  title: z.string().trim().min(1).max(120),
  location: z.string().trim().max(200).optional(),
  startsAt: z.string().min(1, "Start time is required"),
  endsAt: z.string().min(1, "End time is required"),
});
