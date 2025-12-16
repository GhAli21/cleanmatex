/*==============================================================*/
/* DBMS name:      PostgreSQL 9.x                               */
/* Created on:     11/26/2025 3:52:27 AM                        */
/*==============================================================*/


drop table org_auth_user_roles;

drop table org_auth_user_workflow_roles;

drop table org_branches_mst;

drop table org_customers_mst;

drop table org_delivery_routes;

drop table org_invoice_mst;

drop table org_item_notes_cf;

drop table org_item_notes_ctg_cf;

drop table org_loyalty_programs;

drop table org_order_item_notes_dtl;

drop table org_order_item_pieces;

drop table org_order_item_preferences_d;

drop table org_order_items_dtl;

drop table org_orders_mst;

drop table org_payments_dtl_tr;

drop table org_payments_types_flag_cf;

drop table org_preference_ctg_cf;

drop table org_preference_options_cf;

drop table org_price_lists_dtl;

drop table org_price_lists_mst;

drop table org_product_data_mst;

drop table org_product_unit_cd;

drop table org_service_category_cf;

drop table org_subscriptions_mst;
--
drop table org_tenant_settings_cf;

drop table org_tenants_mst;

drop table org_user_branches_dtl;

drop table org_users_mst;

drop table sys_auth_permissions;

drop table sys_auth_role_permissions;

drop table sys_auth_roles;

drop table sys_branch_type_cd;

drop table sys_color_cd;

drop table sys_currency_cd;

drop table sys_customer_type_cd;

drop table sys_customers_mst;

drop table sys_features_code_cd;

drop table sys_icons_cd;

drop table sys_invoice_type_cd;

drop table sys_item_fabric_type_cd;

drop table sys_item_notes_cd;

drop table sys_item_notes_ctg_cd;

drop table sys_item_stain_type_cd;

drop table sys_item_type_cd;

drop table sys_order_status_cd;

drop table sys_order_type_cd;

drop table sys_org_type_cd;

drop table sys_payment_method_cd;

drop table sys_payment_type_cd;

drop table sys_plan_features_cf;

drop table sys_plan_limits_cd;

drop table sys_plan_limits_cf;

drop table sys_pln_subscription_plans_mst;

drop table sys_preference_ctg_cd;

drop table sys_preference_options_cd;

drop table sys_priority_cd;

drop table sys_product_unit_cd;

drop table sys_service_category_cd;

drop table sys_service_prod_templates_cd;

drop table sys_service_type_cd;

drop table sys_main_business_type_cd;

drop table sys_tenant_settings_cd;

drop table sys_user_type_cd;

drop table system_settings;

/*==============================================================*/
/* Table: org_auth_user_roles                                   */
/*==============================================================*/
create table org_auth_user_roles (
   id                   uuid                 not null default gen_random_uuid(),
   user_id              uuid                 not null,
   tenant_org_id        uuid                 not null,
   role_id              uuid                 not null,
   is_active            boolean              null,
   created_at           timestamptz          null default now(),
   constraint PK_ORG_AUTH_USER_ROLES primary key (id),
   constraint AK_KEY_2_ORG_AUTH unique (user_id, tenant_org_id, role_id)
);

/*==============================================================*/
/* Table: org_auth_user_workflow_roles                          */
/*==============================================================*/
create table org_auth_user_workflow_roles (
   id                   uuid                 not null default gen_random_uuid(),
   user_id              uuid                 not null,
   tenant_org_id        uuid                 not null,
   workflow_role        text                 not null,
   is_active            boolean              null,
   created_at           timestamptz          null default now(),
   constraint PK_ORG_AUTH_USER_WORKFLOW_ROLE primary key (id),
   constraint AK_KEY_2_ORG_AUTH unique (user_id, tenant_org_id, workflow_role)
);

/*==============================================================*/
/* Table: org_branches_mst                                      */
/*==============================================================*/
create table org_branches_mst (
   id                   UUID                 not null default 'gen_random_uuid()',
   tenant_org_id        UUID                 not null,
   branch_name          TEXT                 null,
   name                 TEXT                 null,
   name2                TEXT                 null,
   is_main              BOOLEAN              null default 'false',
   s_date               TIMESTAMP            not null default CURRENT_TIMESTAMP,
   phone                VARCHAR(50)          null,
   email                VARCHAR(255)         null,
   type                 VARCHAR(20)          null default 'walk_in',
   address              TEXT                 null,
   country              TEXT                 null,
   city                 TEXT                 null,
   area                 TEXT                 null,
   street               TEXT                 null,
   building             TEXT                 null,
   floor                TEXT                 null,
   latitude             FLOAT                null,
   longitude            FLOAT                null,
   rec_order            INTEGER              null,
   rec_status           SMALLINT             null default '1',
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_ORG_BRANCHES_MST primary key (id, tenant_org_id)
);

/*==============================================================*/
/* Table: org_customers_mst                                     */
/*==============================================================*/
create table org_customers_mst (
   id                   UUID                 not null default 'gen_random_uuid()',
   tenant_org_id        UUID                 not null,
   customer_id          UUID                 null,
   name                 TEXT                 null,
   name2                TEXT                 null,
   display_name         TEXT                 null,
   first_name           TEXT                 null,
   last_name            TEXT                 null,
   phone                TEXT                 null,
   email                TEXT                 null,
   type                 TEXT                 null default 'walk_in',
   address              TEXT                 null,
   area                 TEXT                 null,
   building             TEXT                 null,
   floor                TEXT                 null,
   preferences          JSONB                null default '{}',
   customer_source_type TEXT                 not null default 'DIRECT',
   s_date               TIMESTAMP            not null default CURRENT_TIMESTAMP,
   loyalty_points       INTEGER              null default '0',
   rec_order            INTEGER              null,
   rec_status           SMALLINT             null default '1',
   is_active            BOOLEAN              not null default 'true',
   rec_notes            TEXT                 null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   created_by           UUID                 null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           UUID                 null,
   updated_info         TEXT                 null,
   constraint PK_ORG_CUSTOMERS_MST primary key (id),
   constraint AK_GLOBAL_CUSTOMER_ID_ORG_CUST unique (tenant_org_id, customer_id)
);

comment on column org_customers_mst.customer_id is
'Global Customer ID';

comment on column org_customers_mst.customer_source_type is
'the source type, TENANT, CUSTOMER_APP, MARKET_PLACE, DIRECT, direct is when inserted to this table not from other source';

/*==============================================================*/
/* Table: org_delivery_routes                                   */
/*==============================================================*/
create table org_delivery_routes (
   id                   UUID                 not null default 'gen_random_uuid()',
   tenant_org_id        UUID                 not null,
   driver_id            UUID                 null,
   r_desc               TEXT                 null,
   r_date               DATE                 null,
   status               VARCHAR(1100)        null,
   orders               JSONB                null,
   constraint PK_ORG_DELIVERY_ROUTES primary key (id)
);

comment on table org_delivery_routes is
'tenant_delivery_routes ';

comment on column org_delivery_routes.status is
'pending', 'in_progress', 'completed';

comment on column org_delivery_routes.orders is
'Array of order IDs';

/*==============================================================*/
/* Table: org_invoice_mst                                       */
/*==============================================================*/
create table org_invoice_mst (
   id                   UUID                 not null default 'gen_random_uuid()',
   order_id             UUID                 null,
   tenant_org_id        UUID                 null,
   invoice_no           TEXT                 null,
   subtotal             DECIMAL(10,3)        null,
   discount             DECIMAL(10,3)        null default 0,
   tax                  DECIMAL(10,3)        null default 0,
   total                DECIMAL(10,3)        null default 0,
   status               TEXT                 null default 'pending',
   due_date             DATE                 null,
   payment_method       VARCHAR(50)          null,
   paid_amount          DECIMAL(10,3)        null default 0,
   paid_at              TIMESTAMPZ           null,
   paid_by              VARCHAR(255)         null,
   metadata             JSONB                null,
   rec_notes            VARCHAR(1000)        null,
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_ORG_INVOICE_MST primary key (id),
   constraint AK_KEY_2_ORG_INVO unique (tenant_org_id, invoice_no)
);

/*==============================================================*/
/* Table: org_item_notes_cf                                     */
/*==============================================================*/
create table org_item_notes_cf (
   id                   UUID                 not null default 'gen_random_uuid()',
   item_note_ctg_id     UUID                 not null,
   item_note_code       TEXT                 not null,
   item_note_name       TEXT                 null,
   item_note_name2      TEXT                 null,
   is_color_note        BOOLEAN              null default 'false',
   item_note_desc       TEXT                 null,
   is_per_item_or_order SMALLINT             null default '1',
   color_note_rgb       TEXT                 null,
   show_in_order_quick_bar BOOLEAN              null default 'true',
   show_in_all_stages   BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            VARCHAR(1000)        null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_ORG_ITEM_NOTES_CF primary key (id),
   constraint AK_KEY_2_ORG_ITEM unique (item_note_ctg_id, item_note_code)
);

