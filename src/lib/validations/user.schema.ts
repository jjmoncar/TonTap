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

export const UpdateUserSettingsSchema = z.object({
  full_name: z.string().min(1, 'El nombre completo es requerido').transform(escapeHTML),
  ton_wallet: z.string().min(1, 'La billetera de TON es requerida').transform(escapeHTML),
});

export type UpdateUserSettingsInput = z.infer<typeof UpdateUserSettingsSchema>;
