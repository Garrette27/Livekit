"""Mechanically reorder the complete question bank without dropping legacy topics."""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "docs/thesis-defense"
source = PACK / "panel-questions-and-answers.md"
text = source.read_text(encoding="utf-8")
ranked = "<!-- priority-order-v1 -->" in text
text = text.split("## Practice method for three writers")[0]
matches = list(re.finditer(r"^### (\d+)\. (.+)$", text, re.M))
questions = {}
old_priority_ids = {}
for index, match in enumerate(matches):
    end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
    answer = text[match.end():end].split("\n## ")[0].strip()
    marker = re.search(r"<!-- legacy-question: (\d+) -->", answer)
    stable_id = int(marker[1]) if ranked and marker else int(match[1])
    old_priority_ids[int(match[1])] = stable_id
    answer = re.sub(r"<!-- legacy-question: \d+ -->\s*", "", answer)
    questions[stable_id] = (match[2], answer)
assert set(range(1, 82)) <= set(questions), "Preserve all existing 81 questions"
config = json.loads((PACK / "panel-priority-order.json").read_text(encoding="utf-8"))
for item in config["added"]:
    questions.setdefault(item["id"], (item["title"], item["answer"]))
order = config["order"]
assert len(order) == len(set(order)) and set(order) == set(questions)
mapping = {old: new for new, old in enumerate(order, 1)}
intro = """# Panel questions and answers: priority study order

27 November 2026. <!-- priority-order-v1 -->

Start with question 1. This priority order is an engineering judgment based on scope, unsupported claims, privacy, access control and demonstration risk. It is not an empirical prediction of what a panel will ask and does not guarantee a grade. All 81 prior topics are retained, plus administrator, bilingual, retention, lifecycle and responsive-design questions. Read the first 20 before the detailed follow-ups.

Reviewed source: `ec6803a` (role separation, encounter state and responsive layout). Existing queue evidence is dated and local; neither these answers nor a Ready deployment establish production load, clinical accuracy, security certification or multi-clinic clinical validation. No survey number or objective is changed. The [number map](panel-question-number-map.md) links older Q references to this order. Historical guides may retain those legacy references.

Use a 20-40 second answer: current rule, reason, specific evidence, limitation. Distinguish recorded results from proposed next tests. Provision only synthetic demonstration accounts; never show real patient records.

"""
parts = [intro]
for new, old in enumerate(order, 1):
    title, answer = questions[old]
    answer = re.sub(r"\b(answer|see) (\d+)\b", lambda m: m[1] + " " + str(mapping.get(old_priority_ids.get(int(m[2]), int(m[2])) if ranked else int(m[2]), int(m[2]))), answer)
    parts.append(f"### {new}. {title}\n\n<!-- legacy-question: {old} -->\n\n{answer}\n\n")
parts.append("## Three-writer rehearsal\n\nWriter 1 explains contribution, research scope and evidence. Writer 2 explains authorization, admission and privacy. Writer 3 explains load units, AI/language limits and failure recovery. Everyone rehearses questions 1-20, then rotates roles. For every demo step, name whether it proves UI behavior, a server denial, a local invariant or a measured production result.\n")
source.write_text("".join(parts), encoding="utf-8", newline="\n")
register = ["# Panel question number map\n\n27 November 2026. Prior Q ids are stable historical references, not the new study order. No topic was removed. Added questions have stable ids 82 onward.\n\n| Prior Q id | Priority number | Topic |\n| --- | --- | --- |\n"]
for old in sorted(questions):
    register.append(f"| {old} | {mapping[old]} | {questions[old][0].replace('|', '/')} |\n")
(PACK / "panel-question-number-map.md").write_text("".join(register), encoding="utf-8", newline="\n")
print(json.dumps({"question_count": len(order), "prior_topics_retained": 81, "added": len(questions) - 81, "first_question": questions[order[0]][0]}))
