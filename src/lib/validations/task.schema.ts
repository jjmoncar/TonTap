import { z } from 'zod';

export const CompleteTaskSchema = z.object({
  captchaToken: z.string().min(1, 'El token del CAPTCHA es requerido'),
  sessionId: z.string().min(1, 'Formato de sesión inválido'),
});

export type CompleteTaskInput = z.infer<typeof CompleteTaskSchema>;
