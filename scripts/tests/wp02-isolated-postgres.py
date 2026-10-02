#!/usr/bin/env python3
"""Prove WP02 PostgreSQL behavior in a newly owned, disconnected PG17 container.

Run from any directory: python scripts/tests/wp02-isolated-postgres.py
No URL, host, port, dotenv file, existing container or migration runner is accepted.
Reviewed object definitions are extracted verbatim, without migration wrappers or
history tracking, and compiled against a deliberately minimal synthetic baseline.
Every fixture write is confined to the disposable container; production/Supabase
data, platform membership policies and future Apply services are not exercised.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid


ROOT = Path(__file__).resolve().parents[2]
SOURCES = [ROOT / "supabase/migrations" / name for name in (
    "0547_wp02_order_change_foundation.sql", "0548_wp02_order_change_history.sql"
)]
TENANT = "00000000-0000-4000-8000-000000000001"
OTHER_TENANT = "00000000-0000-4000-8000-000000000002"
ACTOR = "00000000-0000-4000-8000-000000000003"
ORDER = "00000000-0000-4000-8000-000000000004"
OTHER_ORDER = "00000000-0000-4000-8000-000000000005"
DEST_ORDER = "00000000-0000-4000-8000-000000000006"
TABLES = ("org_order_items_dtl", "org_order_item_pieces_dtl", "org_order_preferences_dtl")
HISTORY = ("org_order_changes_mst", "org_order_change_ops_dtl")


def split_sql(source: str) -> list[str]:
    """Keep source bytes intact while recognizing semicolons outside SQL quoting."""
    result, start, offset = [], 0, 0
    quote = None
    while offset < len(source):
        if quote == "--":
            if source[offset] == "\n":
                quote = None
        elif quote == "/*":
            if source.startswith("*/", offset):
                quote = None
                offset += 1
        elif quote in ("'", '"'):
            if source[offset] == quote:
                if source.startswith(quote * 2, offset):
                    offset += 1
                else:
                    quote = None
        elif quote:
            if source.startswith(quote, offset):
                offset += len(quote) - 1
                quote = None
        elif source.startswith("--", offset):
            quote = "--"
            offset += 1
        elif source.startswith("/*", offset):
            quote = "/*"
            offset += 1
        elif source[offset] in ("'", '"'):
            quote = source[offset]
        elif source[offset] == "$":
            tag = re.match(r"\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$", source[offset:])
            if tag:
                quote = tag.group()
                offset += len(quote) - 1
        elif source[offset] == ";":
            result.append(source[start:offset + 1])
            start = offset + 1
        offset += 1
    if quote not in (None, "--"):
        raise ValueError("Unterminated SQL quote/comment")
    if re.sub(r"--[^\n]*", "", source[start:]).strip():
        raise ValueError("Unterminated SQL statement")
    return result


def object_definitions() -> tuple[str, list[dict[str, object]]]:
    """Allow only reviewed object DDL/comments/ACLs; never execute migration files."""
    definitions, manifest = [], []
    for path in SOURCES:
        raw = path.read_bytes()
        selected = []
        for statement in split_sql(raw.decode("utf-8-sig")):
            head = re.sub(r"(?m)^\s*--[^\n]*", "", statement).strip()
            if re.match(r"^(BEGIN;|COMMIT;|SET LOCAL )", head):
                continue
            if not re.match(r"^(ALTER TABLE |CREATE (TABLE|INDEX|FUNCTION|TRIGGER) |COMMENT ON |REVOKE |GRANT )", head):
                raise ValueError(f"Not an allowlisted object definition in {path.name}")
            selected.append(statement)
        definitions.extend(selected)
        manifest.append({"source": str(path.relative_to(ROOT)).replace("\\", "/"),
                         "sha256": hashlib.sha256(raw).hexdigest(),
                         "verbatim_object_statements": len(selected),
                         "definitions_sha256": hashlib.sha256("\n".join(selected).encode()).hexdigest()})
    return "\n".join(definitions), manifest


def baseline() -> str:
    """Supply only prerequisites needed to compile/test exact WP02 objects."""
    # No Supabase Auth impersonation is claimed; these local roles reproduce only
    # the observed role attributes relevant to table ACL and BYPASSRLS behavior.
    sql = """
    -- Unlike PostgreSQL's protected bootstrap account, this runtime owner is
    -- deliberately non-superuser to match the verified Supabase postgres role.
    CREATE ROLE postgres LOGIN BYPASSRLS;
    COMMENT ON ROLE postgres IS 'Isolated non-superuser BYPASSRLS owner matching deployed runtime attributes.';
    -- Local synthetic roles exercise history ACLs without external credentials.
    CREATE ROLE anon NOLOGIN;
    COMMENT ON ROLE anon IS 'Isolated fixture anonymous role; no external identity.';
    CREATE ROLE authenticated NOLOGIN;
    COMMENT ON ROLE authenticated IS 'Isolated fixture authenticated role; no JWT/session claim.';
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    COMMENT ON ROLE service_role IS 'Isolated fixture server role reproducing observed BYPASSRLS.';
    COMMENT ON ROLE fx_bootstrap IS 'Container-only bootstrap administration; excluded from runtime behavior tests.';
    -- Minimal actor authority substitutes identity only, not Auth behavior.
    CREATE SCHEMA auth;
    COMMENT ON SCHEMA auth IS 'Isolated UUID actor fixture, not Supabase Auth.';
    """
    specs = [
        ("auth.users", "fx_actor_pk", [("id", "UUID NOT NULL", "Synthetic authenticated actor UUID.")], ""),
        ("public.org_tenants_mst", "fx_tenant_pk", [("id", "UUID NOT NULL", "Synthetic tenant UUID.")], ""),
        ("public.sys_currency_cd", "fx_currency_pk", [("code", "TEXT NOT NULL", "Explicit fixture currency; no locale default.")], ""),
        ("public.org_orders_mst", "fx_order_pk", [
            ("id", "UUID NOT NULL", "Stable synthetic order identity."),
            ("tenant_org_id", "UUID NOT NULL", "Explicit synthetic tenant ownership."),
            ("state_version", "INTEGER NOT NULL DEFAULT 1", "Workflow counter remains separate from commercial revision.")
        ], "CONSTRAINT fx_order_identity_uq UNIQUE (id, tenant_org_id)"),
    ]
    for table, tag in zip(TABLES, ("item", "piece", "pref")):
        columns = [
            ("id", "UUID NOT NULL", "Stable synthetic structure UUID."),
            ("tenant_org_id", "UUID NOT NULL", "Explicit synthetic tenant ownership."),
            ("order_id", "UUID NOT NULL", "Mutable current parent order for identity/reparent tests."),
            ("rec_status", "SMALLINT DEFAULT 1", "1=active, 0=removed; NULL retains legacy uncertainty."),
        ]
        if tag != "item":
            columns.append(("order_item_id", "UUID NULL", "Optional synthetic parent item; full live hierarchy is outside this harness."))
        if tag == "pref":
            columns += [("order_item_piece_id", "UUID NULL", "Optional synthetic piece parent."),
                        ("prefs_level", "TEXT NOT NULL DEFAULT 'ORDER'", "Fixture-only scope default; does not represent a proposed domain change.")]
        columns.append(("fixture_amount", "NUMERIC(10,3)" if tag == "item" else "NUMERIC(19,4)", "Synthetic money illustrates the unchanged legacy scale; no pricing calculation."))
        specs.append((f"public.{table}", f"fx_{tag}_pk", columns,
                      "CONSTRAINT fx_item_identity_uq UNIQUE (id, tenant_org_id)" if tag == "item" else ""))
    for table, pk, columns, extra in specs:
        key = "code" if table.endswith("sys_currency_cd") else "id"
        entries = [f"{name} {definition} -- {comment}" for name, definition, comment in columns]
        # Keep commas before line comments, so every synthetic column is explicit.
        entries = [entry.replace(" -- ", ", -- ") for entry in entries]
        sql += f"\n-- Minimum synthetic prerequisite, never a production-schema replacement.\nCREATE TABLE {table} (\n" + "\n".join(entries)
        sql += f"\nCONSTRAINT {pk} PRIMARY KEY ({key})" + (",\n" + extra if extra else "") + ");\n"
        sql += f"COMMENT ON TABLE {table} IS 'Minimum isolated prerequisite for exact WP02 object behavior, not full live schema.';\n"
        for name, _, comment in columns:
            sql += f"COMMENT ON COLUMN {table}.{name} IS '{comment}';\n"
        sql += f"COMMENT ON CONSTRAINT {pk} ON {table} IS 'Stable isolated fixture identity.';\nCOMMENT ON INDEX {table.split('.')[0]}.{pk} IS 'Constraint-backed fixture identity lookup.';\n"
        if extra:
            name = extra.split()[1]
            sql += f"COMMENT ON CONSTRAINT {name} ON {table} IS 'Existing tenant-qualified identity prerequisite, reused by exact WP02 FKs.';\nCOMMENT ON INDEX public.{name} IS 'Constraint-backed tenant-qualified fixture identity lookup.';\n"
        sql += f"-- Match runtime ownership without granting a superuser application identity.\nALTER TABLE {table} OWNER TO postgres;\n"
    # Reproduce broad creation-time defaults to prove explicit new-table revokes
    # cancel them. This does not alter any existing database's default privileges.
    sql += """
    -- Simulate observed permissive defaults only inside this disposable cluster.
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    -- Schema lookup is required for fixture ACL tests; no business-table access is authorized here.
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    -- Runtime owner must compile source-qualified fixture functions and actor FKs.
    GRANT USAGE, CREATE ON SCHEMA public TO postgres;
    GRANT USAGE ON SCHEMA auth TO postgres;
    -- Permit explicit role switching without granting browser roles owner rights.
    GRANT anon, authenticated, service_role TO postgres;
    """
    return sql


class Fixture:
    """Own a new container and reject host networking, published ports and mounts."""

    def __init__(self) -> None:
        self.token = uuid.uuid4().hex
        self.container = ""
        self.results: list[dict[str, object]] = []
        self.environment = {key: value for key, value in os.environ.items()
                            if not key.startswith("PG") and "DATABASE_URL" not in key}

    def docker(self, *args: str, input_text: str | None = None) -> subprocess.CompletedProcess[str]:
        """Use argv/stdin, never a shell or application connection environment."""
        return subprocess.run(["docker", *args], input=input_text, capture_output=True,
                              text=True, encoding="utf-8", env=self.environment, timeout=60)

    def assert_owned(self) -> dict[str, object]:
        """Verify container ownership before any SQL or force-removal operation."""
        result = self.docker("inspect", self.container)
        if result.returncode:
            raise RuntimeError("Owned fixture container unavailable")
        info = json.loads(result.stdout)[0]
        if (info["Id"] != self.container or
                info["Config"]["Labels"].get("cmx.wp02.fixture") != self.token or
                info["HostConfig"]["NetworkMode"] != "none" or
                info["HostConfig"].get("PortBindings") or
                any(mount["Type"] != "tmpfs" for mount in info["Mounts"])):
            raise RuntimeError("Isolation/ownership guard rejected container")
        return info

    def start(self) -> None:
        """Start disconnected ephemeral PG17; never reuse a named external DB."""
        result = self.docker("run", "--detach", "--rm", "--network", "none",
                             "--label", f"cmx.wp02.fixture={self.token}",
                             "--tmpfs", "/var/lib/postgresql/data:rw,noexec,nosuid,size=256m",
                             "--env", "POSTGRES_HOST_AUTH_METHOD=trust",
                             "--env", "POSTGRES_USER=fx_bootstrap",
                             "--env", "POSTGRES_DB=wp02_fixture", "postgres:17-alpine")
        if result.returncode:
            raise RuntimeError("Unable to start isolated PostgreSQL17: " + result.stderr)
        self.container = result.stdout.strip()
        self.assert_owned()
        for _ in range(45):
            # initdb's temporary server may accept sockets before entrypoint
            # restarts it; require PID1 to be the final PostgreSQL process.
            process = self.docker("exec", self.container, "cat", "/proc/1/comm")
            if process.stdout.strip() == "postgres":
                result = self.docker("exec", self.container, "pg_isready", "-U", "fx_bootstrap", "-d", "wp02_fixture")
                if result.returncode == 0:
                    return
            time.sleep(0.25)
        raise RuntimeError("Isolated PostgreSQL17 did not become ready")

    def query(self, sql: str, bootstrap: bool = False) -> subprocess.CompletedProcess[str]:
        """Send SQL only through the owned container's local Unix socket."""
        self.assert_owned()
        return self.docker("exec", "-i", self.container, "psql", "-X", "-qAt",
                           "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose",
                           "-h", "/var/run/postgresql", "-U", "fx_bootstrap" if bootstrap else "postgres", "-d", "wp02_fixture",
                           input_text="SET statement_timeout='10s'; SET lock_timeout='3s';\n" + sql)

    def case(self, name: str, sql: str, error: str | None = None,
             output: str | None = None, bootstrap: bool = False) -> None:
        """Require real PostgreSQL SQLSTATE/results instead of mocked behavior."""
        result = self.query(sql, bootstrap=bootstrap)
        if error:
            passed = result.returncode != 0 and re.search(rf"ERROR:\s+{error}:", result.stderr) is not None
        else:
            passed = result.returncode == 0 and (output is None or result.stdout.strip() == output)
        self.results.append({"case": name, "result": "PASS" if passed else "FAIL",
                             "expected_sqlstate": error, "actual_exit_code": result.returncode})
        print(f"{'PASS' if passed else 'FAIL'} {name}")
        if not passed:
            raise AssertionError(f"{name}\nstdout: {result.stdout}\nstderr: {result.stderr}")

    def close(self) -> None:
        """Discard only the verified owned container and its tmpfs fixture data."""
        if self.container:
            self.assert_owned()
            result = self.docker("rm", "--force", self.container)
            if result.returncode:
                raise RuntimeError("Unable to discard owned fixture container")
            self.container = ""