comment on table org_item_notes_cf is
'Tenant item Notes coding';

comment on column org_item_notes_cf.is_per_item_or_order is
'1=PER ITEM ONLY, 2=PER ORDER, 3=ANYWHERE';

/*==============================================================*/
/* Table: org_item_notes_ctg_cf                                 */
/*==============================================================*/
create table org_item_notes_ctg_cf (
   id                   UUID                 not null default 'gen_random_uuid()',
   tenant_org_id        UUID                 null,
   item_note_ctg_code   TEXT                 not null,
   item_note_ctg_name   TEXT                 null,
   item_note_ctg_name2  TEXT                 null,
   item_note_ctg_desc   TEXT                 null,
   is_color_note        BOOLEAN              null default 'false',
   is_per_item_or_order SMALLINT             null default '1',
   show_in_quick_bar    BOOLEAN              null default 'true',
   show_in_all_stages   BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            VARCHAR(1000)        null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_ORG_ITEM_NOTES_CTG_CF primary key (id),
   constraint AK_KEY_2_ORG_ITEM unique (tenant_org_id, item_note_ctg_code)
);

comment on table org_item_notes_ctg_cf is
'Tenants item Notes Categories';

comment on column org_item_notes_ctg_cf.is_per_item_or_order is
'1=PER ITEM ONLY, 2=PER ORDER, 3=ANYWHERE';

/*==============================================================*/
/* Table: org_loyalty_programs                                  */
/*==============================================================*/
create table org_loyalty_programs (
   id                   UUID                 not null default 'gen_random_uuid()',
   tenant_org_id        UUID                 not null,
   name                 TEXT                 null,
   points_per_currency  DECIMAL(10,3)        null,
   rules                JSONB                null,
   constraint PK_ORG_LOYALTY_PROGRAMS primary key (id)
);

/*==============================================================*/
/* Table: org_order_item_notes_dtl                              */
/*==============================================================*/
create table org_order_item_notes_dtl (
   id                   UUID                 not null default 'gen_random_uuid()',
   order_item_id        UUID                 not null,
   tenant_org_id        UUID                 null,
   item_note_id         UUID                 null,
   item_note_desc       TEXT                 null,
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            VARCHAR(1000)        null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_ORG_ORDER_ITEM_NOTES_DTL primary key (id)
);

/*==============================================================*/
/* Table: org_order_item_pieces                                 */
/*==============================================================*/
create table org_order_item_pieces (
   id                   UUID                 not null,
   tenant_org_id        UUID                 null default 'gen_random_uuid()',
   order_id             UUID                 not null,
   order_id2            UUID                 not null,
   service_category_code VARCHAR(120)         null,
   piece_seq            INTEGER              null,
   piece_code           TEXT                 null default 'generated always as (order_id::text || ''-'' || order_item_id::text || ''-'' || unit_seq) stored',
   product_id           UUID                 null,
   barcode              TEXT                 null,
   quantity             INTEGER              null default '1',
   price_per_unit       DECIMAL(10,3)        not null,
   total_price          DECIMAL(10,3)        not null,
   status               TEXT                 null default 'processing',
   stage                TEXT                 null,
   is_rejected          BOOLEAN              null default 'false',
   issue_id             UUID                 null,
   rack_location        TEXT                 null,
   last_step_at         TIMESTAMP            null,
   last_step_by         TEXT                 null,
   last_step            TEXT                 null,
   notes                TEXT                 null,
   color                VARCHAR(50)          null,
   brand                VARCHAR(100)         null,
   has_stain            BOOLEAN              null,
   has_damage           BOOLEAN              null,
   metadata             JSONB                null default '{}',
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   constraint PK_ORG_ORDER_ITEM_PIECES primary key (id)
);

comment on table org_order_item_pieces is
'Items Pieces, Optional table if in settings USE_TRACK_BY_PIECE is true';

comment on column org_order_item_pieces.status is
' intake|processing|qa|ready';

/*==============================================================*/
/* Table: org_order_item_preferences_d                          */
/*==============================================================*/
create table org_order_item_preferences_d (
   id                   UUID                 not null default 'gen_random_uuid()',
   order_item_id        UUID                 not null,
   preference_ctg_id    UUID                 not null,
   option_id            UUID                 not null default 'gen_random_uuid()',
   option_desc          TEXT                 null,
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            VARCHAR(1000)        null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_ORG_ORDER_ITEM_PREFERENCES_ primary key (id)
);

/*==============================================================*/
/* Table: org_order_items_dtl                                   */
/*==============================================================*/
create table org_order_items_dtl (
   id                   UUID                 not null,
   order_id             UUID                 not null,
   tenant_org_id        UUID                 null default 'gen_random_uuid()',
   service_category_code VARCHAR(120)         null,
   order_item_srno      TEXT                 null,
   product_id           UUID                 null,
   barcode              TEXT                 null,
   quantity             INTEGER              null default '1',
   price_per_unit       DECIMAL(10,3)        not null,
   total_price          DECIMAL(10,3)        not null,
   status               TEXT                 null default 'processing',
   notes                TEXT                 null,
   color                VARCHAR(50)          null,
   brand                VARCHAR(100)         null,
   has_stain            BOOLEAN              null,
   has_damage           BOOLEAN              null,
   metadata             JSONB                null default '{}',
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   constraint PK_ORG_ORDER_ITEMS_DTL primary key (id)
);

/*==============================================================*/
/* Table: org_orders_mst                                        */
/*==============================================================*/
create table org_orders_mst (
   id                   UUID                 not null default 'gen_random_uuid()',
   tenant_org_id        UUID                 not null,
   branch_id            UUID                 null,
   customer_id          UUID                 not null,
   order_type_id        VARCHAR(30)          null,
   order_no             VARCHAR(100)         not null,
   status               TEXT                 null default 'intake',
   priority             TEXT                 null default 'normal',
   total_items          INTEGER              null default '0',
   subtotal             DECIMAL(10,3)        null default 0,
   discount             DECIMAL(10,3)        null default 0,
   tax                  DECIMAL(10,3)        null default 0,
   total                DECIMAL(10,3)        null default 0,
   payment_status       VARCHAR(20)          null default 'pending',
   payment_method       VARCHAR(50)          null,
   paid_amount          DECIMAL(10,3)        null default 0,
   paid_at              TIMESTAMP            null,
   paid_by              VARCHAR(255)         null,
   payment_notes        TEXT                 null,
   received_at          TIMESTAMP            null default CURRENT_TIMESTAMP,
   ready_by             TIMESTAMP            null,
   ready_at             TIMESTAMP            null,
   delivered_at         TIMESTAMP            null,
   customer_notes       TEXT                 null,
   internal_notes       TEXT                 null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   constraint PK_ORG_ORDERS_MST primary key (id),
   constraint AK_KEY_2_ORG_ORDE unique (tenant_org_id, order_no)
);

comment on table org_orders_mst is
'Orders Master';

/*==============================================================*/
/* Table: org_payments_dtl_tr                                   */
/*==============================================================*/
create table org_payments_dtl_tr (
   id                   UUID                 not null default 'gen_random_uuid()',
   invoice_id           UUID                 null default 'gen_random_uuid()',
   tenant_org_id        UUID                 null default 'gen_random_uuid()',
   paid_amount          DECIMAL(10,3)        null default 0,
   status               TEXT                 null default 'pending',
   due_date             DATE                 null,
   payment_method       VARCHAR(50)          null,
   paid_at              TIMESTAMPZ           null,
   paid_by              VARCHAR(255)         null,
   gateway              TEXT                 null,
   transaction_id       TEXT                 null,
   metadata             JSONB                null,
   rec_notes            VARCHAR(1000)        null,
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_ORG_PAYMENTS_DTL_TR primary key (id)
);

/*==============================================================*/
/* Table: org_payments_types_flag_cf                            */
/*==============================================================*/
create table org_payments_types_flag_cf (
   Column_1             TEXT                 null
);

/*==============================================================*/
/* Table: org_preference_ctg_cf                                 */
/*==============================================================*/
create table org_preference_ctg_cf (
   id                   UUID                 not null default 'gen_random_uuid()',
   tenant_org_id        UUID                 null,
   preference_ctg_code  TEXT                 not null,
   preference_ctg_name  TEXT                 null,
   preference_ctg_name2 TEXT                 null,
   preference_ctg_desc  TEXT                 null,
   is_per_item_or_order SMALLINT             null default '1',
   is_color             BOOLEAN              null default 'FALSE',
   show_in_quick_bar    BOOLEAN              null default 'true',
   show_in_all_stages   BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            VARCHAR(1000)        null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_ORG_PREFERENCE_CTG_CF primary key (id),
   constraint AK_KEY_2_ORG_PREF unique (tenant_org_id, preference_ctg_code)
);

comment on table org_preference_ctg_cf is
'Tenant Preference Categories';

