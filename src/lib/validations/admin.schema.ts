import { z } from 'zod';

const escapeHTML = (str: string) =>
  str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );

export const UpdateSystemConfigSchema = z.object({
  key: z.string().min(1, 'La clave es requerida').transform(escapeHTML),
  value: z.any().refine((val) => val !== undefined, {
    message: 'El valor es requerido',
  }),
});

export type UpdateSystemConfigInput = z.infer<typeof UpdateSystemConfigSchema>;

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'El título es requerido').transform(escapeHTML),
  url: z.string().url('URL inválida').transform(escapeHTML).optional(),
  exposure_seconds: z.number().int().positive().optional(),
  exposureSeconds: z.number().int().positive().optional(),
  points_reward: z.number().int().positive().optional(),
  pointsReward: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  id: z.string().min(1, 'El ID de la tarea es requerido'),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const AdminUpdateUserSchema = z.object({
  userId: z.string().min(1, 'El ID de usuario es requerido'),
  action: z.enum(['UPDATE_STATUS', 'UPDATE_ROLE', 'ADJUST_POINTS']),
  payload: z.any(),
});

export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;

export const AdminProcessWithdrawalSchema = z.object({
  id: z.string().min(1, 'El ID del retiro es requerido').transform(escapeHTML),
  action: z.enum(['APPROVE', 'REJECT']),
  txHash: z.string().transform(escapeHTML).optional(),
}).refine(data => {
  if (data.action === 'APPROVE' && !data.txHash) {
    return false;
  }
  return true;
}, {
  message: 'El hash de transacción es requerido para aprobar un retiro',
  path: ['txHash'],
});

export type AdminProcessWithdrawalInput = z.infer<typeof AdminProcessWithdrawalSchema>;

export const AdminResolveFraudFlagSchema = z.object({
  flagId: z.string().min(1, 'El ID del flag es requerido'),
  resolved: z.boolean(),
});

export type AdminResolveFraudFlagInput = z.infer<typeof AdminResolveFraudFlagSchema>;
