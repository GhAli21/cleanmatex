


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."org_branches_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "branch_name" "text",
    "s_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "phone" character varying(50),
    "email" character varying(255),
    "type" character varying(20) DEFAULT 'walk_in'::character varying,
    "address" "text",
    "country" "text",
    "city" "text",
    "area" "text",
    "street" "text",
    "building" "text",
    "floor" "text",
    "latitude" double precision,
    "longitude" double precision,
    "rec_order" integer,
    "rec_status" smallint DEFAULT 1,
    "is_active" boolean DEFAULT true NOT NULL,
    "rec_notes" character varying(200),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text"
);


ALTER TABLE "public"."org_branches_mst" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_customers_mst" (
    "customer_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "s_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "loyalty_points" integer DEFAULT 0,
    "rec_order" integer,
    "rec_status" smallint DEFAULT 1,
    "is_active" boolean DEFAULT true NOT NULL,
    "rec_notes" character varying(200),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text"
);


ALTER TABLE "public"."org_customers_mst" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_invoice_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "tenant_org_id" "uuid" NOT NULL,
    "invoice_no" "text" NOT NULL,
    "subtotal" numeric(10,3) DEFAULT 0,
    "discount" numeric(10,3) DEFAULT 0,
    "tax" numeric(10,3) DEFAULT 0,
    "total" numeric(10,3) DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "due_date" "date",
    "payment_method" character varying(50),
    "paid_amount" numeric(10,3) DEFAULT 0,
    "paid_at" timestamp without time zone,
    "paid_by" character varying(255),
    "metadata" "jsonb",
    "rec_notes" character varying(1000),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text"
);


ALTER TABLE "public"."org_invoice_mst" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_order_items_dtl" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "service_category_code" character varying(120),
    "order_item_srno" "text",
    "product_id" "uuid",
    "barcode" "text",
    "quantity" integer DEFAULT 1,
    "price_per_unit" numeric(10,3) NOT NULL,
    "total_price" numeric(10,3) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "notes" "text",
    "color" character varying(50),
    "brand" character varying(100),
    "has_stain" boolean,
    "has_damage" boolean,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."org_order_items_dtl" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_orders_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "customer_id" "uuid" NOT NULL,
    "order_type_id" character varying(30),
    "order_no" character varying(100) NOT NULL,
    "status" "text" DEFAULT 'intake'::"text",
    "priority" "text" DEFAULT 'normal'::"text",
    "total_items" integer DEFAULT 0,
    "subtotal" numeric(10,3) DEFAULT 0,
    "discount" numeric(10,3) DEFAULT 0,
    "tax" numeric(10,3) DEFAULT 0,
    "total" numeric(10,3) DEFAULT 0,
    "payment_status" character varying(20) DEFAULT 'pending'::character varying,
    "payment_method" character varying(50),
    "paid_amount" numeric(10,3) DEFAULT 0,
    "paid_at" timestamp without time zone,
    "paid_by" character varying(255),
    "payment_notes" "text",
    "received_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "ready_by" timestamp without time zone,
    "ready_at" timestamp without time zone,
    "delivered_at" timestamp without time zone,
    "customer_notes" "text",
    "internal_notes" "text",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."org_orders_mst" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_payments_dtl_tr" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "paid_amount" numeric(10,3) DEFAULT 0,
    "status" "text" DEFAULT 'pending'::"text",
    "due_date" "date",
    "payment_method" character varying(50),
    "paid_at" timestamp without time zone,
    "paid_by" character varying(255),
    "gateway" "text",
    "transaction_id" "text",
    "metadata" "jsonb",
    "rec_notes" character varying(1000),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text"
);


ALTER TABLE "public"."org_payments_dtl_tr" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_product_data_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "service_category_code" character varying(120),
    "product_code" character varying(120) NOT NULL,
    "product_name" character varying(250),
    "product_name2" character varying(250),
    "hint_text" "text",
    "is_retail_item" boolean DEFAULT false,
    "product_type" integer,
    "price_type" "text",
    "product_unit" character varying(60),
    "default_sell_price" numeric(10,3),
    "default_express_sell_price" numeric(10,3),
    "product_cost" numeric(10,3),
    "min_sell_price" numeric(10,3),
    "min_quantity" integer,
    "pieces_per_product" integer,
    "extra_days" integer,
    "turnaround_hh" numeric(4,2),
    "turnaround_hh_express" numeric(4,2),
    "multiplier_express" numeric(4,2),
    "product_order" integer,
    "is_tax_exempt" integer,
    "tags" json,
    "id_sku" character varying(100),
    "is_active" boolean DEFAULT true NOT NULL,
    "service_category_color1" character varying(60),
    "service_category_color2" character varying(60),
    "service_category_color3" character varying(60),
    "service_category_icon" character varying(120),
    "service_category_image" character varying(120),
    "rec_order" integer,
    "rec_notes2" character varying(1000),
    "rec_status" smallint DEFAULT 1,
    "created_at2" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "created_by" character varying(120),
    "created_info" "text",
    "updated_at2" timestamp without time zone,
    "updated_by" character varying(120),
    "updated_info" "text"
);


