import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  career_page_url: z.string().url('Must be a valid URL'),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').optional(),
  career_page_url: z.string().url('Must be a valid URL').optional(),
  is_active: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