def change(change_id: str, number: int = 1, tenant: str = TENANT,
           order: str = ORDER, response: str = '{"ok":true}') -> str:
    """Insert one complete synthetic Change; fields carry no Finance assertions."""
    return f"""INSERT INTO public.org_order_changes_mst
      (id,tenant_org_id,order_id,change_no,edit_state_version_before,edit_state_version_after,
       wf_state_version_expected,source_context,actor_user_id,currency_code,financial_before,
       financial_after,commercial_delta,financial_outcome,idempotency_key,request_hash,apply_response,applied_at,created_by)
      VALUES ('{change_id}','{tenant}','{order}',{number},{number},{number + 1},1,'ISOLATED_FIXTURE','{ACTOR}',
       'OMR','{{"total":"10.000"}}','{{"total":"9.000"}}',-1,'NONE','fixture-{change_id}',
       'fixture-hash','{response}',now(),'{ACTOR}');"""


def operation(change_id: str, item_id: str | None = None, tenant: str = TENANT,
              order: str = ORDER, sequence: int = 1) -> str:
    """Preserve typed target identity without claiming current parent validation."""
    code, target = ("REMOVE_ITEM", "ITEM") if item_id else ("CHANGE_ORDER_NOTES", "ORDER")
    return f"""INSERT INTO public.org_order_change_ops_dtl
      (tenant_org_id,order_id,order_change_id,operation_seq,operation_code,target_type,order_item_id,created_by)
      VALUES ('{tenant}','{order}','{change_id}',{sequence},'{code}','{target}',
      {f"'{item_id}'" if item_id else 'NULL'},'{ACTOR}');"""