ALTER TABLE "public"."org_product_data_mst" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_service_category_cf" (
    "tenant_org_id" "uuid" NOT NULL,
    "service_category_code" character varying(120) NOT NULL
);


ALTER TABLE "public"."org_service_category_cf" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_subscriptions_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_org_id" "uuid" NOT NULL,
    "plan" character varying(20) DEFAULT 'free'::character varying,
    "status" character varying(20) DEFAULT 'trial'::character varying,
    "orders_limit" integer DEFAULT 20,
    "orders_used" integer DEFAULT 0,
    "branch_limit" integer DEFAULT 1,
    "user_limit" integer DEFAULT 2,
    "start_date" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "end_date" timestamp without time zone NOT NULL,
    "trial_ends" timestamp without time zone,
    "last_payment_date" timestamp without time zone,
    "last_payment_amount" numeric(10,2),
    "last_payment_method" character varying(50),
    "payment_reference" character varying(100),
    "payment_notes" "text",
    "last_invoice_number" character varying(50),
    "last_invoice_date" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."org_subscriptions_mst" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_tenants_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "name2" character varying(255),
    "slug" character varying(100) NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone" character varying(50) NOT NULL,
    "s_cureent_plan" character varying(120) DEFAULT 'plan_freemium'::character varying,
    "address" "text",
    "city" character varying(100),
    "country" character varying(2) DEFAULT 'OM'::character varying,
    "currency" character varying(3) DEFAULT 'OMR'::character varying,
    "timezone" character varying(50) DEFAULT 'Asia/Muscat'::character varying,
    "language" character varying(5) DEFAULT 'en'::character varying,
    "is_active" boolean DEFAULT true,
    "status" character varying(20) DEFAULT 'trial'::character varying,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."org_tenants_mst" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sys_customers_mst" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text",
    "disply_name" "text",
    "name" character varying(255),
    "name2" character varying(255),
    "phone" character varying(50),
    "email" character varying(255),
    "type" character varying(20) DEFAULT 'walk_in'::character varying,
    "address" "text",
    "area" character varying(100),
    "building" character varying(100),
    "floor" character varying(50),
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "first_tenant_org_id" "uuid",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."sys_customers_mst" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sys_order_type_cd" (
    "order_type_id" character varying(30) NOT NULL,
    "order_type_name" character varying(250),
    "order_type_name2" character varying(250),
    "is_active" boolean DEFAULT true NOT NULL,
    "rec_notes" character varying(200),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    "order_type_color1" character varying(60),
    "order_type_color2" character varying(60),
    "order_type_color3" character varying(60),
    "order_type_icon" character varying(120),
    "order_type_image" character varying(120)
);


ALTER TABLE "public"."sys_order_type_cd" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sys_service_category_cd" (
    "service_category_code" character varying(120) NOT NULL,
    "ctg_name" character varying(250) NOT NULL,
    "ctg_name2" character varying(250),
    "ctg_desc" character varying(600),
    "turnaround_hh" numeric(4,2),
    "turnaround_hh_express" numeric(4,2),
    "multiplier_express" numeric(4,2),
    "is_builtin" boolean DEFAULT false NOT NULL,
    "has_fee" boolean DEFAULT false NOT NULL,
    "is_mandatory" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "rec_notes" character varying(200),
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone,
    "service_category_color1" character varying(60),
    "service_category_color2" character varying(60),
    "service_category_color3" character varying(60),
    "service_category_icon" character varying(120),
    "service_category_image" character varying(120)
);


ALTER TABLE "public"."sys_service_category_cd" OWNER TO "postgres";