comment on column org_preference_ctg_cf.is_per_item_or_order is
'1=PER ITEM ONLY, 2=PER ORDER, 3=ANYWHERE';

/*==============================================================*/
/* Table: org_preference_options_cf                             */
/*==============================================================*/
create table org_preference_options_cf (
   id                   UUID                 not null default 'gen_random_uuid()',
   preference_ctg_id    UUID                 not null,
   preference_option_code TEXT                 not null,
   preference_option_name TEXT                 null,
   preference_option_name2 TEXT                 null,
   preference_ctg_desc  TEXT                 null,
   is_per_item_or_order SMALLINT             null default '1',
   is_color             BOOLEAN              null default 'FALSE',
   option_color_rgb     TEXT                 null,
   show_in_quick_bar    BOOLEAN              null default 'true',
   show_in_all_stages   BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            VARCHAR(1000)        null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_ORG_PREFERENCE_OPTIONS_CF primary key (id),
   constraint AK_KEY_2_ORG_PREF unique (preference_ctg_id, preference_option_code)
);

comment on table org_preference_options_cf is
'Tenant Preference Categories Options';

comment on column org_preference_options_cf.is_per_item_or_order is
'1=PER ITEM ONLY, 2=PER ORDER, 3=ANYWHERE';

/*==============================================================*/
/* Table: org_price_lists_dtl                                   */
/*==============================================================*/
create table org_price_lists_dtl (
   id                   UUID                 not null default 'gen_random_uuid()',
   product_id           UUID                 not null,
   price_list_id        UUID                 not null,
   currency_code        VARCHAR(10)          null,
   price                DECIMAL(19,4)        null,
   express_price        DECIMAL(19,4)        null,
   is_allow_more_discout BOOLEAN              null default 'FALSE',
   min_qty              INTEGER              null,
   max_qty              INTEGER              null,
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            TEXT                 null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           TEXT                 null,
   updated_info         TEXT                 null,
   constraint PK_ORG_PRICE_LISTS_DTL primary key (id)
);

/*==============================================================*/
/* Table: org_price_lists_mst                                   */
/*==============================================================*/
create table org_price_lists_mst (
   id                   UUID                 not null default 'gen_random_uuid()',
   tenant_org_id        UUID                 not null,
   name                 TEXT                 not null,
   name2                TEXT                 null,
   "desc"               TEXT                 null,
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            TEXT                 null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           TEXT                 null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           TEXT                 null,
   updated_info         TEXT                 null,
   constraint PK_ORG_PRICE_LISTS_MST primary key (id)
);

comment on table org_price_lists_mst is
'Pricing List T Allow puting defferent prices such as VIP, Summer, Seasons..so on';

/*==============================================================*/
/* Table: org_product_data_mst                                  */
/*==============================================================*/
create table org_product_data_mst (
   id                   UUID                 not null default 'gen_random_uuid()',
   tenant_org_id        UUID                 null,
   service_category_code VARCHAR(120)         null,
   product_code         VARCHAR(120)         not null,
   product_name         TEXT                 null,
   product_name2        TEXT                 null,
   hint_text            TEXT                 null,
   product_group1       TEXT                 null,
   product_group2       TEXT                 null,
   product_group3       TEXT                 null,
   is_retail_item       BOOLEAN              null default 'false',
   product_type         INTEGER              null,
   price_type           TEXT                 null,
   product_unit         VARCHAR(60)          null,
   default_sell_price   DECIMAL(19,4)        null,
   default_express_sell_price DECIMAL(19,4)        null,
   product_cost         DECIMAL(19,4)        null,
   min_sell_price       DECIMAL(19,4)        null,
   min_quantity         INTEGER              null,
   pieces_per_product   INTEGER              null,
   extra_days           INTEGER              null,
   turnaround_hh        NUMERIC(4, 2)        null,
   turnaround_hh_express NUMERIC(4, 2)        null,
   multiplier_express   NUMERIC(4, 2)        null,
   product_order        INTEGER              null,
   is_tax_exempt        INTEGER              null,
   tags                 JSON                 null,
   id_sku               VARCHAR(100)         null,
   is_active            BOOLEAN              not null default 'true',
   product_color1       TEXT                 null,
   product_color2       TEXT                 null,
   product_color3       TEXT                 null,
   product_icon         TEXT                 null,
   product_image        TEXT                 null,
   rec_order            INTEGER              null,
   rec_notes2           VARCHAR(1000)        null,
   rec_status           SMALLINT             null default '1',
   created_at2          TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at2          TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_ORG_PRODUCT_DATA_MST primary key (id),
   constraint AK_KEY_2_PRODUCT_TENANT unique (tenant_org_id, product_code)
);

comment on table org_product_data_mst is
'Master data of all products/items/services';

comment on column org_product_data_mst.product_type is
'This for use in the programming:Product Type: Normal, Weight, Price per square meter / feet
';

comment on column org_product_data_mst.price_type is
'per_piece, per_wight';

comment on column org_product_data_mst.product_cost is
'For Initial cost if exist such as if external services providers';

comment on column org_product_data_mst.min_sell_price is
'This if want to not go less than this price even if there is discounts or offers or packages.';

comment on column org_product_data_mst.pieces_per_product is
'such as suite have 2 pieces and null=1';

comment on column org_product_data_mst.extra_days is
'the value of this will added to the order ready by date and null=0';

comment on column org_product_data_mst.turnaround_hh is
'Ready_by';

comment on column org_product_data_mst.product_order is
'Order by in the view';

comment on column org_product_data_mst.id_sku is
'Stock-Keeping Unit ID for integrating with inventory ';

/*==============================================================*/
/* Table: org_product_unit_cd                                   */
/*==============================================================*/
create table org_product_unit_cd (
   id                   UUID                 not null default 'gen_random_uuid()',
   unit_code            VARCHAR(60)          not null,
   unit_name            VARCHAR(250)         null,
   unit_name2           VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   constraint PK_ORG_PRODUCT_UNIT_CD primary key (id, unit_code)
);

comment on table org_product_unit_cd is
'Measurement Units';

/*==============================================================*/
/* Table: org_service_category_cf                               */
/*==============================================================*/
create table org_service_category_cf (
   tenant_org_id        UUID                 not null default 'gen_random_uuid()',
   service_category_code VARCHAR(120)         not null,
   is_enabled           BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            TEXT                 null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           TEXT                 null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           TEXT                 null,
   updated_info         TEXT                 null,
   constraint PK_ORG_SERVICE_CATEGORY_CF primary key (tenant_org_id, service_category_code)
);

/*==============================================================*/
/* Table: org_subscriptions_mst                                 */
/*==============================================================*/
create table org_subscriptions_mst (
   id                   UUID                 not null,
   tenant_org_id        UUID                 not null,
   plan                 VARCHAR(20)          null default 'free',
   status               VARCHAR(20)          null default 'trial',
   orders_limit         INTEGER              null default '20',
   orders_used          INTEGER              null default '0',
   branch_limit         INTEGER              null default '1',
   user_limit           INTEGER              null default '2',
   start_date           TIMESTAMP            null default CURRENT_TIMESTAMP,
   end_date             TIMESTAMP            not null,
   trial_ends           TIMESTAMP            null,
   last_payment_date    TIMESTAMP            null,
   last_payment_amount  DECIMAL(10,2)        null,
   last_payment_method  VARCHAR(50)          null,
   payment_reference    VARCHAR(100)         null,
   payment_notes        TEXT                 null,
   last_invoice_number  VARCHAR(50)          null,
   last_invoice_date    TIMESTAMP            null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   constraint PK_ORG_SUBSCRIPTIONS_MST primary key (id),
   constraint AK_KEY_2_ORG_SUBS unique (tenant_org_id)
);


