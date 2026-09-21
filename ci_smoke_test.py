"""
ci_smoke_test.py
Extracts only import lines from the converted notebook script
and runs them — no DB, no dataset, no prophet needed.
"""
import sys

SKIP = [
    "prophet", "pystan", "create_engine", "engine",
    "connect(", "read_csv", "read_sql", "pd.read_",
    "plt.show", "get_ipython", "psycopg2",
]

with open("/tmp/retailiq_nb.py") as f:
    lines = f.readlines()

imports = []
for line in lines:
    s = line.strip()
    if not s or s.startswith("#"):
        continue
    if not (s.startswith("import ") or s.startswith("from ")):
        continue
    if any(p in s for p in SKIP):
        continue
    imports.append(line)

script = "".join(imports)
script += "\nprint('Smoke test passed — all standard imports OK')\n"

with open("/tmp/smoke.py", "w") as f:
    f.write(script)

print("=== Imports being tested ===")
print(script)
