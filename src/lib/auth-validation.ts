import { z } from 'zod';

// Email validation schema
export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: 'Email é obrigatório' })
  .email({ message: 'Formato de email inválido' })
  .max(255, { message: 'Email muito longo' });

// Password validation schema
export const passwordSchema = z
  .string()
  .min(1, { message: 'Senha é obrigatória' })
  .max(128, { message: 'Senha muito longa' });

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Validate login input
export const validateLoginInput = (email: string, password: string) => {
  const result = loginSchema.safeParse({ email, password });
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    return {
      isValid: false,
      errors: {
        email: errors.email?.[0],
        password: errors.password?.[0],
      },
    };
  }
  return { isValid: true, errors: {} };
};