-- org_pln_subscriptions_mst
create table org_pln_subscriptions_mst (
  id uuid not null default gen_random_uuid (),
  tenant_org_id uuid not null,
  plan_code character varying(50) not null,
  plan_name character varying(250) null,
  status character varying(20) null default 'trial'::character varying,
  base_price numeric(10, 3) not null,
  currency character varying(3) null default 'OMR'::character varying,
  billing_cycle character varying(20) null default 'monthly'::character varying,
  current_period_start date not null,
  current_period_end date not null,
  trial_start date null,
  trial_end date null,
  activated_at timestamp without time zone null,
  suspended_at timestamp without time zone null,
  cancelled_at timestamp without time zone null,
  cancellation_reason text null,
  discount_code character varying(50) null,
  discount_value numeric(10, 3) null,
  discount_type character varying(20) null,
  discount_duration_months integer null,
  discount_applied_at timestamp without time zone null,
  scheduled_plan_code character varying(50) null,
  scheduled_plan_change_date date null,
  plan_change_scheduled_at timestamp without time zone null,
  plan_changed_at timestamp without time zone null,
  previous_plan_code character varying(50) null,
  default_payment_method_id uuid null,
  subscription_notes text null,
  created_at timestamp without time zone null default CURRENT_TIMESTAMP,
  created_by character varying(120) null,
  created_info text null,
  updated_at timestamp without time zone null,
  updated_by character varying(120) null,
  updated_info text null,
  rec_status smallint null default 1,
  rec_order integer null,
  rec_notes character varying(200) null,
  is_active boolean not null default true,
  constraint org_pln_subscriptions_mst_pkey primary key (id),
  constraint org_pln_subscriptions_mst_tenant_org_id_id_key unique (tenant_org_id, id),
  constraint org_pln_subscriptions_mst_tenant_org_id_fkey foreign KEY (tenant_org_id) references org_tenants_mst (id) on delete CASCADE,
  constraint org_pln_subscriptions_mst_discount_type_check check (
    (
      (discount_type)::text = any (
        (
          array[
            'percentage'::character varying,
            'fixed_amount'::character varying,
            'free_months'::character varying
          ]
        )::text[]
      )
    )
  ),
  constraint org_pln_subscriptions_mst_status_check check (
    (
      (status)::text = any (
        (
          array[
            'trial'::character varying,
            'active'::character varying,
            'past_due'::character varying,
            'suspended'::character varying,
            'cancelled'::character varying,
            'expired'::character varying
          ]
        )::text[]
      )
    )
  )
);

create index IF not exists idx_org_pln_subs_tenant on public.org_pln_subscriptions_mst using btree (tenant_org_id) TABLESPACE pg_default;

create index IF not exists idx_org_pln_subs_status on public.org_pln_subscriptions_mst using btree (status, is_active) TABLESPACE pg_default;

create index IF not exists idx_org_pln_subs_plan on public.org_pln_subscriptions_mst using btree (plan_code) TABLESPACE pg_default;

create index IF not exists idx_org_pln_subs_period on public.org_pln_subscriptions_mst using btree (current_period_end) TABLESPACE pg_default;

-- to set updated_at column 
create trigger update_subscription_timestamp BEFORE
update on org_pln_subscriptions_mst for EACH row
execute FUNCTION update_subscription_updated_at ();


/*==============================================================*/
/* Table: org_tenant_settings_cf                                */
/*==============================================================*/
create table org_tenant_settings_cf (
   id                   UUID                 not null default 'gen_random_uuid()',
   tenant_org_id        UUID                 not null,
   setting_code         TEXT                 not null,
   setting_name         TEXT                 null,
   setting_name2        TEXT                 null,
   setting_desc         TEXT                 null,
   setting_value_type   TEXT                 null,
   setting_value        TEXT                 null,
   is_active            BOOLEAN              null default 'true',
   branch_id            UUID                 null,
   user_id              UUID                 null,
   rec_order            INTEGER              null,
   rec_notes            TEXT                 null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           TEXT                 null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           TEXT                 null,
   updated_info         TEXT                 null,
   constraint PK_ORG_TENANT_SETTINGS_CF primary key (id)
);

/*==============================================================*/
/* Table: org_tenants_mst                                       */
/*==============================================================*/
create table org_tenants_mst (
   id                   UUID                 not null default 'gen_random_uuid()',
   name                 TEXT                 not null,
   name2                TEXT                 null,
   slug                 TEXT                 not null,
   email                TEXT                 not null,
   phone                VARCHAR(50)          not null,
   s_cureent_plan       VARCHAR(120)         null default 'plan_freemium',
   address              TEXT                 null,
   city                 TEXT                 null,
   country              TEXT                 null default 'OM',
   currency             VARCHAR(10)          null default 'OMR',
   timezone             TEXT                 null default 'Asia/Muscat',
   language             VARCHAR(5)           null default 'en',
   is_active            BOOLEAN              null default 'true',
   status               VARCHAR(20)          null default 'trial',
   created_at           TIMESTAMP            null default 'NOW()',
   updated_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   constraint PK_ORG_TENANTS_MST primary key (id),
   constraint AK_KEY_2_ORG_TENA unique (slug),
   constraint AK_KEY_3_ORG_TENA unique (email)
);

comment on table org_tenants_mst is
'Tenants/Organizations Master Data';

/*==============================================================*/
/* Table: org_user_branches_dtl                                 */
/*==============================================================*/
create table org_user_branches_dtl (
   user_id              UUID                 not null,
   tenant_org_id        UUID                 not null,
   branch_id            UUID                 not null default 'gen_random_uuid()',
   start_date           DATE                 null,
   last_date            DATE                 null,
   can_login            BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            TEXT                 null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           TEXT                 null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           TEXT                 null,
   updated_info         TEXT                 null,
   constraint PK_ORG_USER_BRANCHES_DTL primary key (user_id, branch_id, tenant_org_id)
);

comment on table org_user_branches_dtl is
'All branches the user can login and do transactions';

/*==============================================================*/
/* Table: org_users_mst                                         */
/*==============================================================*/
create table org_users_mst (
   id                   UUID                 not null,
   user_id              UUID                 null,
   tenant_org_id        UUID                 not null,
   def_branch_id        UUID                 null,
   disply_name          TEXT                 null,
   name                 TEXT                 null,
   name2                TEXT                 null,
   first_name           TEXT                 null,
   last_name            TEXT                 null,
   password_hash        TEXT                 null,
   phone                VARCHAR(50)          null,
   email                VARCHAR(255)         null,
   type                 VARCHAR(120)         null default 'walk_in',
   role                 TEXT                 null,
   address              TEXT                 null,
   area                 TEXT                 null,
   building             TEXT                 null,
   floor                TEXT                 null,
   is_user              BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            TEXT                 null,
   rec_status           SMALLINT             null default '1',
   created_by           TEXT                 null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   created_info         TEXT                 null,
   updated_by           TEXT                 null,
   updated_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_info         TEXT                 null,
   constraint PK_ORG_USERS_MST primary key (id),
   constraint AK_KEY_2_ORG_USER unique (tenant_org_id, email)
);

comment on column org_users_mst.user_id is
'supabase_user_id';

comment on column org_users_mst.def_branch_id is
'Current Default Main Branch ID For the User';

comment on column org_users_mst.role is
'admin', 'operator', 'driver';

/*==============================================================*/
/* Table: sys_auth_permissions                                  */
/*==============================================================*/
create table sys_auth_permissions (
   permission_id        uuid                 not null default gen_random_uuid(),
   code                 text                 not null,
   name                 text                 null,
   name2                text                 null,
   category             text                 null,
   is_active            boolean              null,
   created_at           timestamptz          null default now(),
   constraint PK_SYS_AUTH_PERMISSIONS primary key (permission_id),
   constraint AK_KEY_2_SYS_AUTH unique (code)
);

/*==============================================================*/
/* Table: sys_auth_role_permissions                             */
/*==============================================================*/
create table sys_auth_role_permissions (
   role_id              uuid                 not null,
   permission_id        uuid                 not null,
   constraint PK_SYS_AUTH_ROLE_PERMISSIONS primary key (role_id, permission_id)
);

/*==============================================================*/
/* Table: sys_auth_roles                                        */
/*==============================================================*/
create table sys_auth_roles (
   role_id              uuid                 not null default gen_random_uuid(),
   code                 text                 not null,
   name                 text                 null,
   name2                text                 null,
   is_system            boolean              null,
   created_at           timestamptz          null default now(),
   constraint PK_SYS_AUTH_ROLES primary key (role_id),
   constraint AK_KEY_2_SYS_AUTH unique (code)
);

/*==============================================================*/
/* Table: sys_branch_type_cd                                    */
/*==============================================================*/
create table sys_branch_type_cd (
   branch_type_id       VARCHAR(30)          not null,
   branch_type_name     VARCHAR(250)         null,
   branch_type_name2    VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   constraint PK_SYS_BRANCH_TYPE_CD primary key (branch_type_id)
);

/*==============================================================*/
/* Table: sys_color_cd                                          */
/*==============================================================*/
create table sys_color_cd (
   color_code           VARCHAR(120)         not null,
   color_name           VARCHAR(250)         null,
   color_name2          VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   color1               VARCHAR(60)          null,
   color2               VARCHAR(60)          null,
   color3               VARCHAR(60)          null,
   color_icon           VARCHAR(120)         null,
   color_image          VARCHAR(120)         null,
   constraint PK_SYS_COLOR_CD primary key (color_code)
);

/*==============================================================*/
/* Table: sys_currency_cd                                       */
/*==============================================================*/
create table sys_currency_cd (
   currency_code        VARCHAR(10)          not null,
   currency_name        VARCHAR(250)         null,
   currency_name2       VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   minor_unit           INTEGER              null,
   minor_unit_name      VARCHAR(120)         null,
   symbol               VARCHAR(100)         null,
   constraint PK_SYS_CURRENCY_CD primary key (currency_code)
);

comment on table sys_currency_cd is
'currencies';

comment on column sys_currency_cd.minor_unit is
'USD=2
OMR=3';

