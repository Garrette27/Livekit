"""Select reusable, attributed computer-systems prose from the user's supplied study text."""
from pathlib import Path
import json
import re
from pypdf import PdfReader

root = Path(__file__).resolve().parents[2]
path = Path('C:/Users/garre/Downloads/Developer_Tools_and_Computer_Systems.pdf')
reader = PdfReader(path)
blocked = re.compile(r'HRMS|RideMax|django|payroll|attendance|employee|celery|omarchy|hyprland|Bulos|supabase|Pro Git|\bvideo\b|\bclip\b|\[H\d|\[R\d|Lesson \d|Chapter \d|previous lesson|next lesson|above command|below command', re.I)
candidates = []
seen = set()
for number in range(7, 189):
    text = reader.pages[number].extract_text() or ''
    lines = text.splitlines()
    pending = []
    for line in lines[2:]:
        line = line.strip()
        if not line or line.isdigit():
            continue
        # Running prose has a natural sentence ending; shell/code is not expanded
        # or padded into the prose count. Keep the user's reference text attributable.
        pending.append(line)
        if re.search(r'[.!?]["\u201d\u2019)]?$', line):
            paragraph = ' '.join(pending)
            pending = []
            paragraph = re.sub(r'^\d+\s+(?=[A-Z])', '', paragraph)
            if blocked.search(paragraph):
                continue
            if re.search(r'[`{}]|(?:^|\s)(?:sudo|docker run|git push|rm -|chmod|SELECT|INSERT|DELETE FROM)\b', paragraph):
                continue
            words = re.findall(r"\b[\w]+(?:['-][\w]+)*\b", paragraph)
            if not 30 <= len(words) <= 230:
                continue
            if sum(c.isalpha() for c in paragraph) / max(1, len(paragraph)) < .65:
                continue
            key = re.sub(r'\W+', ' ', paragraph).lower().strip()
            if key in seen:
                continue
            seen.add(key)
            candidates.append({'page': number + 1, 'words': len(words), 'text': paragraph})
out = root / 'tmp/pdfs/study-readings.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(candidates, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps({'paragraphs': len(candidates), 'words': sum(p['words'] for p in candidates)}))
