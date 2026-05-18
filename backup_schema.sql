


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."order_source" AS ENUM (
    'ATTENDANT',
    'QR_CODE',
    'WHATSAPP',
    'APP'
);


ALTER TYPE "public"."order_source" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'AGUARDANDO_CONFIRMACAO',
    'AGUARDANDO_PAGAMENTO',
    'NA_FILA',
    'PRONTO',
    'ENTREGUE',
    'CANCELADO',
    'EXPIRADO'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."order_type" AS ENUM (
    'BALCAO',
    'VIAGEM'
);


ALTER TYPE "public"."order_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'PIX',
    'CASH',
    'DEBIT_CARD',
    'CREDIT_CARD',
    'PENDING',
    'COURTESY'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'PENDING',
    'PAID',
    'REFUNDED',
    'CANCELED',
    'COURTESY'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."production_sector" AS ENUM (
    'KITCHEN',
    'JUICE_POTATO',
    'NONE'
);


ALTER TYPE "public"."production_sector" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'ADMIN',
    'ATTENDANT'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_webauthn_credential_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  existing_count integer;
begin
  select count(*) into existing_count
  from public.webauthn_credentials
  where user_id = NEW.user_id;

  if existing_count >= 3 then
    raise exception 'Limite de 3 digitais por usuário atingido. Remova uma digital antes de adicionar outra.';
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."check_webauthn_credential_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_daily_order_number"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Cria um bloqueio exclusivo transacional com chave arbitrária (ex: 1001)
  -- Isso enfileira chamadas simultâneas, prevenindo que dois pedidos peguem o mesmo número.
  PERFORM pg_advisory_xact_lock(1001);
  
  -- Busca o maior daily_number de hoje (considerando o fuso horário de Brasília)
  SELECT COALESCE(MAX(daily_number), 0) + 1 INTO next_num
  FROM orders
  WHERE date_trunc('day', created_at AT TIME ZONE 'America/Sao_Paulo') = date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo');
  
  RETURN next_num;
END;
$$;


ALTER FUNCTION "public"."get_next_daily_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_daily_order_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.daily_number IS NULL THEN
    NEW.daily_number := get_next_daily_order_number();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_daily_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text",
    "record_id" "uuid",
    "old_data" "jsonb",
    "new_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cash_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "opened_by" "uuid" NOT NULL,
    "closed_by" "uuid",
    "initial_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "final_amount" numeric(10,2),
    "notes" "text"
);


ALTER TABLE "public"."cash_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "text" NOT NULL,
    "phone_e164" "text" NOT NULL,
    "name" "text" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_order_at" timestamp with time zone,
    "orders_count" integer DEFAULT 0 NOT NULL,
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "marketing_opt_in_at" timestamp with time zone,
    "source" "public"."order_source" DEFAULT 'APP'::"public"."order_source" NOT NULL,
    "notes" "text",
    "whatsapp_opt_in" boolean DEFAULT true NOT NULL,
    "whatsapp_opt_in_updated_at" timestamp with time zone,
    "email" "text",
    "remember_checkout_data" boolean DEFAULT false NOT NULL,
    "last_order_type" "public"."order_type",
    "checkout_profile_updated_at" timestamp with time zone
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "value" numeric(10,2) NOT NULL,
    "amount_applied" numeric(10,2) NOT NULL,
    "reason" "text" NOT NULL,
    "granted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "discounts_type_check" CHECK (("type" = ANY (ARRAY['AMOUNT'::"text", 'PERCENT'::"text"])))
);


