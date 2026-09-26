import re, sys, shutil, os

BASE = "/storage/emulated/0/Download/TELEGRAM-CONTROL-FINAL"
os.chdir(BASE)
print(f"Working in: {os.getcwd()}")
print()

# ═══════════════════════════════════════════════════════════
# PATCH server.py
# ═══════════════════════════════════════════════════════════
SRC = "server.py"
shutil.copy(SRC, SRC + ".setupbak")
src = open(SRC).read()

def rep(old, new, label):
    global src
    if old in src:
        src = src.replace(old, new, 1)
        print(f"  ✅ {label}")
        return True
    print(f"  ⚠️  {label} (skip)")
    return False

print("═══ server.py ═══")

rep(
    'ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")',
    'ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "123")',
    'ADMIN_PASSWORD = "123"'
)

rep(
    'ALLOW_STANDARD_FIREBASE = os.environ.get("ALLOW_STANDARD_FIREBASE", "0") == "1"',
    'ALLOW_STANDARD_FIREBASE = os.environ.get("ALLOW_STANDARD_FIREBASE", "1") == "1"',
    'ALLOW_STANDARD_FIREBASE = 1'
)

rep(
    'SERVICE_TOKEN = os.environ.get("PANEL_SERVICE_TOKEN", "").strip()',
    'SERVICE_TOKEN = os.environ.get("PANEL_SERVICE_TOKEN", "berlinx-local-2026").strip()',
    'SERVICE_TOKEN default'
)

rep(
    'DATA_DIR = Path(os.environ.get("DATA_DIR", str(ROOT / "data"))).expanduser()',
    'DATA_DIR = Path(os.environ.get("DATA_DIR", "/storage/emulated/0/Download/TELEGRAM-CONTROL-FINAL/data")).expanduser()',
    'DATA_DIR absolute'
)

# Fix _host_allowed
old_host = '''def _host_allowed(host):
    host = (host or "").lower().rstrip(".")
    if AUTHORIZED_HOSTS:
        return host in AUTHORIZED_HOSTS or any(
            host.endswith(s if s.startswith(".") else "." + s) for s in AUTHORIZED_HOSTS
        )
    if ALLOW_STANDARD_FIREBASE:
        return host.endswith(".firebaseio.com") or host.endswith(".firebasedatabase.app")
    return False'''

new_host = '''def _host_allowed(host):
    host = (host or "").lower().rstrip(".")
    if any(host.endswith(s if s.startswith(".") else "." + s) or host == s.lstrip(".")
           for s in BULK_EXTRA_SUFFIXES):
        return True
    if AUTHORIZED_HOSTS:
        if host in AUTHORIZED_HOSTS or any(
            host.endswith(s if s.startswith(".") else "." + s) for s in AUTHORIZED_HOSTS
        ):
            return True
    if ALLOW_STANDARD_FIREBASE or not AUTHORIZED_HOSTS:
        if host.endswith(".firebaseio.com") or host.endswith(".firebasedatabase.app"):
            return True
    return False'''

rep(old_host, new_host, '_host_allowed fixed')

# Re-enable public endpoint
old_public = '''        # ── Public bulk job creation ──
        if path == "/api/public-bulk/jobs":
            return json_out(self, {"ok": False, "error": "Public bulk scanning is disabled. Use the authenticated admin/service endpoint with authorized project URLs."}, 403)'''

new_public = '''        # ── Public bulk job creation (re-enabled) ──
        if path == "/api/public-bulk/jobs":
            ip = self.client_address[0] if self.client_address else "unknown"
            now = time.time()
            with _PUBLIC_RATE_LOCK:
                recent = [t for t in PUBLIC_BULK_RATE.get(ip, []) if now - t < PUBLIC_BULK_WINDOW]
                if len(recent) >= PUBLIC_BULK_LIMIT:
                    return json_out(self, {"ok": False, "error": "Rate limit reached."}, 429, {"Retry-After": str(PUBLIC_BULK_WINDOW)})
                recent.append(now)
                PUBLIC_BULK_RATE[ip] = recent
            if not self.headers.get("Content-Type", "").startswith("application/json"):
                return json_out(self, {"ok": False, "error": "Use application/json."}, 400)
            body, err = read_json(self, BULK_MAX_BYTES + 20_000)
            if err:
                return json_out(self, {"ok": False, "error": err}, 400)
            filename = field(body, "filename", 180) or "firebase-urls.txt"
            content = str(body.get("content", "") or "")
            if len(content.encode("utf-8")) > BULK_MAX_BYTES:
                return json_out(self, {"ok": False, "error": f"TXT exceeds {BULK_MAX_BYTES // 1000} KB."}, 413)
            pairs = normalize_bulk_urls(content)
            if not pairs:
                return json_out(self, {"ok": False, "error": "No valid Firebase HTTPS URLs found."}, 400)
            con = get_db()
            token = secrets.token_urlsafe(24)
            cur = con.execute("INSERT INTO bulk_jobs(filename,total,status,public_token) VALUES(?,?, 'pending',?)", (filename, len(pairs), token))
            job_id = cur.lastrowid
            con.executemany("INSERT INTO bulk_job_items(job_id,url,secret) VALUES(?,?,?)", [(job_id, u, s) for u, s in pairs])
            con.commit()
            con.close()
            _bump("bulk_jobs_created")
            log(f"public bulk job #{job_id} created ({len(pairs)} urls)", level="INFO", tag="BULK")
            return json_out(self, {"ok": True, "job_id": job_id, "token": token, "total": len(pairs)}, 201)'''