ALTER TABLE ONLY "public"."org_branches_mst"
    ADD CONSTRAINT "org_branches_mst_pkey" PRIMARY KEY ("id", "tenant_org_id");



ALTER TABLE ONLY "public"."org_customers_mst"
    ADD CONSTRAINT "org_customers_mst_pkey" PRIMARY KEY ("customer_id", "tenant_org_id");



ALTER TABLE ONLY "public"."org_invoice_mst"
    ADD CONSTRAINT "org_invoice_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_invoice_mst"
    ADD CONSTRAINT "org_invoice_mst_tenant_org_id_invoice_no_key" UNIQUE ("tenant_org_id", "invoice_no");



ALTER TABLE ONLY "public"."org_order_items_dtl"
    ADD CONSTRAINT "org_order_items_dtl_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "org_orders_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "org_orders_mst_tenant_org_id_order_no_key" UNIQUE ("tenant_org_id", "order_no");



ALTER TABLE ONLY "public"."org_payments_dtl_tr"
    ADD CONSTRAINT "org_payments_dtl_tr_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_product_data_mst"
    ADD CONSTRAINT "org_product_data_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_product_data_mst"
    ADD CONSTRAINT "org_product_data_mst_tenant_org_id_product_code_key" UNIQUE ("tenant_org_id", "product_code");



ALTER TABLE ONLY "public"."org_service_category_cf"
    ADD CONSTRAINT "org_service_category_cf_pkey" PRIMARY KEY ("tenant_org_id", "service_category_code");



ALTER TABLE ONLY "public"."org_subscriptions_mst"
    ADD CONSTRAINT "org_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_tenants_mst"
    ADD CONSTRAINT "org_tenants_mst_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."org_tenants_mst"
    ADD CONSTRAINT "org_tenants_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_tenants_mst"
    ADD CONSTRAINT "org_tenants_mst_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."sys_customers_mst"
    ADD CONSTRAINT "sys_customers_mst_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sys_order_type_cd"
    ADD CONSTRAINT "sys_order_type_cd_pkey" PRIMARY KEY ("order_type_id");



ALTER TABLE ONLY "public"."sys_service_category_cd"
    ADD CONSTRAINT "sys_service_category_cd_pkey" PRIMARY KEY ("service_category_code");



CREATE INDEX "idx_org_invoice_tenant_no" ON "public"."org_invoice_mst" USING "btree" ("tenant_org_id", "invoice_no");



CREATE INDEX "idx_org_items_order" ON "public"."org_order_items_dtl" USING "btree" ("order_id");



CREATE INDEX "idx_org_orders_customer" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "customer_id");



CREATE INDEX "idx_org_orders_tenant_no" ON "public"."org_orders_mst" USING "btree" ("tenant_org_id", "order_no");



CREATE INDEX "idx_org_payments_invoice" ON "public"."org_payments_dtl_tr" USING "btree" ("invoice_id");



ALTER TABLE ONLY "public"."org_branches_mst"
    ADD CONSTRAINT "fk_org_branch_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_service_category_cf"
    ADD CONSTRAINT "fk_org_ctg_sys" FOREIGN KEY ("service_category_code") REFERENCES "public"."sys_service_category_cd"("service_category_code");



ALTER TABLE ONLY "public"."org_service_category_cf"
    ADD CONSTRAINT "fk_org_ctg_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_customers_mst"
    ADD CONSTRAINT "fk_org_cust_sys" FOREIGN KEY ("customer_id") REFERENCES "public"."sys_customers_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_customers_mst"
    ADD CONSTRAINT "fk_org_cust_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invoice_mst"
    ADD CONSTRAINT "fk_org_invoice_order" FOREIGN KEY ("order_id") REFERENCES "public"."org_orders_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_invoice_mst"
    ADD CONSTRAINT "fk_org_invoice_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_items_dtl"
    ADD CONSTRAINT "fk_org_items_ctg" FOREIGN KEY ("tenant_org_id", "service_category_code") REFERENCES "public"."org_service_category_cf"("tenant_org_id", "service_category_code");