ALTER TABLE "public"."discounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_item_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "addon_id" "uuid",
    "quantity" integer DEFAULT 1 NOT NULL,
    "addon_name_snapshot" "text" NOT NULL,
    "addon_price_snapshot" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_item_addons_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."order_item_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_item_removed_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "ingredient_id" "uuid",
    "ingredient_name_snapshot" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_item_removed_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "product_name_snapshot" "text" NOT NULL,
    "product_price_snapshot" numeric(10,2) NOT NULL,
    "production_sector" "public"."production_sector" DEFAULT 'NONE'::"public"."production_sector" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "observation" "text",
    "total_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "daily_number" integer NOT NULL,
    "public_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(16), 'hex'::"text") NOT NULL,
    "type" "public"."order_type" DEFAULT 'BALCAO'::"public"."order_type" NOT NULL,
    "source" "public"."order_source" DEFAULT 'ATTENDANT'::"public"."order_source" NOT NULL,
    "status" "public"."order_status" DEFAULT 'AGUARDANDO_CONFIRMACAO'::"public"."order_status" NOT NULL,
    "payment_status" "public"."payment_status" DEFAULT 'PENDING'::"public"."payment_status" NOT NULL,
    "payment_method" "public"."payment_method" DEFAULT 'PENDING'::"public"."payment_method" NOT NULL,
    "customer_name" "text",
    "customer_phone" "text",
    "notes" "text",
    "discount_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "discount_percentage" numeric(5,2) DEFAULT 0 NOT NULL,
    "discount_reason" "text",
    "discount_applied_by" "uuid",
    "packing_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "confirmed_by" "uuid",
    "confirmed_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "queue_entered_at" timestamp with time zone,
    "preparation_started_at" timestamp with time zone,
    "preparation_finished_at" timestamp with time zone,
    "customer_email" "text",
    "customer_id" "text"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_method_configs" (
    "code" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "label" "text" NOT NULL,
    "internal_payment_method" "public"."payment_method",
    "enabled" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "requires_email" boolean DEFAULT false NOT NULL,
    "requires_document" boolean DEFAULT false NOT NULL,
    "requires_device_support" boolean DEFAULT false NOT NULL,
    "availability_reason" "text",
    "provider_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_method_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_payment_id" "text",
    "external_reference" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "internal_payment_method" "public"."payment_method",
    "payment_method_code" "text" NOT NULL,
    "provider_payment_method_id" "text",
    "provider_payment_type_id" "text",
    "wallet_type" "text",
    "provider_status" "text" DEFAULT 'created'::"text" NOT NULL,
    "provider_status_detail" "text",
    "amount" numeric(10,2) NOT NULL,
    "qr_code" "text",
    "qr_code_base64" "text",
    "ticket_url" "text",
    "expires_at" timestamp with time zone,
    "raw_provider_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_transactions_provider_check" CHECK (("provider" = ANY (ARRAY['MERCADO_PAGO'::"text", 'NUPAY'::"text", 'OTHER'::"text"])))
);


ALTER TABLE "public"."payment_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "payment_method" "public"."payment_method" NOT NULL,
    "payment_status" "public"."payment_status" NOT NULL,
    "received_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."printer_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "sector" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "content" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "printed_at" timestamp with time zone,
    "error_message" "text"
);


ALTER TABLE "public"."printer_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_addons" (
    "product_id" "uuid" NOT NULL,
    "addon_id" "uuid" NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "max_quantity" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "uuid" NOT NULL,
    "ingredient_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "sector" "public"."production_sector" DEFAULT 'NONE'::"public"."production_sector" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'ATTENDANT'::"public"."user_role" NOT NULL,
    "name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webauthn_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential_id" "text" NOT NULL,
    "public_key_jwk" "jsonb" NOT NULL,
    "sign_count" bigint DEFAULT 0 NOT NULL,
    "device_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."webauthn_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "phone" "text" NOT NULL,
    "message_type" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "template_name" "text",
    "payload" "jsonb",
    "attempts" integer DEFAULT 0,
    "last_attempt_at" timestamp with time zone,
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "provider_message_id" "text",
    "event_type" "text" NOT NULL,
    "scheduled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "next_retry_at" timestamp with time zone,
    "delivery_status" "text",
    "customer_opt_in" boolean,
    "error_code" "text",
    CONSTRAINT "chk_whatsapp_messages_delivery_status" CHECK ((("delivery_status" IS NULL) OR ("delivery_status" = ANY (ARRAY['SENT'::"text", 'DELIVERED'::"text", 'READ'::"text", 'FAILED_BY_PROVIDER'::"text", 'UNDELIVERED'::"text"])))),
    CONSTRAINT "chk_whatsapp_messages_event_type" CHECK (("event_type" = ANY (ARRAY['order_received'::"text", 'order_ready'::"text"]))),
    CONSTRAINT "chk_whatsapp_messages_status" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'SENT'::"text", 'FAILED'::"text", 'SKIPPED'::"text"])))
);


