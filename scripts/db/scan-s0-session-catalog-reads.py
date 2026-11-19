"""Find session-JWT sys_/hq_ reads and revoked RPCs that still need catalogReadClient.

After S0 (0745–0749), authenticated cannot SELECT sys_*/hq_* and many catalog-touching
RPCs lost EXECUTE. This scanner reports leftover session-client call sites.

Safe patterns (suppressed):
  - catalogReadClient(...)
  - createAdminSupabaseClient() bindings (incl. multiline await admin\\n.from)
  - Identifiers clearly named admin / adminClient / adminSupabase when the file
    imports an admin factory
  - Allowlisted session RPCs (auth wrappers, settings resolvers, org-only helpers)

Exit code 1 when any RISK row remains (CI-friendly).
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "web-admin"
SKIP_DIR = {
    "__tests__",
    "types",
    "node_modules",
    ".next",
    ".swc",
    ".prisma-cache",
    "messages",
    "stories",
    "storybook",
    "storybook-static",
    "coverage",
    "playwright-report",
    "test-results",
    "dist",
    "build",
    "public",
    "data",
}

PAT_FROM = re.compile(r"""\.(?:from)\(\s*['"]((?:sys_|hq_)[^'"]+)['"]""")
PAT_FROM_IDENT = re.compile(r"""\.(?:from)\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)""")
PAT_RPC = re.compile(r"""\.rpc\(\s*['"]([^'"]+)['"]""")
PAT_RPC_IDENT = re.compile(r"""\.rpc\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,""")
PAT_RPC_OPEN = re.compile(r"""\.rpc\(\s*$""")
PAT_RPC_NAME_LINE = re.compile(r"""^\s*['"]([^'"]+)['"]\s*,?\s*$""")
PAT_STR_CONST = re.compile(
    r"""\b(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"]([^'"]+)['"]"""
)
PAT_EMBED_ALIAS = re.compile(
    r"""(?:^|[,{\s])(?:\w+\s*:\s*)?((?:sys_|hq_)[a-z0-9_]+)\s*\("""
)
PAT_ORDER_REL = re.compile(
    r"""\.order\(\s*['"]((?:sys_|hq_)[a-z0-9_]+)\s*\("""
)

# Factories that yield a service-role / catalog client.
ADMIN_FACTORY = re.compile(
    r"\b(createAdminSupabaseClient|catalogReadClient|createServiceRoleClient)\s*\("
)
# const x = await createAdminSupabaseClient() / const x = catalogReadClient(y)
BIND_ASSIGN = re.compile(
    r"""\b(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:"""
    r"""createAdminSupabaseClient|catalogReadClient|createServiceRoleClient)\s*\("""
)
# function / arrow params: (admin: …) or ({ admin }: …) — conservative name match
PARAM_ADMIN = re.compile(
    r"""(?:function\s+\w+\s*\(|=>\s*\(|^\s*\()[^)]*\b(admin|adminClient|adminSupabase)\b"""
)
# Multiline chain head: await client   OR   = client   OR   return client
CHAIN_HEAD = re.compile(
    r"""(?:await|=|return)\s+(\w+)\s*$|^\s*(\w+)\s*$"""
)

# Session-safe RPCs (documented allowlist). Used only to suppress known-good names
# that would otherwise match a risk prefix.
ALLOW_RPC = {
    "get_user_permissions",
    "get_user_roles",
    "get_user_tenants",
    "has_permission",
    "has_any_permission",
    "has_all_permissions",
    "has_resource_permission",
    "fn_auth_own_tenants",
    "fn_auth_session_choose_tenant",
    "fn_auth_session_open_picker",
    "fn_auth_session_validate",
    "fn_label_printing_resolve",
    "fix_order_data",
    "fn_stng_resolve_all_settings",
    "fn_stng_resolve_setting_value",
    "current_tenant_id",
    "is_admin",
    "resolve_item_preferences",
}

# Session JWT must not call these (EXECUTE revoked and/or INVOKER body reads sys_/hq_).
# Do NOT put org-only INVOKER helpers here (e.g. cmx_ord_pref_append_notes_followup).
RISK_RPC_EXACT = {
    "log_order_action",
    "generate_customer_number",
    "get_last_order_preferences",
    "suggest_preferences_from_history",
    "get_user_permissions_jh",
    "get_navigation_with_parents_jh",
    "cmx_rebuild_user_permissions",
    "cmx_can",
    "cmx_ord_canceling_transition",
    "cmx_ord_returning_transition",
    "cmx_ord_execute_transition",
    "cmx_ord_order_workflow_flags",
    "cmx_ord_screen_pre_conditions",
    "fn_get_setting_value",
    "fn_stng_resolve_settings_set",
    "fn_stng_explain_setting",
    "fn_stng_get_profile_chain",
    "seed_tenant_pref_kinds",
    "get_code_table_history",
}

RISK_RPC_PREFIX = (
    "hq_ff_",
)

# Names that almost always mean service role in this codebase.
SAFE_NAME = {"admin", "adminclient", "adminsupabase", "catalog", "catalogclient"}

def is_comment(line: str) -> bool:
    s = line.strip()
    return s.startswith("//") or s.startswith("*") or s.startswith("/*") or s.startswith("*/")


def collect_safe_bindings(lines: list[str]) -> set[str]:
    """Identifiers bound to admin/catalog clients in this file."""
    safe: set[str] = set()
    imports_admin = False
    for line in lines:
        if is_comment(line):
            continue
        if ADMIN_FACTORY.search(line) or (
            "createAdminSupabaseClient" in line
            or "catalogReadClient" in line
            or "createServiceRoleClient" in line
        ):
            imports_admin = True
        m = BIND_ASSIGN.search(line)
        if m:
            safe.add(m.group(1))
        if PARAM_ADMIN.search(line):
            for name in ("admin", "adminClient", "adminSupabase"):
                if re.search(rf"\b{name}\b", line):
                    safe.add(name)
    # Convention: file that imports an admin factory and uses `admin` / `supabase`
    # assigned nearby — still resolved per-call via resolve_client; only seed names.
    if imports_admin:
        safe.update({"admin", "adminClient", "adminSupabase"})
    return safe


def resolve_client(lines: list[str], idx: int) -> str | None:
    """Best-effort client identifier for a .from / .rpc / embed on lines[idx]."""
    line = lines[idx]
    # Same-line: admin.from / catalogReadClient(x).from / await admin.from
    same = re.search(
        r"""\b(\w+)\s*\.\s*(?:from|rpc)\s*\(|"""
        r"""(?:createAdminSupabaseClient|catalogReadClient|createServiceRoleClient)\s*\([^)]*\)\s*\.\s*(?:from|rpc)""",
        line,
    )
    if same and same.group(1):
        return same.group(1)

    # Inline factory on same line
    if ADMIN_FACTORY.search(line):
        return "__factory__"

    # Walk back across a chained builder (.select / .eq / .order …)
    for j in range(idx, max(-1, idx - 40), -1):
        prev = lines[j].rstrip()
        if not prev.strip() or is_comment(prev):
            continue
        # Stop at statement start that names the client
        head = CHAIN_HEAD.search(prev.strip())
        if head:
            name = head.group(1) or head.group(2)
            # Avoid treating property access starts as clients when line is `.from`
            if name and not prev.strip().startswith("."):
                # `const { data } = await supabase` — extract supabase
                await_m = re.search(r"\bawait\s+(\w+)\s*$", prev.strip())
                if await_m:
                    return await_m.group(1)
                assign_await = re.search(
                    r"=\s*(?:await\s+)?(\w+)\s*$", prev.strip()
                )
                if assign_await and not prev.strip().startswith("."):
                    # `const x = await supabase` → supabase; `= createAdmin…` handled below
                    cand = assign_await.group(1)
                    if cand not in {"const", "let", "var", "return", "await"}:
                        return cand
                if re.fullmatch(r"\w+", prev.strip()):
                    return prev.strip()
        # `await catalogReadClient(supabase)` as chain head
        if ADMIN_FACTORY.search(prev):
            return "__factory__"
        # Same-line bind then chain without newline (rare)
        m = BIND_ASSIGN.search(prev)
        if m:
            return m.group(1)
        # Break on new statement that is not a chain continuation
        stripped = prev.strip()
        if stripped.startswith(".") or stripped.endswith("(") or stripped.endswith(","):
            continue
        if stripped.endswith(";") and j < idx:
            break
    return None


def client_is_safe(name: str | None, safe_bindings: set[str], lines: list[str], idx: int) -> bool:
    if name == "__factory__":
        return True
    if name and (name in safe_bindings or name.lower() in SAFE_NAME):
        return True
    # Immediate wrap: catalogReadClient(supabase).from on nearby lines
    window = "\n".join(lines[max(0, idx - 3) : idx + 1])
    if ADMIN_FACTORY.search(window):
        return True
    return False


def collect_string_consts(lines: list[str]) -> dict[str, str]:
    """Map const/let/var name -> string literal value for the whole file."""
    out: dict[str, str] = {}
    for line in lines:
        if is_comment(line):
            continue
        for m in PAT_STR_CONST.finditer(line):
            out[m.group(1)] = m.group(2)
    return out


def rpc_is_risk(name: str) -> bool:
    """True when a session-client call to this RPC is an S0 footgun."""
    if name in ALLOW_RPC:
        return False
    if name in RISK_RPC_EXACT:
        return True
    return any(name.startswith(p) for p in RISK_RPC_PREFIX)


def resolve_rpc_name(lines: list[str], idx: int, str_consts: dict[str, str]) -> str | None:
    """Literal or const RPC name on this line, or the next-line string after `.rpc(`."""
    line = lines[idx]
    m = PAT_RPC.search(line)
    if m:
        return m.group(1)
    mi = PAT_RPC_IDENT.search(line)
    if mi:
        return str_consts.get(mi.group(1))
    if PAT_RPC_OPEN.search(line) or re.search(r"""\.rpc\(\s*$""", line.strip()):
        for j in range(idx + 1, min(len(lines), idx + 4)):
            if is_comment(lines[j]):
                continue
            nm = PAT_RPC_NAME_LINE.match(lines[j])
            if nm:
                return nm.group(1)
            # `.rpc(\n  RESOLVE_FN, {` — const on next line
            ident = re.match(r"""^\s*([A-Za-z_][A-Za-z0-9_]*)\s*,""", lines[j])
            if ident:
                return str_consts.get(ident.group(1))
            break
    return None


def scan_file(path: Path, root: Path) -> list[tuple[str, int, str, str, str]]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    safe_bindings = collect_safe_bindings(lines)
    str_consts = collect_string_consts(lines)
    # Track which locals were assigned from admin factories later in the file
    # (re-scan line-by-line so uses after assignment are covered).
    live_safe = set(safe_bindings)
    rows: list[tuple[str, int, str, str, str]] = []
    rel = str(path.relative_to(root)).replace("\\", "/")

    for i, line in enumerate(lines):
        stripped = line.strip()
        if is_comment(line):
            continue

        bind = BIND_ASSIGN.search(line)
        if bind:
            live_safe.add(bind.group(1))

        client = resolve_client(lines, i)
        safe = client_is_safe(client, live_safe, lines, i)

        m = PAT_FROM.search(line)
        if m and not safe:
            rows.append((rel, i + 1, "from", m.group(1), stripped[:140]))

        fi = PAT_FROM_IDENT.search(line)
        if fi and not safe:
            table = str_consts.get(fi.group(1))
            if table and table.startswith(("sys_", "hq_")):
                rows.append((rel, i + 1, "from-const", table, stripped[:140]))

        for em in PAT_EMBED_ALIAS.finditer(line):
            name = em.group(1)
            lower = stripped.lower()
            # Skip SQL/docs noise
            if any(
                tok in lower
                for tok in (
                    "insert into",
                    "comment",
                    "dual-write",
                    "migration",
                    "fk ",
                    "mirror",
                    "from org_",
                )
            ):
                continue
            # Bare type/table mentions in strings without PostgREST shape
            if "select" not in lower and f"{name}(" not in stripped.replace(" ", ""):
                continue
            if not safe:
                kind = "embed-alias" if ":" in stripped else "embed"
                rows.append((rel, i + 1, kind, name, stripped[:140]))

        om = PAT_ORDER_REL.search(line)
        if om and not safe:
            rows.append((rel, i + 1, "order-rel", om.group(1), stripped[:140]))

        # Same-line literal, const, or multiline `.rpc(\n  'name'`
        if ".rpc(" in line:
            rpc = resolve_rpc_name(lines, i, str_consts)
            if rpc and rpc_is_risk(rpc) and not safe:
                rows.append((rel, i + 1, "rpc", rpc, stripped[:140]))

    return rows


def iter_candidate_files(root: Path) -> list[Path]:
    """Prefer ripgrep file list; fall back to a pruned walk."""
    rg = shutil.which("rg")
    if rg:
        # Only parse files that mention catalogs or .rpc( — full walk is too slow on Windows AV.
        glob_args: list[str] = []
        for d in sorted(SKIP_DIR):
            glob_args.extend(["--glob", f"!{d}/**"])
        glob_args.extend(["--glob", "!.*", "--glob", "*.ts", "--glob", "*.tsx", "--glob", "!*.d.ts"])
        try:
            proc = subprocess.run(
                [
                    rg,
                    "-l",
                    "--no-messages",
                    r"(?:sys_|hq_)|\.rpc\s*\(",
                    str(root),
                    *glob_args,
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            if proc.returncode in (0, 1):
                paths = []
                for line in proc.stdout.splitlines():
                    p = Path(line.strip())
                    if p.is_file() and not any(part in SKIP_DIR for part in p.parts):
                        paths.append(p)
                return paths
        except OSError:
            pass

    paths: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIR and not d.startswith(".")]
        for name in filenames:
            if not name.endswith((".ts", ".tsx")) or name.endswith(".d.ts"):
                continue
            path = Path(dirpath) / name
            try:
                sample = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            if "sys_" not in sample and "hq_" not in sample and ".rpc" not in sample:
                continue
            paths.append(path)
    return paths


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Scan web-admin for session-JWT sys_/hq_ catalog reads after S0."
    )
    parser.add_argument(
        "--path",
        type=Path,
        default=ROOT,
        help="Root to scan (default: web-admin)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print JSON lines instead of text",
    )
    args = parser.parse_args()
    root: Path = args.path if args.path.is_absolute() else (Path.cwd() / args.path)
    if not root.exists():
        print(f"scan root not found: {root}", file=sys.stderr)
        return 2

    rows: list[tuple[str, int, str, str, str]] = []
    for path in iter_candidate_files(root):
        rows.extend(scan_file(path, root))

    seen: set[tuple[str, int, str, str]] = set()
    out: list[tuple[str, int, str, str, str]] = []
    for row in rows:
        key = (row[0], row[1], row[2], row[3])
        if key in seen:
            continue
        seen.add(key)
        out.append(row)

    out.sort()
    if args.json:
        import json

        for row in out:
            print(
                json.dumps(
                    {
                        "file": row[0],
                        "line": row[1],
                        "kind": row[2],
                        "target": row[3],
                        "snippet": row[4],
                    }
                )
            )
    else:
        for row in out:
            print(f"{row[0]}:{row[1]} [{row[2]}] {row[3]} | {row[4]}")
        print(f"TOTAL {len(out)}")
        if out:
            print(
                "RISK: session-JWT catalog touch sites remain — "
                "route through catalogReadClient / createAdminSupabaseClient "
                "or drop the sys_/hq_ embed.",
                file=sys.stderr,
            )
        else:
            print("OK: no session-JWT sys_/hq_ catalog reads found.")

    return 1 if out else 0


if __name__ == "__main__":
    raise SystemExit(main())