ALTER TABLE ONLY "public"."org_order_items_dtl"
    ADD CONSTRAINT "fk_org_items_order" FOREIGN KEY ("order_id") REFERENCES "public"."org_orders_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_order_items_dtl"
    ADD CONSTRAINT "fk_org_items_prod" FOREIGN KEY ("product_id") REFERENCES "public"."org_product_data_mst"("id");



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "fk_org_order_branch" FOREIGN KEY ("branch_id", "tenant_org_id") REFERENCES "public"."org_branches_mst"("id", "tenant_org_id");



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "fk_org_order_customer" FOREIGN KEY ("customer_id", "tenant_org_id") REFERENCES "public"."org_customers_mst"("customer_id", "tenant_org_id");



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "fk_org_order_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_orders_mst"
    ADD CONSTRAINT "fk_org_order_type" FOREIGN KEY ("order_type_id") REFERENCES "public"."sys_order_type_cd"("order_type_id");



ALTER TABLE ONLY "public"."org_payments_dtl_tr"
    ADD CONSTRAINT "fk_org_payment_invoice" FOREIGN KEY ("invoice_id") REFERENCES "public"."org_invoice_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_payments_dtl_tr"
    ADD CONSTRAINT "fk_org_payment_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_product_data_mst"
    ADD CONSTRAINT "fk_org_prod_ctg" FOREIGN KEY ("tenant_org_id", "service_category_code") REFERENCES "public"."org_service_category_cf"("tenant_org_id", "service_category_code");



ALTER TABLE ONLY "public"."org_product_data_mst"
    ADD CONSTRAINT "fk_org_prod_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."org_subscriptions_mst"
    ADD CONSTRAINT "fk_org_subs_tenant" FOREIGN KEY ("tenant_org_id") REFERENCES "public"."org_tenants_mst"("id") ON DELETE CASCADE;



ALTER TABLE "public"."org_branches_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_customers_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_invoice_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_order_items_dtl" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_orders_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_payments_dtl_tr" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_product_data_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_service_category_cf" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_subscriptions_mst" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_tenants_mst" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_isolation" ON "public"."org_orders_mst" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_org_branches" ON "public"."org_branches_mst" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_org_customers" ON "public"."org_customers_mst" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_org_invoices" ON "public"."org_invoice_mst" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_org_order_items" ON "public"."org_order_items_dtl" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_org_orders" ON "public"."org_orders_mst" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_org_payments" ON "public"."org_payments_dtl_tr" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_org_products" ON "public"."org_product_data_mst" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_org_service_category" ON "public"."org_service_category_cf" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_org_subscriptions" ON "public"."org_subscriptions_mst" USING ((("tenant_org_id")::"text" = ("auth"."jwt"() ->> 'tenant_id'::"text")));



CREATE POLICY "tenant_isolation_org_tenants" ON "public"."org_tenants_mst" USING ((("id")::"text" = ("auth"."jwt"() ->> 'tenant_id'::"text")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."org_branches_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_branches_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_branches_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_customers_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_customers_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_customers_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_invoice_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_invoice_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_invoice_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_order_items_dtl" TO "anon";
GRANT ALL ON TABLE "public"."org_order_items_dtl" TO "authenticated";
GRANT ALL ON TABLE "public"."org_order_items_dtl" TO "service_role";



GRANT ALL ON TABLE "public"."org_orders_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_orders_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_orders_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_payments_dtl_tr" TO "anon";
GRANT ALL ON TABLE "public"."org_payments_dtl_tr" TO "authenticated";
GRANT ALL ON TABLE "public"."org_payments_dtl_tr" TO "service_role";



GRANT ALL ON TABLE "public"."org_product_data_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_product_data_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_product_data_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_service_category_cf" TO "anon";
GRANT ALL ON TABLE "public"."org_service_category_cf" TO "authenticated";
GRANT ALL ON TABLE "public"."org_service_category_cf" TO "service_role";



GRANT ALL ON TABLE "public"."org_subscriptions_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_subscriptions_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_subscriptions_mst" TO "service_role";



GRANT ALL ON TABLE "public"."org_tenants_mst" TO "anon";
GRANT ALL ON TABLE "public"."org_tenants_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."org_tenants_mst" TO "service_role";



GRANT ALL ON TABLE "public"."sys_customers_mst" TO "anon";
GRANT ALL ON TABLE "public"."sys_customers_mst" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_customers_mst" TO "service_role";



GRANT ALL ON TABLE "public"."sys_order_type_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_order_type_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_order_type_cd" TO "service_role";



GRANT ALL ON TABLE "public"."sys_service_category_cd" TO "anon";
GRANT ALL ON TABLE "public"."sys_service_category_cd" TO "authenticated";
GRANT ALL ON TABLE "public"."sys_service_category_cd" TO "service_role";









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































RESET ALL;
