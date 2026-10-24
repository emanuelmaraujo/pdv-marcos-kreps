import { describe, expect, it } from 'vitest';
// @ts-expect-error Utilitário Node sem dependências, compartilhado com o GitHub Actions.
import { validateSupabaseTarget } from './validate-supabase-target.mjs';

const ref = 'abcdefghijklmnopqrst';
const base = { projectRef: ref, expectedProjectRef: ref, accessToken: 'test-token' };

describe('destino do deploy Supabase', () => {
  it.each([
    `postgresql://postgres:password@db.${ref}.supabase.co:5432/postgres`,
    `postgresql://postgres.${ref}:password@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
  ])('aceita conexão direta ou pooler do projeto configurado', (databaseUrl) => {
    expect(() => validateSupabaseTarget({ ...base, databaseUrl })).not.toThrow();
  });

  it.each([
    'postgresql://postgres:password@db.zyxwvutsrqponmlkjihg.supabase.co/postgres',
    'postgresql://postgres.zyxwvutsrqponmlkjihg:password@aws-0-sa-east-1.pooler.supabase.com/postgres',
    'https://db.abcdefghijklmnopqrst.supabase.co',
    'invalid',
  ])('recusa URLs fornecidas inválidas ou de outro projeto', (databaseUrl) => {
    expect(() => validateSupabaseTarget({ ...base, databaseUrl })).toThrow();
  });

  it.each([undefined, ''])('aceita vinculação da CLI sem URL legada (%s)', (databaseUrl) => {
    expect(() => validateSupabaseTarget({ ...base, databaseUrl })).not.toThrow();
  });

  it('não revela a senha no diagnóstico', () => {
    expect(() => validateSupabaseTarget({ ...base, databaseUrl: 'postgresql://user:secret-password@localhost/db' }))
      .toThrow('não aponta para o mesmo projeto');
  });

  it('exige projeto esperado e token', () => {
    const databaseUrl = `postgresql://postgres:password@db.${ref}.supabase.co/postgres`;
    expect(() => validateSupabaseTarget({ ...base, databaseUrl, expectedProjectRef: 'other-project' })).toThrow();
    expect(() => validateSupabaseTarget({ ...base, databaseUrl, accessToken: '' })).toThrow();
  });
});
