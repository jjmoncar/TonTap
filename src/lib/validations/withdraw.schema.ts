import { z } from 'zod';

export const RequestWithdrawSchema = z.object({
  amountPoints: z.number().int('El monto debe ser un entero').positive('El monto debe ser mayor a 0'),
});

export type RequestWithdrawInput = z.infer<typeof RequestWithdrawSchema>;