comment on column sys_currency_cd.minor_unit_name is
'USD=cent
OMR=biza';

comment on column sys_currency_cd.symbol is
'USD=$
OMR=Null';

/*==============================================================*/
/* Table: sys_customer_type_cd                                  */
/*==============================================================*/
create table sys_customer_type_cd (
   customer_type_id     TEXT                 not null,
   customer_type_name   TEXT                 null,
   customer_type_name2  TEXT                 null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            TEXT                 null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   customer_type_color1 TEXT                 null,
   customer_type_color2 TEXT                 null,
   customer_type_color3 TEXT                 null,
   customer_type_icon   TEXT                 null,
   customer_type_image  TEXT                 null,
   constraint PK_SYS_CUSTOMER_TYPE_CD primary key (customer_type_id)
);

/*==============================================================*/
/* Table: sys_customers_mst                                     */
/*==============================================================*/
create table sys_customers_mst (
   id                   UUID                 not null default 'gen_random_uuid()',
   customer_source_type TEXT                 not null default 'DIRECT',
   name                 TEXT                 null,
   name2                TEXT                 null,
   display_name         TEXT                 null,
   first_name           TEXT                 not null,
   last_name            TEXT                 null,
   phone                TEXT                 null,
   email                TEXT                 null,
   type                 TEXT                 null default 'walk_in',
   address              TEXT                 null,
   area                 TEXT                 null,
   building             TEXT                 null,
   floor                TEXT                 null,
   preferences          JSONB                null default '{}',
   first_tenant_org_id  UUID                 null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   constraint PK_SYS_CUSTOMERS_MST primary key (id)
);

comment on column sys_customers_mst.customer_source_type is
'the source type, TENANT, CUSTOMER_APP, MARKET_PLACE, DIRECT, direct is when inserted to this table not from other source';

/*==============================================================*/
/* Table: sys_features_code_cd                                  */
/*==============================================================*/
create table sys_features_code_cd (
   feature_code         VARCHAR(60)          not null,
   feature_name         VARCHAR(250)         null,
   feature_name2        VARCHAR(250)         null,
   f_desc               TEXT                 null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   constraint PK_SYS_FEATURES_CODE_CD primary key (feature_code)
);

comment on table sys_features_code_cd is
'ALL features in the system';

/*==============================================================*/
/* Table: sys_icons_cd                                          */
/*==============================================================*/
create table sys_icons_cd (
   icon_code            VARCHAR(60)          not null,
   icon_name            VARCHAR(250)         null,
   icon_name2           VARCHAR(250)         null,
   icon_image           VARCHAR(250)         null,
   icon_sys_code        VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   constraint PK_SYS_ICONS_CD primary key (icon_code)
);

comment on table sys_icons_cd is
'ALL icons in the system';

/*==============================================================*/
/* Table: sys_invoice_type_cd                                   */
/*==============================================================*/
create table sys_invoice_type_cd (
   invoice_type_id      VARCHAR(30)          not null,
   invoice_type_name    VARCHAR(250)         null,
   invoice_type_name2   VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   invoice_type_color1  VARCHAR(60)          null,
   invoice_type_color2  VARCHAR(60)          null,
   invoice_type_color3  VARCHAR(60)          null,
   invoice_type_icon    VARCHAR(120)         null,
   invoice_type_image   VARCHAR(120)         null,
   constraint PK_SYS_INVOICE_TYPE_CD primary key (invoice_type_id)
);

/*==============================================================*/
/* Table: sys_item_fabric_type_cd                               */
/*==============================================================*/
create table sys_item_fabric_type_cd (
   fabric_type_id       VARCHAR(120)         not null,
   fabric_type_name     VARCHAR(250)         null,
   fabric_type_name2    VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   fabric_type_color1   VARCHAR(60)          null,
   fabric_type_color2   VARCHAR(60)          null,
   fabric_type_color3   VARCHAR(60)          null,
   fabric_type_icon     VARCHAR(120)         null,
   fabric_type_image    VARCHAR(120)         null,
   constraint PK_SYS_ITEM_FABRIC_TYPE_CD primary key (fabric_type_id)
);

/*==============================================================*/
/* Table: sys_item_notes_cd                                     */
/*==============================================================*/
create table sys_item_notes_cd (
   item_note_id         TEXT                 not null,
   item_note_ctg_id     TEXT                 not null,
   item_note_code       TEXT                 not null,
   item_note_name       TEXT                 null,
   item_note_name2      TEXT                 null,
   is_per_item_or_order SMALLINT             null default '1',
   is_color_note        BOOLEAN              null default 'FALSE',
   item_note_desc       TEXT                 null,
   color_note_rgb       TEXT                 null,
   show_in_order_quick_bar BOOLEAN              null default 'true',
   show_in_all_stages   BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            VARCHAR(1000)        null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_SYS_ITEM_NOTES_CD primary key (item_note_id),
   constraint AK_KEY_2_SYS_ITEM unique (item_note_ctg_id, item_note_code)
);

comment on table sys_item_notes_cd is
'item Notes coding';

comment on column sys_item_notes_cd.is_per_item_or_order is
'1=PER ITEM ONLY, 2=PER ORDER, 3=ANYWHERE';

/*==============================================================*/
/* Table: sys_item_notes_ctg_cd                                 */
/*==============================================================*/
create table sys_item_notes_ctg_cd (
   item_note_ctg_id     TEXT                 not null,
   item_note_ctg_code   TEXT                 not null,
   item_note_ctg_name   TEXT                 null,
   item_note_ctg_name2  TEXT                 null,
   item_note_ctg_desc   TEXT                 null,
   is_color_note        BOOLEAN              null default 'FALSE',
   is_per_item_or_order SMALLINT             null default '1',
   show_in_quick_bar    BOOLEAN              null default 'true',
   show_in_all_stages   BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            VARCHAR(1000)        null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_SYS_ITEM_NOTES_CTG_CD primary key (item_note_ctg_id)
);

comment on table sys_item_notes_ctg_cd is
'item Notes Categories';

comment on column sys_item_notes_ctg_cd.is_per_item_or_order is
'1=PER ITEM ONLY, 2=PER ORDER, 3=ANYWHERE';

/*==============================================================*/
/* Table: sys_item_stain_type_cd                                */
/*==============================================================*/
create table sys_item_stain_type_cd (
   stain_type_id        VARCHAR(120)         not null,
   stain_type_name      VARCHAR(250)         null,
   stain_type_name2     VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   stain_type_color1    VARCHAR(60)          null,
   stain_type_color2    VARCHAR(60)          null,
   stain_type_color3    VARCHAR(60)          null,
   stain_type_icon      VARCHAR(120)         null,
   stain_type_image     VARCHAR(120)         null,
   constraint PK_SYS_ITEM_STAIN_TYPE_CD primary key (stain_type_id)
);

/*==============================================================*/
/* Table: sys_item_type_cd                                      */
/*==============================================================*/
create table sys_item_type_cd (
   item_type_code       VARCHAR(60)          not null,
   item_type_name       VARCHAR(250)         null,
   item_type_name2      VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   item_type_color1     VARCHAR(60)          null,
   item_type_color2     VARCHAR(60)          null,
   item_type_color3     VARCHAR(60)          null,
   item_type_icon       VARCHAR(120)         null,
   item_type_image      VARCHAR(120)         null,
   constraint PK_SYS_ITEM_TYPE_CD primary key (item_type_code)
);

/*==============================================================*/
/* Table: sys_order_status_cd                                   */
/*==============================================================*/
create table sys_order_status_cd (
   order_status_code    VARCHAR(30)          not null,
   order_status_name    VARCHAR(250)         null,
   order_status_name2   VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   next_order_status_code VARCHAR(30)          null,
   reject_order_status_code2 VARCHAR(30)          null,
   order_status_color1  VARCHAR(60)          null,
   order_status_color2  VARCHAR(60)          null,
   order_status_color3  VARCHAR(60)          null,
   order_status_icon    VARCHAR(120)         null,
   order_status_image   VARCHAR(120)         null,
   constraint PK_SYS_ORDER_STATUS_CD primary key (order_status_code)
);

comment on table sys_order_status_cd is
'order_status';

/*==============================================================*/
/* Table: sys_order_type_cd                                     */
/*==============================================================*/
create table sys_order_type_cd (
   order_type_id        VARCHAR(30)          not null,
   order_type_name      VARCHAR(250)         null,
   order_type_name2     VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   order_type_color1    VARCHAR(60)          null,
   order_type_color2    VARCHAR(60)          null,
   order_type_color3    VARCHAR(60)          null,
   order_type_icon      VARCHAR(120)         null,
   order_type_image     VARCHAR(120)         null,
   constraint PK_SYS_ORDER_TYPE_CD primary key (order_type_id)
);