def fixture_tests(fixture: Fixture) -> None:
    """Exercise transaction, immutable identity, NULL-safe lineage and ACL contracts."""
    fixture.case("seed minimum identities", f"""
      INSERT INTO public.org_tenants_mst(id) VALUES ('{TENANT}'),('{OTHER_TENANT}');
      INSERT INTO auth.users(id) VALUES ('{ACTOR}');
      INSERT INTO public.sys_currency_cd(code) VALUES ('OMR');
      INSERT INTO public.org_orders_mst(id,tenant_org_id) VALUES
        ('{ORDER}','{TENANT}'),('{DEST_ORDER}','{TENANT}'),('{OTHER_ORDER}','{OTHER_TENANT}');
      UPDATE public.org_orders_mst SET committed_at='2026-10-02T12:00:00Z',committed_by='{ACTOR}',edit_state_version=1
        WHERE tenant_org_id='{TENANT}' AND id='{ORDER}';
    """)
    fixture.case("runtime owner matches non-superuser BYPASSRLS postgres", "SELECT current_user,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user;", output="postgres|f|t")
    identifiers = []
    for number, table in enumerate(TABLES, 1):
        fact_id, change_id = str(uuid.uuid4()), str(uuid.uuid4())
        identifiers.append((table, fact_id, change_id))
        fixture.case(f"{table}: deferred late-master resolves at COMMIT", f"""
          BEGIN;
          INSERT INTO public.{table}(id,tenant_org_id,order_id,rec_status,deleted_at,deleted_by,deleted_order_change_id)
          VALUES ('{fact_id}','{TENANT}','{ORDER}',0,now(),'{ACTOR}','{change_id}');
          {change(change_id, number)}
          {operation(change_id, fact_id if number == 1 else None)}
          COMMIT;
          SELECT count(*) FROM public.{table} WHERE tenant_org_id='{TENANT}' AND id='{fact_id}';
        """, output="1")
        missing, failed_fact = str(uuid.uuid4()), str(uuid.uuid4())
        fixture.case(f"{table}: missing master fails at COMMIT", f"""
          BEGIN;
          INSERT INTO public.{table}(id,tenant_org_id,order_id,rec_status,deleted_at,deleted_by,deleted_order_change_id)
          VALUES ('{failed_fact}','{TENANT}','{ORDER}',0,now(),'{ACTOR}','{missing}');
          COMMIT;
        """, error="23503")
        fixture.case(f"{table}: failed COMMIT retained no partial fact/history", f"""
          SELECT (SELECT count(*) FROM public.{table} WHERE tenant_org_id='{TENANT}' AND id='{failed_fact}')
          +(SELECT count(*) FROM public.org_order_changes_mst WHERE tenant_org_id='{TENANT}' AND id='{missing}')
          +(SELECT count(*) FROM public.org_order_change_ops_dtl WHERE tenant_org_id='{TENANT}' AND order_change_id='{missing}');
        """, output="0")
        for label, status, fields in (
                ("legacy NULL status without lineage accepted", "NULL", "NULL,NULL,NULL"),
                ("legacy removed status without lineage accepted", "0", "NULL,NULL,NULL"),
                ("governed NULL status rejected", "NULL", f"now(),'{ACTOR}','{change_id}'"),
                ("active row with lineage rejected", "1", f"now(),'{ACTOR}','{change_id}'"),
                ("partial lineage rejected", "0", f"NULL,'{ACTOR}','{change_id}'")):
            expected = "23514" if "rejected" in label else None
            fixture.case(f"{table}: {label}", f"""
              BEGIN;
              INSERT INTO public.{table}(id,tenant_org_id,order_id,rec_status,deleted_at,deleted_by,deleted_order_change_id)
              VALUES (gen_random_uuid(),'{TENANT}','{ORDER}',{status},{fields});
              ROLLBACK;
            """, error=expected)
        for action in (f"UPDATE public.{table} SET rec_status=1", f"UPDATE public.{table} SET order_id='{DEST_ORDER}'", f"DELETE FROM public.{table}"):
            fixture.case(f"{table}: governed removal immutable ({action.split()[0]} {action.split()[3] if action.startswith('UPDATE') else 'row'})",
                         f"BEGIN; {action} WHERE tenant_org_id='{TENANT}' AND id='{fact_id}'; ROLLBACK;", error="23514")

    fixture.case("missing-master rollback includes complete master/ops and earlier UPDATE", f"""
      BEGIN;
      UPDATE public.org_orders_mst SET edit_state_version=2 WHERE tenant_org_id='{TENANT}' AND id='{ORDER}';
      {change(str(uuid.UUID(int=100)), 4)}
      {operation(str(uuid.UUID(int=100)))}
      INSERT INTO public.org_order_items_dtl(id,tenant_org_id,order_id,rec_status,deleted_at,deleted_by,deleted_order_change_id)
        VALUES ('{str(uuid.UUID(int=101))}','{TENANT}','{ORDER}',0,now(),'{ACTOR}','{str(uuid.UUID(int=102))}');
      COMMIT;
    """, error="23503")
    fixture.case("no partial history or commercial revision after failed COMMIT", f"""
      SELECT (SELECT edit_state_version FROM public.org_orders_mst WHERE tenant_org_id='{TENANT}' AND id='{ORDER}'),
       (SELECT count(*) FROM public.org_order_changes_mst WHERE tenant_org_id='{TENANT}' AND id='{str(uuid.UUID(int=100))}'),
       (SELECT count(*) FROM public.org_order_change_ops_dtl WHERE tenant_org_id='{TENANT}' AND order_change_id='{str(uuid.UUID(int=100))}');
    """, output="1|0|0")
    fixture.case("SET CONSTRAINTS IMMEDIATE checks missing lineage before COMMIT", f"""
      BEGIN;
      INSERT INTO public.org_order_items_dtl(id,tenant_org_id,order_id,rec_status,deleted_at,deleted_by,deleted_order_change_id)
        VALUES (gen_random_uuid(),'{TENANT}','{ORDER}',0,now(),'{ACTOR}',gen_random_uuid());
      SET CONSTRAINTS oc_item_removal_change_fk IMMEDIATE;
      ROLLBACK;
    """, error="23503")
    for table in HISTORY:
        for action in (f"UPDATE public.{table} SET rec_notes='rewritten' WHERE tenant_org_id='{TENANT}'",
                       f"DELETE FROM public.{table} WHERE tenant_org_id='{TENANT}'", f"TRUNCATE public.{table}"):
            # PostgreSQL checks referenced-table inclusion before firing master
            # TRUNCATE triggers. Prove that FK guard and then the complete-set
            # trigger guard independently; never use TRUNCATE CASCADE.
            state = "0A000" if action.startswith("TRUNCATE") and table == HISTORY[0] else "23514"
            fixture.case(f"owner {action.split()[0]} denied for {table}", f"BEGIN; {action}; ROLLBACK;", error=state)
    fixture.case("owner complete-set TRUNCATE reaches immutable history trigger", "BEGIN; TRUNCATE public.org_order_changes_mst,public.org_order_change_ops_dtl,public.org_order_items_dtl,public.org_order_item_pieces_dtl,public.org_order_preferences_dtl; ROLLBACK;", error="23514")
    for field in ("committed_at=NULL", "committed_at='2026-10-03T12:00:00Z'", "committed_by=NULL"):
        fixture.case(f"commitment guard rejects {field}", f"BEGIN; UPDATE public.org_orders_mst SET {field} WHERE tenant_org_id='{TENANT}' AND id='{ORDER}'; ROLLBACK;", error="23514")
    fixture.case("committed order DELETE denied", f"BEGIN; DELETE FROM public.org_orders_mst WHERE tenant_org_id='{TENANT}' AND id='{ORDER}'; ROLLBACK;", error="23514")
    fixture.case("permanent block cannot be reopened", f"""
      BEGIN;
      UPDATE public.org_orders_mst SET edit_access_status='PERMANENTLY_BLOCKED',edit_blocked_at=now(),edit_block_reason_code='FIXTURE'
        WHERE tenant_org_id='{TENANT}' AND id='{ORDER}';
      UPDATE public.org_orders_mst SET edit_access_status='OPEN',edit_blocked_at=NULL,edit_block_reason_code=NULL
        WHERE tenant_org_id='{TENANT}' AND id='{ORDER}';
      ROLLBACK;
    """, error="23514")
    fixture.case("empty Apply shell rejected", f"BEGIN; {change(str(uuid.uuid4()),4,response='{}')} ROLLBACK;", error="23514")
    fixture.case("cross-tenant Change order FK denied", f"BEGIN; {change(str(uuid.uuid4()),4,order=OTHER_ORDER)} ROLLBACK;", error="23503")
    fixture.case("cross-tenant operation aggregate FK denied", f"BEGIN; {operation(identifiers[0][2],tenant=OTHER_TENANT,order=OTHER_ORDER)} ROLLBACK;", error="23503")
    other_item = str(uuid.uuid4())
    fixture.case("seed other-tenant stable identity", f"INSERT INTO public.org_order_items_dtl(id,tenant_org_id,order_id) VALUES ('{other_item}','{OTHER_TENANT}','{OTHER_ORDER}');")
    fixture.case("cross-tenant operation target FK denied", f"BEGIN; {operation(identifiers[0][2],item_id=other_item,sequence=2)} ROLLBACK;", error="23503")
    fixture.case("cross-tenant deferred removal FK denied", f"""
      BEGIN;
      INSERT INTO public.org_order_items_dtl(id,tenant_org_id,order_id,rec_status,deleted_at,deleted_by,deleted_order_change_id)
      VALUES (gen_random_uuid(),'{OTHER_TENANT}','{OTHER_ORDER}',0,now(),'{ACTOR}','{identifiers[0][2]}'); COMMIT;
    """, error="23503")
    live_item, live_change = str(uuid.uuid4()), str(uuid.uuid4())
    fixture.case("historical identity survives same-tenant live reparent", f"""
      BEGIN;
      INSERT INTO public.org_order_items_dtl(id,tenant_org_id,order_id) VALUES ('{live_item}','{TENANT}','{ORDER}');
      {change(live_change,4)} {operation(live_change,item_id=live_item)}
      UPDATE public.org_order_items_dtl SET order_id='{DEST_ORDER}' WHERE tenant_org_id='{TENANT}' AND id='{live_item}';
      SELECT op.order_id= '{ORDER}'::uuid AND i.order_id='{DEST_ORDER}'::uuid
      FROM public.org_order_change_ops_dtl op JOIN public.org_order_items_dtl i
        ON i.id=op.order_item_id AND i.tenant_org_id='{TENANT}'
      WHERE op.tenant_org_id='{TENANT}' AND op.order_change_id='{live_change}';
      ROLLBACK;
    """, output="t")
    for role in ("anon", "authenticated"):
        for table in HISTORY:
            fixture.case(f"{role} SELECT privilege denied: {table}", f"BEGIN; SET LOCAL ROLE {role}; SELECT count(*) FROM public.{table} WHERE tenant_org_id='{TENANT}'; ROLLBACK;", error="42501")
        fixture.case(f"{role} INSERT privilege denied", f"BEGIN; SET LOCAL ROLE {role}; {change(str(uuid.uuid4()),4)} ROLLBACK;", error="42501")
        # Temporary grants are rolled back; prove RLS default-deny independently
        # from missing table privileges without changing the deployed design.
        fixture.case(f"{role} no-policy RLS hides rows even with temporary SELECT", f"BEGIN; GRANT SELECT ON public.org_order_changes_mst TO {role}; SET LOCAL ROLE {role}; SELECT count(*) FROM public.org_order_changes_mst WHERE tenant_org_id='{TENANT}'; ROLLBACK;", output="0")
        fixture.case(f"{role} no-policy RLS rejects temporarily granted INSERT", f"BEGIN; GRANT INSERT ON public.org_order_changes_mst TO {role}; SET LOCAL ROLE {role}; {change(str(uuid.uuid4()),4)} ROLLBACK;", error="42501")
    fixture.case("service_role SELECT sees append facts", f"BEGIN; SET LOCAL ROLE service_role; SELECT count(*) FROM public.org_order_changes_mst WHERE tenant_org_id='{TENANT}'; ROLLBACK;", output="3")
    fixture.case("service_role complete INSERT allowed", f"BEGIN; SET LOCAL ROLE service_role; {change(str(uuid.uuid4()),4)} ROLLBACK;")
    for table in HISTORY:
        for action in (f"UPDATE public.{table} SET rec_notes='rewritten' WHERE tenant_org_id='{TENANT}'", f"DELETE FROM public.{table} WHERE tenant_org_id='{TENANT}'", f"TRUNCATE public.{table}"):
            fixture.case(f"service_role {action.split()[0]} privilege denied: {table}", f"BEGIN; SET LOCAL ROLE service_role; {action}; ROLLBACK;", error="42501")
    fixture.case("exact deferred FK catalog timing", """
      SELECT count(*) FROM pg_constraint WHERE conname IN
      ('oc_item_removal_change_fk','oc_piece_removal_change_fk','oc_pref_removal_change_fk')
      AND condeferrable AND condeferred AND NOT convalidated AND confdeltype='r' AND confupdtype='r';
    """, output="3")
    fixture.case("both history RLS enabled with no policies", """
      SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('org_order_changes_mst','org_order_change_ops_dtl')
      AND c.relrowsecurity AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid);
    """, output="2")


def main() -> int:
    """Run the bounded suite and emit a non-secret manifest after disposal."""
    if len(sys.argv) != 1:
        raise SystemExit("This harness accepts no DB URL, host, port, container or configuration arguments.")
    definitions, manifest = object_definitions()
    fixture = Fixture()
    version, image = "", ""
    try:
        fixture.start()
        info = fixture.assert_owned()
        image = str(info["Image"])
        result = fixture.query("SELECT version();", bootstrap=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        version = result.stdout.strip()
        if not version.startswith("PostgreSQL 17."):
            raise RuntimeError("Fixture PostgreSQL major version is not 17")
        fixture.case("compile minimal synthetic prerequisite objects", baseline(), bootstrap=True)
        fixture.case("compile exact source object definitions (not migration execution)", definitions)
        fixture_tests(fixture)
    finally:
        fixture.close()
    print("WP02_FIXTURE_EVIDENCE=" + json.dumps({
        "postgres_version": version, "image_id": image, "sources": manifest,
        "isolation": "new container, network none, no published ports, tmpfs only, local Unix socket",
        "cleanup": "owned container removed; no existing database connected; no migration applied",
        "results": fixture.results,
    }, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