ALTER TABLE "public"."whatsapp_messages" OWNER TO "postgres";


ALTER TABLE ONLY "public"."addons"
    ADD CONSTRAINT "addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_sessions"
    ADD CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_phone_e164_key" UNIQUE ("phone_e164");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discounts"
    ADD CONSTRAINT "discounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_item_addons"
    ADD CONSTRAINT "order_item_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_item_removed_ingredients"
    ADD CONSTRAINT "order_item_removed_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_public_token_key" UNIQUE ("public_token");



ALTER TABLE ONLY "public"."payment_method_configs"
    ADD CONSTRAINT "payment_method_configs_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_external_reference_key" UNIQUE ("external_reference");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_provider_payment_id_key" UNIQUE ("provider_payment_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."printer_jobs"
    ADD CONSTRAINT "printer_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_addons"
    ADD CONSTRAINT "product_addons_pkey" PRIMARY KEY ("product_id", "addon_id");



ALTER TABLE ONLY "public"."product_ingredients"
    ADD CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_ingredients"
    ADD CONSTRAINT "product_ingredients_product_id_ingredient_id_key" UNIQUE ("product_id", "ingredient_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_credential_id_key" UNIQUE ("credential_id");



ALTER TABLE ONLY "public"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_order_item_addons_order_item_id" ON "public"."order_item_addons" USING "btree" ("order_item_id");



CREATE INDEX "idx_order_item_removed_ingredients_order_item_id" ON "public"."order_item_removed_ingredients" USING "btree" ("order_item_id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_orders_app_awaiting_payment" ON "public"."orders" USING "btree" ("created_at" DESC) WHERE (("source" = 'APP'::"public"."order_source") AND ("status" = 'AGUARDANDO_PAGAMENTO'::"public"."order_status") AND ("payment_status" = 'PENDING'::"public"."payment_status"));



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_created_at_tz" ON "public"."orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_orders_customer_id" ON "public"."orders" USING "btree" ("customer_id");



CREATE INDEX "idx_orders_public_token" ON "public"."orders" USING "btree" ("public_token");



CREATE INDEX "idx_orders_status_created_at" ON "public"."orders" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_payment_transactions_order_id" ON "public"."payment_transactions" USING "btree" ("order_id");



CREATE INDEX "idx_payment_transactions_pending_pix_by_order" ON "public"."payment_transactions" USING "btree" ("order_id", "expires_at" DESC, "created_at" DESC) WHERE (("provider" = 'MERCADO_PAGO'::"text") AND ("provider_payment_method_id" = 'pix'::"text") AND ("provider_status" = ANY (ARRAY['pending'::"text", 'in_process'::"text"])));



CREATE INDEX "idx_payment_transactions_provider_payment_id" ON "public"."payment_transactions" USING "btree" ("provider_payment_id");



CREATE INDEX "idx_payment_transactions_status" ON "public"."payment_transactions" USING "btree" ("provider_status");



CREATE INDEX "idx_printer_jobs_order_id" ON "public"."printer_jobs" USING "btree" ("order_id");



CREATE INDEX "idx_printer_jobs_status" ON "public"."printer_jobs" USING "btree" ("status") WHERE ("status" = 'PENDING'::"text");



CREATE INDEX "idx_printer_jobs_status_created_at" ON "public"."printer_jobs" USING "btree" ("status", "created_at") WHERE ("status" = 'PENDING'::"text");



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role") WHERE ("active" = true);



CREATE INDEX "idx_webauthn_credentials_user_id" ON "public"."webauthn_credentials" USING "btree" ("user_id");



CREATE INDEX "idx_whatsapp_messages_due" ON "public"."whatsapp_messages" USING "btree" ("status", "next_retry_at" NULLS FIRST, "scheduled_at") WHERE ("status" = 'PENDING'::"text");



CREATE INDEX "idx_whatsapp_messages_order_id" ON "public"."whatsapp_messages" USING "btree" ("order_id");



CREATE INDEX "idx_whatsapp_messages_order_template" ON "public"."whatsapp_messages" USING "btree" ("order_id", "template_name");



CREATE INDEX "idx_whatsapp_messages_provider_id" ON "public"."whatsapp_messages" USING "btree" ("provider_message_id") WHERE ("provider_message_id" IS NOT NULL);



CREATE INDEX "idx_whatsapp_messages_status" ON "public"."whatsapp_messages" USING "btree" ("status") WHERE ("status" = 'PENDING'::"text");



CREATE UNIQUE INDEX "uniq_whatsapp_messages_order_event_live" ON "public"."whatsapp_messages" USING "btree" ("order_id", "event_type") WHERE ("status" = ANY (ARRAY['PENDING'::"text", 'SENT'::"text", 'SKIPPED'::"text"]));



CREATE OR REPLACE TRIGGER "trg_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_payment_method_configs_updated_at" BEFORE UPDATE ON "public"."payment_method_configs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_payment_transactions_updated_at" BEFORE UPDATE ON "public"."payment_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_printer_jobs_updated_at" BEFORE UPDATE ON "public"."printer_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_set_daily_order_number" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_daily_order_number"();



CREATE OR REPLACE TRIGGER "trg_settings_updated_at" BEFORE UPDATE ON "public"."settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_webauthn_credential_limit" BEFORE INSERT ON "public"."webauthn_credentials" FOR EACH ROW EXECUTE FUNCTION "public"."check_webauthn_credential_limit"();



CREATE OR REPLACE TRIGGER "trg_whatsapp_messages_updated_at" BEFORE UPDATE ON "public"."whatsapp_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cash_sessions"
    ADD CONSTRAINT "cash_sessions_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."cash_sessions"
    ADD CONSTRAINT "cash_sessions_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."discounts"
    ADD CONSTRAINT "discounts_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."discounts"
    ADD CONSTRAINT "discounts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_addons"
    ADD CONSTRAINT "order_item_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_item_addons"
    ADD CONSTRAINT "order_item_addons_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_item_removed_ingredients"
    ADD CONSTRAINT "order_item_removed_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_item_removed_ingredients"
    ADD CONSTRAINT "order_item_removed_ingredients_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_discount_applied_by_fkey" FOREIGN KEY ("discount_applied_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_payment_method_code_fkey" FOREIGN KEY ("payment_method_code") REFERENCES "public"."payment_method_configs"("code");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."printer_jobs"
    ADD CONSTRAINT "printer_jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_addons"
    ADD CONSTRAINT "product_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_addons"
    ADD CONSTRAINT "product_addons_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_ingredients"
    ADD CONSTRAINT "product_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_ingredients"
    ADD CONSTRAINT "product_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



CREATE POLICY "Admin control addons" ON "public"."addons" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin control categories" ON "public"."categories" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin control ingredients" ON "public"."ingredients" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin control product_addons" ON "public"."product_addons" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin control product_ingredients" ON "public"."product_ingredients" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin control products" ON "public"."products" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin control settings" ON "public"."settings" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin controla profiles" ON "public"."profiles" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin gerencia addons do item" ON "public"."order_item_addons" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin gerencia customers" ON "public"."customers" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin gerencia descontos" ON "public"."discounts" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin gerencia itens de pedido" ON "public"."order_items" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin gerencia payment method configs" ON "public"."payment_method_configs" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin gerencia pedidos" ON "public"."orders" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin gerencia printer_jobs" ON "public"."printer_jobs" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin gerencia removidos" ON "public"."order_item_removed_ingredients" TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin gerencia whatsapp_messages" ON "public"."whatsapp_messages" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role")) WITH CHECK (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Admin read settings" ON "public"."settings" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Apenas Admin ve logs de auditoria" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'ADMIN'::"public"."user_role"));



CREATE POLICY "Attendant atualiza status printer_jobs" ON "public"."printer_jobs" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'ATTENDANT'::"public"."user_role")) WITH CHECK (("public"."get_my_role"() = 'ATTENDANT'::"public"."user_role"));



CREATE POLICY "Attendant le addons do item" ON "public"."order_item_addons" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'ATTENDANT'::"public"."user_role"));