/*==============================================================*/
/* Table: sys_org_type_cd                                       */
/*==============================================================*/
create table sys_org_type_cd (
   tenant_type_id       VARCHAR(30)          not null,
   tenant_type_name     VARCHAR(250)         null,
   tenant_type_name2    VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   tenant_type_color1   VARCHAR(60)          null,
   tenant_type_color2   VARCHAR(60)          null,
   tenant_type_color3   VARCHAR(60)          null,
   tenant_type_icon     VARCHAR(120)         null,
   tenant_type_image    VARCHAR(120)         null,
   constraint PK_SYS_ORG_TYPE_CD primary key (tenant_type_id)
);

/*==============================================================*/
/* Table: sys_payment_method_cd                                 */
/*==============================================================*/
create table sys_payment_method_cd (
   payment_method_code  VARCHAR(30)          not null,
   payment_method_name  VARCHAR(250)         null,
   payment_method_name2 VARCHAR(250)         null,
   is_enabled           BOOLEAN              not null default 'false',
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   payment_type_color1  VARCHAR(60)          null,
   payment_type_color2  VARCHAR(60)          null,
   payment_type_color3  VARCHAR(60)          null,
   payment_type_icon    VARCHAR(120)         null,
   payment_type_image   VARCHAR(120)         null,
   constraint PK_SYS_PAYMENT_METHOD_CD primary key (payment_method_code)
);

comment on table sys_payment_method_cd is
'ALL payment_methods in the system: Pay on collect, cash, card, paymet gateways...';

/*==============================================================*/
/* Table: sys_payment_type_cd                                   */
/*==============================================================*/
create table sys_payment_type_cd (
   payment_type_id      VARCHAR(30)          not null,
   payment_type_name    VARCHAR(250)         null,
   payment_type_name2   VARCHAR(250)         null,
   is_enabled           BOOLEAN              not null default 'false',
   has_plan             BOOLEAN              not null default 'false',
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   payment_type_color1  VARCHAR(60)          null,
   payment_type_color2  VARCHAR(60)          null,
   payment_type_color3  VARCHAR(60)          null,
   payment_type_icon    VARCHAR(120)         null,
   payment_type_image   VARCHAR(120)         null,
   constraint PK_SYS_PAYMENT_TYPE_CD primary key (payment_type_id)
);

comment on table sys_payment_type_cd is
'Payment type such as: Pay In Advance, Pay on Collect, Pay on Delivery, Pay on Pickup';

comment on column sys_payment_type_cd.is_enabled is
'such as Pay on Delivery, Pay on Pickup should be false';

comment on column sys_payment_type_cd.has_plan is
'such as Pay on Delivery, Pay on Pickup should be true';

/*==============================================================*/
/* Table: sys_plan_features_cf                                  */
/*==============================================================*/
create table sys_plan_features_cf (
   feature_code         VARCHAR(60)          not null,
   id                   UUID                 not null default 'gen_random_uuid()',
   s_plan_code          VARCHAR(60)          not null,
   is_enabled           INTEGER              not null default '1',
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   constraint PK_SYS_PLAN_FEATURES_CF primary key (id, feature_code, s_plan_code)
);

/*==============================================================*/
/* Table: sys_plan_limits_cd                                    */
/*==============================================================*/
create table sys_plan_limits_cd (
   limit_code           VARCHAR(60)          not null,
   limit_name           VARCHAR(250)         null,
   limit_name2          VARCHAR(250)         null,
   limit_value_datatype VARCHAR(60)          null default 'TEXT',
   limit_default_value_j JSONB                null,
   limit_default_value_num FLOAT                null,
   limit_default_value_bool BOOLEAN              null,
   limit_default_value_char VARCHAR(600)         null,
   limit_default_value_date DATE                 null,
   is_active            BOOLEAN              not null default 'TRUE',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   constraint PK_SYS_PLAN_LIMITS_CD primary key (limit_code)
);

comment on table sys_plan_limits_cd is
'plan_limits_cd coding of plans limits:
"code": "orders.monthly",
      "name": "Monthly Orders",
Then in plan_limits_cf WILL BE:
      "values": {
        "freemium": 100,
        "basic": 1000,
        "pro": 5000,
        "enterprise": -1
      }';

comment on column sys_plan_limits_cd.limit_default_value_num is
'If value 0 mean not available , If -1 means open unlimited
"values": {
        "freemium": 100,
        "basic": 1000,
        "pro": 5000,
        "enterprise": -1
      }';

/*==============================================================*/
/* Table: sys_plan_limits_cf                                    */
/*==============================================================*/
create table sys_plan_limits_cf (
   limit_code           VARCHAR(60)          null,
   limit_desc           VARCHAR(250)         null,
   id                   UUID                 null default 'gen_random_uuid()',
   limit_value_datatype VARCHAR(60)          null,
   plan_limit_value_j   JSONB                null,
   plan_limit_value_num FLOAT                null,
   plan_limit_value_bool BOOLEAN              null,
   plan_limit_value_char VARCHAR(600)         null,
   plan_limit_value_date DATE                 null
      constraint CKC_PLAN_LIMIT_VALUE__SYS_PLAN check (plan_limit_value_date is null or (GENERATED ALWAYS AS (
        CASE
            WHEN value_type = 'date' AND value IS NOT NULL THEN value::text::date
            ELSE NULL
        END
    ) STORED,)),
   is_active            BOOLEAN              not null default 'TRUE',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMPZ           null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMPZ           null
);

comment on table sys_plan_limits_cf is
'"code": "orders.monthly",
      "name": "Monthly Orders",
      "values": {
        "freemium": 100,
        "basic": 1000,
        "pro": 5000,
        "enterprise": -1
      }';

comment on column sys_plan_limits_cf.plan_limit_value_num is
'If value 0 mean not available , If -1 means open unlimited
"values": {
        "freemium": 100,
        "basic": 1000,
        "pro": 5000,
        "enterprise": -1
      }';

/*==============================================================*/
/* Table: sys_pln_subscription_plans_mst                        */
/*==============================================================*/
create table sys_pln_subscription_plans_mst (
   id                   UUID                 not null default 'gen_random_uuid()',
   plan_code            VARCHAR(60)          not null,
   plan_name            VARCHAR(250)         null,
   plan_name2           VARCHAR(250)         null,
   plan_desc            VARCHAR(600)         null,
   price                NUMBER(10,3)         null,
   currency_code        VARCHAR(10)          null,
   "interval"           VARCHAR(30)          null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   constraint PK_SYS_PLN_SUBSCRIPTION_PLANS_ primary key (id)
);

comment on table sys_pln_subscription_plans_mst is
'ALL Plans in the system:, freemium, basi, pro, plus, enterprise
';

comment on column sys_pln_subscription_plans_mst."interval" is
'month,year,week,day';

/*==============================================================*/
/* Table: sys_preference_ctg_cd                                 */
/*==============================================================*/
create table sys_preference_ctg_cd (
   preference_ctg_id    TEXT                 not null,
   preference_ctg_code  TEXT                 not null,
   preference_ctg_name  TEXT                 null,
   preference_ctg_name2 TEXT                 null,
   preference_ctg_desc  TEXT                 null,
   is_per_item_or_order SMALLINT             null default '1',
   is_color             BOOLEAN              null default 'FALSE',
   show_in_quick_bar    BOOLEAN              null default 'true',
   show_in_all_stages   BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            VARCHAR(1000)        null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_SYS_PREFERENCE_CTG_CD primary key (preference_ctg_id)
);

comment on table sys_preference_ctg_cd is
'Preference Categories';

comment on column sys_preference_ctg_cd.is_per_item_or_order is
'1=PER ITEM ONLY, 2=PER ORDER, 3=ANYWHERE';

/*==============================================================*/
/* Table: sys_preference_options_cd                             */
/*==============================================================*/
create table sys_preference_options_cd (
   preference_option_id TEXT                 not null,
   preference_ctg_id    TEXT                 not null,
   preference_option_code TEXT                 not null,
   preference_option_name TEXT                 null,
   preference_option_name2 TEXT                 null,
   preference_ctg_desc  TEXT                 null,
   is_per_item_or_order SMALLINT             null default '1',
   is_color             BOOLEAN              null default 'FALSE',
   option_color_rgb     TEXT                 null,
   show_in_quick_bar    BOOLEAN              null default 'true',
   show_in_all_stages   BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            VARCHAR(1000)        null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           VARCHAR(120)         null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           VARCHAR(120)         null,
   updated_info         TEXT                 null,
   constraint PK_SYS_PREFERENCE_OPTIONS_CD primary key (preference_option_id),
   constraint AK_KEY_2_SYS_PREF unique (preference_ctg_id, preference_option_code)
);

comment on table sys_preference_options_cd is
'Preference Categories Options';

comment on column sys_preference_options_cd.is_per_item_or_order is
'1=PER ITEM ONLY, 2=PER ORDER, 3=ANYWHERE';

