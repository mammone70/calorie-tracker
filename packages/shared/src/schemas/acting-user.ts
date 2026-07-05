import { z } from 'zod';

export const forUserIdQuerySchema = z.object({
  forUserId: z.string().uuid().optional(),
});
