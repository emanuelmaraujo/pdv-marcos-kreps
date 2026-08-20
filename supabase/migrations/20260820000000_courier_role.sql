-- Migration: Delivery — Fase 4 (motoboy com login próprio), parte 1/2
-- Notes:
--   * Novo valor de enum precisa estar commitado antes de ser usado em
--     policies/queries — por isso fica isolado nesta migration, separado
--     da que adiciona couriers.profile_id e as policies novas (parte 2/2).

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'COURIER';