/*==============================================================*/
/* Table: sys_priority_cd                                       */
/*==============================================================*/
create table sys_priority_cd (
   priority_code        VARCHAR(120)         not null,
   priority_name        VARCHAR(250)         null,
   priority_name2       VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   priority_color1      VARCHAR(60)          null,
   priority_color2      VARCHAR(60)          null,
   priority_color3      VARCHAR(60)          null,
   priority_icon        VARCHAR(120)         null,
   priority_image       VARCHAR(120)         null,
   constraint PK_SYS_PRIORITY_CD primary key (priority_code)
);

comment on table sys_priority_cd is
'priority code';

/*==============================================================*/
/* Table: sys_product_unit_cd                                   */
/*==============================================================*/
create table sys_product_unit_cd (
   unit_code            VARCHAR(60)          not null,
   unit_name            VARCHAR(250)         null,
   unit_name2           VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   constraint PK_SYS_PRODUCT_UNIT_CD primary key (unit_code)
);

comment on table sys_product_unit_cd is
'default Measurment Units';

/*==============================================================*/
/* Table: sys_service_category_cd                               */
/*==============================================================*/
create table sys_service_category_cd (
   service_category_code VARCHAR(120)         not null,
   ctg_name             VARCHAR(250)         not null,
   ctg_name2            VARCHAR(250)         null,
   ctg_desc             VARCHAR(600)         null,
   turnaround_hh        NUMERIC(4, 2)        null,
   turnaround_hh_express NUMERIC(4, 2)        null,
   multiplier_express   NUMERIC(4, 2)        null,
   is_builtin           BOOLEAN              not null default 'false',
   has_fee              BOOLEAN              not null default 'false',
   is_mandatory         BOOLEAN              not null default 'false',
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   service_category_color1 VARCHAR(60)          null,
   service_category_color2 VARCHAR(60)          null,
   service_category_color3 VARCHAR(60)          null,
   service_category_icon VARCHAR(120)         null,
   service_category_image VARCHAR(120)         null,
   rec_order            INTEGER              null default '1',
   rec_status           SMALLINT             null default '1',
   constraint PK_SYS_SERVICE_CATEGORY_CD primary key (service_category_code)
);

comment on table sys_service_category_cd is
'ALL Main Services Categories/Sections FIXED BY us:DRY_CLEAN, LAUNDRY, WASH_AND_IRON, IRON_ONLY, REPAIRS, ALTERATION, RETAIL_ITEMS';

comment on column sys_service_category_cd.ctg_desc is
'description';

/*==============================================================*/
/* Table: sys_service_prod_templates_cd                         */
/*==============================================================*/
create table sys_service_prod_templates_cd (
   product_code         TEXT                 not null,
   service_category_code TEXT                 null,
   product_name         TEXT                 null,
   product_name2        TEXT                 null,
   hint_text            TEXT                 null,
   is_retail_item       BOOLEAN              null default 'false',
   product_group1       TEXT                 null,
   product_group2       TEXT                 null,
   product_group3       TEXT                 null,
   product_type         INTEGER              null,
   price_type           TEXT                 null,
   product_unit         VARCHAR(60)          null,
   default_sell_price   NUMERIC(10, 3)       null,
   default_express_sell_price NUMERIC(10, 3)       null,
   product_cost         NUMERIC(10, 3)       null,
   min_sell_price       NUMERIC(10, 3)       null,
   min_quantity         INTEGER              null,
   pieces_per_product   INTEGER              null,
   extra_days           INTEGER              null,
   turnaround_hh        NUMERIC(4, 2)        null,
   turnaround_hh_express NUMERIC(4, 2)        null,
   multiplier_express   NUMERIC(4, 2)        null,
   product_order        INTEGER              null,
   is_tax_exempt        INTEGER              null,
   id_sku               TEXT                 null,
   tags                 JSON                 null,
   is_to_seed           BOOLEAN              null default 'true',
   is_active            BOOLEAN              not null default 'true',
   rec_order            INTEGER              null,
   service_category_color1 TEXT                 null,
   service_category_color2 TEXT                 null,
   service_category_color3 TEXT                 null,
   service_category_icon TEXT                 null,
   service_category_image TEXT                 null,
   rec_notes            TEXT                 null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   created_by           TEXT                 null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           TEXT                 null,
   updated_info         TEXT                 null,
   constraint PK_SYS_SERVICE_PROD_TEMPLATES_ primary key (product_code)
);

comment on table sys_service_prod_templates_cd is
'List of all products/items template for data seed, table name was sys_products_init_data_mst, products_template_data_mst_init';

comment on column sys_service_prod_templates_cd.product_type is
'This for use in the programming:
Product Type:
Normal
Weight
Price per square meter / feet
';

comment on column sys_service_prod_templates_cd.price_type is
'per_piece, per_wight';

comment on column sys_service_prod_templates_cd.product_cost is
'For Initial cost if exist such as if external services providers';

comment on column sys_service_prod_templates_cd.min_sell_price is
'This if want to not go less than this price even if there is discounts or offers or packages.';

comment on column sys_service_prod_templates_cd.pieces_per_product is
'such as suite have 2 pieces and null=1';

comment on column sys_service_prod_templates_cd.extra_days is
'the value of this will added to the order ready by date and null=0';

comment on column sys_service_prod_templates_cd.turnaround_hh is
'Ready By';

comment on column sys_service_prod_templates_cd.product_order is
'Order by in the view';

comment on column sys_service_prod_templates_cd.id_sku is
'Stock-Keeping Unit ID for integrating with inventory ';

comment on column sys_service_prod_templates_cd.tags is
'example "tags": ["women", "specialty", "formal"]';

/*==============================================================*/
/* Table: sys_service_type_cd                                   */
/*==============================================================*/
create table sys_service_type_cd (
   service_type_id      VARCHAR(120)         not null,
   service_type_name    VARCHAR(250)         null,
   service_type_name2   VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   service_type_color1  VARCHAR(60)          null,
   service_type_color2  VARCHAR(60)          null,
   service_type_color3  VARCHAR(60)          null,
   service_type_icon    VARCHAR(120)         null,
   service_type_image   VARCHAR(120)         null,
   constraint PK_SYS_SERVICE_TYPE_CD primary key (service_type_id)
);

/*==============================================================*/
/* Table: sys_main_business_type_cd                            */
/*==============================================================*/
create table sys_main_business_type_cd (
   id                   UUID                 not null default 'gen_random_uuid()',
   name                 TEXT                 not null,
   name2                TEXT                 null,
   "desc"               TEXT                 null,
   desc2                TEXT                 null,
   is_active            BOOLEAN              null default 'true',
   rec_order            INTEGER              null,
   rec_notes            TEXT                 null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           TEXT                 null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           TEXT                 null,
   updated_info         TEXT                 null,
   constraint PK_sys_main_business_type_cd primary key (id)
);

comment on table sys_main_business_type_cd is
'organization/tenants categories, such as small laundry, medium dry-clean, mini-shop,...so on';

/*==============================================================*/
/* Table: sys_tenant_settings_cd                                */
/*==============================================================*/
create table sys_tenant_settings_cd (
   setting_code         TEXT                 not null,
   setting_name         TEXT                 null,
   setting_name2        TEXT                 null,
   setting_desc         TEXT                 null,
   setting_value_type   TEXT                 null,
   setting_value        TEXT                 null,
   is_for_tenants_org   BOOLEAN              null default 'true',
   is_active            BOOLEAN              null default 'true',
   is_per_tenant_org_id BOOLEAN              null default 'true',
   is_per_branch_id     BOOLEAN              null default 'false',
   is_per_user_id       BOOLEAN              null default 'false',
   rec_order            INTEGER              null,
   rec_notes            TEXT                 null,
   rec_status           SMALLINT             null default '1',
   created_at           TIMESTAMP            not null default CURRENT_TIMESTAMP,
   created_by           TEXT                 null,
   created_info         TEXT                 null,
   updated_at           TIMESTAMP            null,
   updated_by           TEXT                 null,
   updated_info         TEXT                 null,
   constraint PK_SYS_TENANT_SETTINGS_CD primary key (setting_code)
);

/*==============================================================*/
/* Table: sys_user_type_cd                                      */
/*==============================================================*/
create table sys_user_type_cd (
   user_type_id         VARCHAR(30)          not null,
   user_type_name       VARCHAR(250)         null,
   user_type_name2      VARCHAR(250)         null,
   is_active            BOOLEAN              not null default 'true',
   rec_notes            VARCHAR(200)         null,
   created_at           TIMESTAMP            null default CURRENT_TIMESTAMP,
   updated_at           TIMESTAMP            null,
   constraint PK_SYS_USER_TYPE_CD primary key (user_type_id)
);

/*==============================================================*/
/* Table: system_settings                                       */
/*==============================================================*/
create table system_settings (
   Column_1             TEXT                 null
);