CREATE POLICY "Attendant le descontos" ON "public"."discounts" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'ATTENDANT'::"public"."user_role"));



CREATE POLICY "Attendant le e atualiza printer_jobs" ON "public"."printer_jobs" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'ATTENDANT'::"public"."user_role"));



CREATE POLICY "Attendant le itens de pedido" ON "public"."order_items" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'ATTENDANT'::"public"."user_role"));



CREATE POLICY "Attendant le pedidos" ON "public"."orders" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'ATTENDANT'::"public"."user_role"));



CREATE POLICY "Attendant le removidos" ON "public"."order_item_removed_ingredients" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'ATTENDANT'::"public"."user_role"));



CREATE POLICY "Equipe gerencia caixas" ON "public"."cash_sessions" TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['ADMIN'::"public"."user_role", 'ATTENDANT'::"public"."user_role"])));



CREATE POLICY "Equipe gerencia pagamentos" ON "public"."payments" TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['ADMIN'::"public"."user_role", 'ATTENDANT'::"public"."user_role"])));



CREATE POLICY "Equipe le customers" ON "public"."customers" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['ADMIN'::"public"."user_role", 'ATTENDANT'::"public"."user_role"])));



CREATE POLICY "Equipe le payment method configs" ON "public"."payment_method_configs" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['ADMIN'::"public"."user_role", 'ATTENDANT'::"public"."user_role"])));



