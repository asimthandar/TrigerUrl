#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, re
BASE=Path(__file__).resolve().parents[1]
ORIGINAL=BASE.parent/"testpa.html"
M= json.loads((BASE/"MANIFEST.json").read_text())
def sha(b): return hashlib.sha256(b).hexdigest()
src=ORIGINAL.read_bytes()
assert len(src)==M["source_bytes"] and sha(src)==M["source_sha256"], "SOURCE MISMATCH"
txt=src.decode("utf-8")
style=re.search(r"<style\b[^>]*>(.*?)</style>",txt,re.S|re.I).group(1).encode()
assert sha(style)==M["preservation"]["css_inner_sha256"], "CSS MISMATCH"
script=re.search(r"<script>(.*?)</script>",txt,re.S|re.I).group(1).encode()
names=["vendor.js","firebase-service.js","connect-panel.js","dashboard.js","app-bootstrap.js"]
joined=b"".join((BASE/"js"/n).read_bytes() for n in names)
assert joined==script, "JS RECONSTRUCTION MISMATCH"
assert sha(joined)==M["preservation"]["original_script_inner_sha256"], "JS HASH MISMATCH"
idx=(BASE/"index.html").read_text(encoding="utf-8")
for n in names: assert f'src="js/{n}"' in idx, f"MISSING SCRIPT: {n}"
assert 'href="css/styles.css"' in idx, "MISSING CSS LINK"
print("DEEP CHECK: PASSED")
print("Original bytes:",len(src))
print("Original SHA256:",sha(src))
print("JS exact reconstruction: PASSED")
print("CSS exact extraction: PASSED")
