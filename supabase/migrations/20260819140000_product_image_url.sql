-- Migration: foto do produto no cardápio público (/pedir)
-- Date: 2026-08-19
-- Notes:
--   * URL de imagem hospedada externamente (Supabase Storage, CDN, etc.) —
--     não fazemos upload/processamento de arquivo aqui, só guardamos a URL.
--     Mantém o escopo pequeno: qualquer admin já consegue subir uma imagem
--     em qualquer storage e colar o link no cadastro do produto.
--   * Nullable e sem default: produtos sem foto continuam caindo no ícone
--     de fallback no /pedir — nenhuma migração de dados necessária.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url TEXT;
