"""Re-rank the 100-question panel bank by defense importance (priority-order-v3).

Keeps every question and answer, keeps Q1-Q20 (the memorized set) in place,
pulls the newer high-risk administration/scheduling/device questions into the
21-40 follow-up band, renumbers 1-100 and writes an old->new number map.
Run from the repository root: python3 scripts/thesis/rerank-panel-questions-v3.py
"""
import json
import re
from pathlib import Path

PACK = Path(__file__).resolve().parents[2] / "docs/thesis-defense"
source = PACK / "panel-questions-and-answers.md"
text = source.read_text(encoding="utf-8")
assert "<!-- priority-order-v2 -->" in text, "Expected the v2 bank as input"
body, tail = text.split("## Three-writer rehearsal")
matches = list(re.finditer(r"^### (\d+)\. (.+)$", body, re.M))
questions = {}
for index, match in enumerate(matches):
    end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
    questions[int(match[1])] = (match[2], body[match.end():end].strip())
assert sorted(questions) == list(range(1, 101))

# Importance: what a capstone panel probes first, then what today's demo and
# newest changes expose. 1-20 unchanged; 21-40 next most likely follow-ups.
FOLLOW_UPS = [22, 98, 21, 92, 96, 97, 31, 28, 90, 27, 100, 23, 24, 29, 30, 26, 25, 32, 33, 34]
LATE = [91, 93, 94, 95, 99]
order = list(range(1, 21)) + FOLLOW_UPS
order += [q for q in range(21, 90) if q not in order] + LATE
assert len(order) == 100 and set(order) == set(range(1, 101))
mapping = {old: new for new, old in enumerate(order, 1)}

intro = body[: matches[0].start()]
intro = intro.replace("<!-- priority-order-v2 -->", "<!-- priority-order-v3 -->")
intro = re.sub(
    r"Current bank: \*\*100 questions\*\*\..*?\n",
    "Current bank: **100 questions**, re-ranked by importance on 28 November 2026 (priority-order-v3). "
    "Q1-Q20 are unchanged; scheduling, super-administrator privacy, clinic isolation, staff login routes "
    "and the device-menu fix moved into the Q21-Q40 follow-up band. Old numbers map to new ones in "
    "[panel-priority-order-v3-map.json](panel-priority-order-v3-map.json).\n",
    intro, count=1, flags=re.S)

renumber = lambda s: re.sub(r"\b(Q|answer |see )(\d{1,3})\b",
                            lambda m: m[1] + str(mapping.get(int(m[2]), int(m[2]))), s)
parts = [intro]
for new, old in enumerate(order, 1):
    title, answer = questions[old]
    parts.append(f"### {new}. {title}\n\n{renumber(answer)}\n\n")
parts.append("## Three-writer rehearsal" + tail)
source.write_text("".join(parts), encoding="utf-8", newline="\n")
(PACK / "panel-priority-order-v3-map.json").write_text(
    json.dumps({str(old): mapping[old] for old in range(1, 101)}, indent=1) + "\n", encoding="utf-8")

latest = PACK / "PANEL-QA-LATEST.md"
latest.write_text(renumber(latest.read_text(encoding="utf-8")), encoding="utf-8", newline="\n")
print(json.dumps({"questions": 100, "follow_up_band": [questions[q][0] for q in FOLLOW_UPS[:6]]}, indent=1))
