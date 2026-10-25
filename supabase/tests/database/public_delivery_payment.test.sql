BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(1);
\ir ../isolated/public-delivery-contract.sql
SELECT pass('Contrato COD: idempotência, isolamento, confirmação, recebimento e expiração');
SELECT * FROM finish();
ROLLBACK;