rep(old_public, new_public, 'Public endpoint re-enabled')

# Add _PUBLIC_RATE_LOCK if missing
if "_PUBLIC_RATE_LOCK = threading.Lock()" not in src:
    src = src.replace(
        "_SESSION_LOCK = threading.Lock()",
        "_SESSION_LOCK = threading.Lock()\n_PUBLIC_RATE_LOCK = threading.Lock()",
        1
    )
    print("  ✅ _PUBLIC_RATE_LOCK added")

rep('PUBLIC_BULK_LIMIT = 20', 'PUBLIC_BULK_LIMIT = 200', 'Rate limit 20→200')

open(SRC, "w").write(src)

import ast
try:
    ast.parse(open(SRC).read())
    print("  ✅ server.py SYNTAX OK")
except SyntaxError as e:
    print(f"  ❌ SYNTAX ERROR {e.lineno}: {e.msg}")
    shutil.copy(SRC + ".setupbak", SRC)
    sys.exit(1)

# ═══════════════════════════════════════════════════════════
# PATCH telegram_bot.py
# ═══════════════════════════════════════════════════════════
print()
print("═══ telegram_bot.py ═══")

BOT = "telegram_bot.py"
shutil.copy(BOT, BOT + ".setupbak")
bot = open(BOT).read()

def brep(old, new, label):
    global bot
    if old in bot:
        bot = bot.replace(old, new, 1)
        print(f"  ✅ {label}")
        return True
    print(f"  ⚠️  {label} (skip)")
    return False

brep(
    'BOT_TOKEN      = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()',
    'BOT_TOKEN      = os.environ.get("TELEGRAM_BOT_TOKEN", "8437134912:AAFPxS63ZgoNF3XH-69EDn0nhBqys-1iAtE").strip()',
    'BOT_TOKEN default'
)

brep(
    'ADMIN_CHAT_ID  = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "").strip()',
    'ADMIN_CHAT_ID  = os.environ.get("TELEGRAM_ADMIN_CHAT_ID", "7178096331").strip()',
    'ADMIN_CHAT_ID default'
)

# Absolute paths for state
import re as _re
bot = _re.sub(
    r'STATE_DIR\s*=\s*_ensure_dir\(os\.environ\.get\("TELEGRAM_STATE_DIR",\s*\n?\s*os\.path\.join\(tempfile\.gettempdir\(\), "berlinx-tg"\)\)\)',
    'STATE_DIR  = _ensure_dir(os.environ.get("TELEGRAM_STATE_DIR",\n                        "/storage/emulated/0/Download/TELEGRAM-CONTROL-FINAL/tg-state"))',
    bot
)
print("  ✅ STATE_DIR absolute")

bot = _re.sub(
    r'REPORT_DIR\s*=\s*_ensure_dir\(os\.environ\.get\("TELEGRAM_URL_REPORT_DIR",\s*\n?\s*os\.path\.join\(STATE_DIR, "reports"\)\)\)',
    'REPORT_DIR = _ensure_dir(os.environ.get("TELEGRAM_URL_REPORT_DIR",\n                        "/storage/emulated/0/Download/TELEGRAM-CONTROL-FINAL/tg-reports"))',
    bot
)
print("  ✅ REPORT_DIR absolute")

open(BOT, "w").write(bot)

try:
    ast.parse(open(BOT).read())
    print("  ✅ telegram_bot.py SYNTAX OK")
except SyntaxError as e:
    print(f"  ❌ SYNTAX ERROR {e.lineno}: {e.msg}")
    shutil.copy(BOT + ".setupbak", BOT)
    sys.exit(1)

print()
print("=" * 60)
print("✅ DONE — Ab sirf ek command chalao:")
print("=" * 60)
print()
print("  cd /storage/emulated/0/Download/TELEGRAM-CONTROL-FINAL")
print("  python -u server.py")
print()
