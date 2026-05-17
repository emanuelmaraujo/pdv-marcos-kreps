-- Migration: Adiciona IFOOD ao enum payment_method
-- Permite registrar pedidos recebidos/pagos via iFood separadamente dos outros métodos.

ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'IFOOD';
