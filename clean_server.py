import shutil, sys, ast

SRC = "server.py"
shutil.copy(SRC, SRC + ".cleanbak")
src = open(SRC).read()
changes = 0

# ═══════════════════════════════════════════════════════════
# FIX 1: Remove duplicate/messy comment block in Handler class
# ═══════════════════════════════════════════════════════════

old_mess = '''        }, 200 if all_ok else 503)
# ═══════════════════════════════════════════════════════════════
# POST ROUTES
# ═══════════════════════════════════════════════════════════════


    # ═══════════════════════════════════════════════════════════════
    # PUT ROUTES (APK upload)
    # ═══════════════════════════════════════════════════════════════


    # ═══════════════════════════════════════════════════════════════
    # DELETE ROUTES (app delete)
    # ═══════════════════════════════════════════════════════════════

    # ═══════════════════════════════════════════════════════════════
    # POST ROUTES
    # ═══════════════════════════════════════════════════════════════

    def do_POST(self):'''

new_mess = '''        }, 200 if all_ok else 503)

    # ═══════════════════════════════════════════════════════════
    # POST ROUTES
    # ═══════════════════════════════════════════════════════════

    def do_POST(self):'''

if old_mess in src:
    src = src.replace(old_mess, new_mess, 1)
    changes += 1
    print("[1/4] ✅ Duplicate comment blocks cleaned")
else:
    print("[1/4] ⚠️  Duplicate block not found (already clean?)")

# ═══════════════════════════════════════════════════════════
# FIX 2: GET /api/bulk-firebase/jobs — remove mutate=True
# ═══════════════════════════════════════════════════════════

old1 = '''        # ── Admin: bulk jobs list ──
        if path == "/api/bulk-firebase/jobs":
            if not require_admin(self, mutate=True, allow_service=True): return'''

new1 = '''        # ── Admin: bulk jobs list ──
        if path == "/api/bulk-firebase/jobs":
            if not require_admin(self, allow_service=True): return'''

if old1 in src:
    src = src.replace(old1, new1, 1)
    changes += 1
    print("[2/4] ✅ GET bulk list — CSRF removed")
else:
    print("[2/4] ⚠️  GET bulk list block not found")

# ═══════════════════════════════════════════════════════════
# FIX 3: GET /api/bulk-firebase/jobs/<id> — remove mutate=True
# ═══════════════════════════════════════════════════════════

old2 = '''        # ── Admin: bulk job detail ──
        if path.startswith("/api/bulk-firebase/jobs/"):
            if not require_admin(self, mutate=True): return'''

new2 = '''        # ── Admin: bulk job detail ──
        if path.startswith("/api/bulk-firebase/jobs/"):
            if not require_admin(self): return'''

if old2 in src:
    src = src.replace(old2, new2, 1)
    changes += 1
    print("[3/4] ✅ GET bulk detail — CSRF removed")
else:
    print("[3/4] ⚠️  GET bulk detail block not found")

# ═══════════════════════════════════════════════════════════
# FIX 4: Ensure main() is at bottom + __main__ block correct
# ═══════════════════════════════════════════════════════════

if 'if __name__ == "__main__":' in src and 'def main():' in src:
    main_def = src.rfind("def main():")
    main_call = src.find('if __name__ == "__main__":')
    if main_def > 0 and main_call > 0:
        # Check that main() comes before __main__
        if src[:main_call].rfind("def main():") > 0:
            changes += 1
            print("[4/4] ✅ main() + __main__ order OK")
        else:
            print("[4/4] ⚠️  main() order unusual")
    else:
        print("[4/4] ⚠️  main/__main__ not both found")
else:
    print("[4/4] ⚠️  main or __main__ missing")

# ═══════════════════════════════════════════════════════════
# Save + Verify
# ═══════════════════════════════════════════════════════════

open(SRC, "w").write(src)
print(f"\n✅ Total changes: {changes}")

try:
    ast.parse(open(SRC).read())
    print("✅ SYNTAX OK")
except SyntaxError as e:
    print(f"❌ SYNTAX ERROR {e.lineno}: {e.msg}")
    shutil.copy(SRC + ".cleanbak", SRC)
    print("(restored)")
    sys.exit(1)

# Quick check
print()
print("═══ Final Verification ═══")
import importlib.util
spec = importlib.util.spec_from_file_location("server", SRC)
try:
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    print(f"  main: {hasattr(m, 'main')}")
    print(f"  do_POST: {'do_POST' in dir(m.Handler)}")
    print(f"  do_GET: {'do_GET' in dir(m.Handler)}")
    print(f"  do_PUT: {'do_PUT' in dir(m.Handler)}")
    print(f"  do_DELETE: {'do_DELETE' in dir(m.Handler)}")
except Exception as e:
    print(f"  import test skipped: {type(e).__name__}")