CREATE POLICY "Equipe le payment transactions" ON "public"."payment_transactions" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['ADMIN'::"public"."user_role", 'ATTENDANT'::"public"."user_role"])));



CREATE POLICY "Equipe le profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Equipe le whatsapp_messages" ON "public"."whatsapp_messages" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = ANY (ARRAY['ADMIN'::"public"."user_role", 'ATTENDANT'::"public"."user_role"])));



CREATE POLICY "Public read active addons" ON "public"."addons" FOR SELECT USING (("active" = true));



CREATE POLICY "Public read active categories" ON "public"."categories" FOR SELECT USING (("active" = true));



CREATE POLICY "Public read active ingredients" ON "public"."ingredients" FOR SELECT USING (("active" = true));



CREATE POLICY "Public read active products" ON "public"."products" FOR SELECT USING (("active" = true));



CREATE POLICY "Public read product_addons" ON "public"."product_addons" FOR SELECT USING (true);



CREATE POLICY "Public read product_ingredients" ON "public"."product_ingredients" FOR SELECT USING (true);



CREATE POLICY "Public read settings" ON "public"."settings" FOR SELECT USING (true);



ALTER TABLE "public"."addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cash_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_item_addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_item_removed_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_method_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."printer_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_addons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users manage own webauthn credentials" ON "public"."webauthn_credentials" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."webauthn_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_messages" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."check_webauthn_credential_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_webauthn_credential_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_webauthn_credential_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_daily_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_daily_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_daily_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_daily_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_daily_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_daily_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."addons" TO "anon";
GRANT ALL ON TABLE "public"."addons" TO "authenticated";
GRANT ALL ON TABLE "public"."addons" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."cash_sessions" TO "anon";
GRANT ALL ON TABLE "public"."cash_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."cash_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."discounts" TO "anon";
GRANT ALL ON TABLE "public"."discounts" TO "authenticated";
GRANT ALL ON TABLE "public"."discounts" TO "service_role";



GRANT ALL ON TABLE "public"."ingredients" TO "anon";
GRANT ALL ON TABLE "public"."ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."order_item_addons" TO "anon";
GRANT ALL ON TABLE "public"."order_item_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."order_item_addons" TO "service_role";



GRANT ALL ON TABLE "public"."order_item_removed_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."order_item_removed_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."order_item_removed_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payment_method_configs" TO "anon";
GRANT ALL ON TABLE "public"."payment_method_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_method_configs" TO "service_role";



GRANT ALL ON TABLE "public"."payment_transactions" TO "anon";
GRANT ALL ON TABLE "public"."payment_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."printer_jobs" TO "anon";
GRANT ALL ON TABLE "public"."printer_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."printer_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."product_addons" TO "anon";
GRANT ALL ON TABLE "public"."product_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."product_addons" TO "service_role";



GRANT ALL ON TABLE "public"."product_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."product_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."product_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."webauthn_credentials" TO "anon";
GRANT ALL ON TABLE "public"."webauthn_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."webauthn_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_messages" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































