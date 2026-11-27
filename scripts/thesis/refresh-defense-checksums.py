"""Fingerprint reviewed Git blobs, never platform-normalized working-tree text."""
import argparse
import hashlib
from pathlib import Path
import subprocess

p = argparse.ArgumentParser()
p.add_argument('--staged', action='store_true')
a = p.parse_args()
root = Path(__file__).resolve().parents[2]
target = 'docs/thesis-defense/evidence/checksums.txt'
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root)
old = (root / target).read_text(encoding='utf-8').splitlines()
names = {line.split('  ', 1)[1] for line in old if '  ' in line}
names.update(git('ls-files', 'docs/thesis-defense', 'scripts/thesis').decode().splitlines())
names.update(git('diff', '--cached', '--name-only').decode().splitlines())
names.discard(target)
assert 'AGENTS.md' not in names
prefix = ':' if a.staged else 'HEAD:'
lines = []
for name in sorted(names):
    assert not name.startswith(('tmp/', '.env')) and 'Private' not in name
    data = git('show', prefix + name)
    lines.append(f'{hashlib.sha256(data).hexdigest()}  {name}\n')
(root / target).write_text(''.join(lines), encoding='utf-8', newline='\n')
print(f'Fingerprint inventory: {len(lines)} reviewed Git blobs.')
