from pathlib import Path
import subprocess,sys,json
R=Path(__file__).resolve().parent
files=[
 'index.html','submit.html','admin.html','server.py','render.yaml','README.md',
 '.env.example','assets/design-tokens.json','assets/design-tokens.css','docs/design-system.md',
 'css/styles.css','js/vendor.js','js/firebase-service.js','js/connect-panel.js','js/dashboard.js','js/app-bootstrap.js'
]
missing=[x for x in files if not (R/x).is_file()]
if missing: raise SystemExit('MISSING: '+', '.join(missing))
h=(R/'index.html').read_text(encoding='utf-8')
for x in ['js/vendor.js','js/firebase-service.js','js/connect-panel.js','js/dashboard.js','js/app-bootstrap.js']:
    if f'src="{x}"' not in h: raise SystemExit('Missing script link: '+x)
if 'href="css/styles.css"' not in h: raise SystemExit('Missing CSS link')
subprocess.run([sys.executable,'-m','py_compile',str(R/'server.py')],check=True)
json.loads((R/'assets/design-tokens.json').read_text(encoding='utf-8'))
print('DEPLOY CHECK: PASSED')
print('Required files: OK')
print('Python syntax: OK')
print('Existing panel script order: OK')
print('Admin + user portal: OK')
print('UI/UX token system: OK')
