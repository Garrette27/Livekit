"""Package only reviewed public artifacts; private submission files are never inputs."""
import hashlib
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "docs/thesis-defense"
OUTPUT = PACK / "TeleConsole-Public-Defense-Pack.zip"
NAMES = [
    "docs/thesis-defense/TeleConsole-Revised-259-Pages.pdf",
    "docs/thesis-defense/TeleConsole-Panel-Questions-and-Answers.pdf",
    "docs/thesis-defense/TeleConsole-Waiting-Queue-and-Title-Defense.pptx",
    "docs/thesis-defense/TeleConsole-Waiting-Queue-and-Title-Team-Guide.pdf",
    "docs/thesis-defense/TeleConsole-Waiting-Queue-and-Title-Slides.pdf",
    "output/pdf/TeleConsole-Capacity-Cost-and-Defense-Team-Brief.pdf",
    *["docs/thesis-defense/" + name for name in [
        "capacity-quality-costs-and-team-scripts.md",
        "load-security-rbac-and-revision-answer.md",
        "messenger-and-three-writer-brief.md",
        "page-change-register.md",
        "panel-questions-and-answers.md",
        "waiting-queue-and-title-defense.md",
    ]],
]

def reviewed_blob(name):
    """Read committed bytes and refuse an unreviewed local replacement."""
    result = subprocess.run(["git", "show", "HEAD:" + name], cwd=ROOT, check=True, capture_output=True)
    subprocess.run(["git", "diff", "--quiet", "HEAD", "--", name], cwd=ROOT, check=True)
    return result.stdout

contents = {Path(name).name: reviewed_blob(name) for name in NAMES}
contents["DOWNLOADS.md"] = (PACK / "DOWNLOADS.md").read_bytes().replace(b"\r\n", b"\n")
assert len(contents) == 13 and all(contents.values())
assert not any("Private" in name or name.endswith(".zip") for name in contents)
contents["SHA256SUMS.txt"] = "".join(
    f"{hashlib.sha256(data).hexdigest()}  {name}\n" for name, data in sorted(contents.items())
).encode()
with zipfile.ZipFile(OUTPUT, "w") as archive:
    for name, data in sorted(contents.items()):
        entry = zipfile.ZipInfo(name, date_time=(2026, 11, 26, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, data)
with zipfile.ZipFile(OUTPUT) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(contents)
    assert all(archive.read(name) == data for name, data in contents.items())
print(f"Verified {len(contents)} public ZIP entries; private submission inputs excluded.")