alter table org_branches_mst
   add constraint FK_ORG_BRAN_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_customers_mst
   add constraint FK_ORG_CUST_REFERENCE_SYS_CUST foreign key (customer_id)
      references sys_customers_mst (id)
      on delete restrict on update restrict;

alter table org_customers_mst
   add constraint FK_ORG_CUST_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_delivery_routes
   add constraint FK_ORG_DELI_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_invoice_mst
   add constraint FK_ORG_INVO_REFERENCE_ORG_ORDE foreign key (order_id)
      references org_orders_mst (id)
      on delete cascade on update restrict;

alter table org_invoice_mst
   add constraint FK_ORG_INVO_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete cascade on update restrict;

alter table org_item_notes_cf
   add constraint FK_ORG_ITEM_REFERENCE_ORG_ITEM foreign key (item_note_ctg_id)
      references org_item_notes_ctg_cf (id)
      on delete restrict on update restrict;

alter table org_item_notes_ctg_cf
   add constraint FK_ORG_ITEM_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_loyalty_programs
   add constraint FK_ORG_LOYA_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_order_item_notes_dtl
   add constraint FK_ORG_ORDE_REFERENCE_ORG_ORDE foreign key (order_item_id)
      references org_order_items_dtl (id)
      on delete restrict on update restrict;

alter table org_order_item_notes_dtl
   add constraint FK_ORG_ORDE_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_order_item_notes_dtl
   add constraint FK_ORG_ORDE_REFERENCE_ORG_ITEM foreign key (item_note_id)
      references org_item_notes_cf (id)
      on delete restrict on update restrict;

alter table org_order_item_pieces
   add constraint FK_ORG_ORDE_REFERENCE_ORG_ORDE foreign key (order_id2)
      references org_order_items_dtl (id)
      on delete restrict on update restrict;

alter table org_order_item_preferences_d
   add constraint FK_ORG_ORDE_REFERENCE_ORG_ORDE foreign key (order_item_id)
      references org_order_items_dtl (id)
      on delete restrict on update restrict;

alter table org_order_item_preferences_d
   add constraint FK_TENANT_REFERENCE_OPTIONS foreign key (option_id)
      references org_preference_options_cf (id)
      on delete restrict on update restrict;

alter table org_order_item_preferences_d
   add constraint FK_TENANT_ORDER_ITEM_PRFRNC_CTG foreign key (preference_ctg_id)
      references org_preference_ctg_cf (id)
      on delete restrict on update restrict;

alter table org_order_items_dtl
   add constraint FK_ORG_ORDE_REFERENCE_ORG_SERV foreign key (tenant_org_id, service_category_code)
      references org_service_category_cf (tenant_org_id, service_category_code)
      on delete restrict on update restrict;

alter table org_order_items_dtl
   add constraint FK_ORG_ORDE_REFERENCE_ORG_PROD foreign key (product_id)
      references org_product_data_mst (id)
      on delete restrict on update restrict;

alter table org_order_items_dtl
   add constraint FK_ORG_ORDE_REFERENCE_ORG_ORDE foreign key (order_id)
      references org_orders_mst (id)
      on delete cascade on update restrict;

alter table org_orders_mst
   add constraint FK_ORG_ORDE_REFERENCE_SYS_ORDE foreign key (order_type_id)
      references sys_order_type_cd (order_type_id)
      on delete restrict on update restrict;

alter table org_orders_mst
   add constraint FK_ORG_ORDE_REFERENCE_ORG_BRAN foreign key (branch_id, tenant_org_id)
      references org_branches_mst (id, tenant_org_id)
      on delete restrict on update restrict;

alter table org_orders_mst
   add constraint FK_ORG_ORDE_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete cascade on update restrict;

alter table org_orders_mst
   add constraint FK_ORG_ORDE_REFERENCE_ORG_CUST foreign key (customer_id)
      references org_customers_mst (id)
      on delete restrict on update restrict;

alter table org_payments_dtl_tr
   add constraint FK_ORG_PAYM_REFERENCE_ORG_INVO foreign key (invoice_id)
      references org_invoice_mst (id)
      on delete cascade on update restrict;

alter table org_payments_dtl_tr
   add constraint FK_ORG_PAYM_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete cascade on update restrict;

alter table org_preference_ctg_cf
   add constraint FK_ORG_PREF_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_preference_options_cf
   add constraint FK_ORG_PREF_REFERENCE_ORG_PREF foreign key (preference_ctg_id)
      references org_preference_ctg_cf (id)
      on delete restrict on update restrict;

alter table org_price_lists_dtl
   add constraint FK_ORG_PRIC_REFERENCE_ORG_PROD foreign key (product_id)
      references org_product_data_mst (id)
      on delete restrict on update restrict;

alter table org_price_lists_dtl
   add constraint FK_ORG_PRIC_REFERENCE_ORG_PRIC foreign key (price_list_id)
      references org_price_lists_mst (id)
      on delete restrict on update restrict;

alter table org_price_lists_dtl
   add constraint FK_ORG_PRIC_REFERENCE_SYS_CURR foreign key (currency_code)
      references sys_currency_cd (currency_code)
      on delete restrict on update restrict;

alter table org_price_lists_mst
   add constraint FK_ORG_PRIC_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_product_data_mst
   add constraint FK_ORG_PROD_REFERENCE_ORG_SERV foreign key (tenant_org_id, service_category_code)
      references org_service_category_cf (tenant_org_id, service_category_code)
      on delete restrict on update restrict;

alter table org_product_data_mst
   add constraint FK_ORG_PROD_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_product_unit_cd
   add constraint FK_ORG_PROD_REFERENCE_ORG_TENA foreign key (id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_service_category_cf
   add constraint FK_ORG_SERV_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_service_category_cf
   add constraint FK_ORG_SERV_REFERENCE_SYS_SERV foreign key (service_category_code)
      references sys_service_category_cd (service_category_code)
      on delete restrict on update restrict;

alter table org_subscriptions_mst
   add constraint FK_ORG_SUBS_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete cascade on update restrict;

alter table org_tenant_settings_cf
   add constraint FK_ORG_TENA_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_user_branches_dtl
   add constraint FK_ORG_USER_REFERENCE_ORG_USER foreign key (user_id)
      references org_users_mst (id)
      on delete restrict on update restrict;

alter table org_user_branches_dtl
   add constraint FK_ORG_USER_REFERENCE_ORG_BRAN foreign key (branch_id, tenant_org_id)
      references org_branches_mst (id, tenant_org_id)
      on delete restrict on update restrict;

alter table org_users_mst
   add constraint FK_ORG_USER_REFERENCE_ORG_TENA foreign key (tenant_org_id)
      references org_tenants_mst (id)
      on delete restrict on update restrict;

alter table org_users_mst
   add constraint FK_ORG_USER_REFERENCE_ORG_BRAN foreign key (def_branch_id, tenant_org_id)
      references org_branches_mst (id, tenant_org_id)
      on delete restrict on update restrict;

alter table sys_item_notes_cd
   add constraint FK_SYS_ITEM_REFERENCE_SYS_ITEM foreign key (item_note_ctg_id)
      references sys_item_notes_ctg_cd (item_note_ctg_id)
      on delete restrict on update restrict;

alter table sys_plan_features_cf
   add constraint FK_SYS_PLAN_REFERENCE_SYS_FEAT foreign key (feature_code)
      references sys_features_code_cd (feature_code)
      on delete restrict on update restrict;

alter table sys_plan_features_cf
   add constraint FK_SYS_PLAN_REFERENCE_SYS_PLN_ foreign key (id)
      references sys_pln_subscription_plans_mst (id)
      on delete restrict on update restrict;

alter table sys_plan_limits_cf
   add constraint FK_SYS_PLAN_REFERENCE_SYS_PLN_ foreign key (id)
      references sys_pln_subscription_plans_mst (id)
      on delete restrict on update restrict;

alter table sys_plan_limits_cf
   add constraint FK_SYS_PLAN_REFERENCE_SYS_PLAN foreign key (limit_code)
      references sys_plan_limits_cd (limit_code)
      on delete restrict on update restrict;

alter table sys_pln_subscription_plans_mst
   add constraint FK_SYS_PLN__REFERENCE_SYS_CURR foreign key (currency_code)
      references sys_currency_cd (currency_code)
      on delete restrict on update restrict;

alter table sys_preference_options_cd
   add constraint FK_SYS_PREF_REFERENCE_SYS_PREF foreign key (preference_ctg_id)
      references sys_preference_ctg_cd (preference_ctg_id)
      on delete restrict on update restrict;

alter table sys_service_prod_templates_cd
   add constraint FK_SYS_SERV_REFERENCE_SYS_SERV foreign key (service_category_code)
      references sys_service_category_cd (service_category_code)
      on delete restrict on update restrict;

alter table sys_service_prod_templates_cd
   add constraint FK_SYS_SERV_REFERENCE_SYS_PROD foreign key (product_unit)
      references sys_product_unit_cd (unit_code)
      on delete restrict on update restrict;

