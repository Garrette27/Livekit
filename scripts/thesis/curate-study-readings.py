"""Produce a reviewable pool of standalone, attributed foundational readings.

The source is supplied by the user. This is extraction, not new LiveKit evidence;
commands, unrelated product cases and dangling cross-references are excluded.
"""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]
rows = json.loads((ROOT / 'tmp/pdfs/study-readings.json').read_text(encoding='utf8'))
bad = re.compile(
    r"mkdir|printf|python3 -|cat >|uname -r|Get-Process|LAB_MODE=|while \[|"
    r"\bimport \w|sys\.|git (?:init|add|commit|rev-parse|remote -v)|"
    r"\bV[12]\b|\bDay\b|pay.code|workday|badge|punch|leave types|"
    r"this fixture|the fixture|the inspected|expected observation|expected result|"
    r"after the fixture|these commands|following command|above|below|"
    r"\[B\d|\[R\d|\bLESSON\b|Lessons? \d|For Garrette|Your terminal|"
    r"Your expected|Chapter experiment|Appendix [ABC]|Return to lessons|"
    r"the first list|the second list|the reducer|l\d+/|this chapter|chapter's",
    re.I,
)
prefixes = [
    'Terminal shell editor and operating system', 'Filesystem location changes meaning and cost',
    'A command name is a resolved request', 'Focus and tiling determine the receiver of input',
    'Build a small dependable baseline', 'Turn observation into an experiment',
    'Command parsing and argument vectors', 'Paths globs and regular expressions',
    'Standard streams and redirection order', 'Pipes concurrency and backpressure',
    'Variables export and environment inheritance', 'Search and the limits of text matching',
    'Functions scripts arrays and argument forwarding', 'Idempotent setup atomicity and hostile filenames',
    'Follow a process tree through fork and exec', 'Stop work with job control and signals',
    'Separate tmux sessions from terminal windows', 'Distinguish pathnames inodes and open files',
    'Read permissions at the directory boundary', 'Keep bytes code points and lines distinct',
    'Locate files across WSL and Docker mounts', 'Observe system calls without confusing buffering',
    'Measure latency with a discriminating hypothesis', 'Modal editing state and dispatch',
    'Operators motions counts and text objects', 'Save undo redo swap recovery and disk state',
    'Registers clipboard ownership and WSL differences', 'Search regex substitution ranges and confirmation',
    'Ex commands global and quickfix workflows', 'Tags LSP symbols lexical semantic and runtime evidence',
    'Navigation jumplist marks and project search', 'Configuration runtime paths plugin costs and mappings',
    'Deliberate practice debugging the editor and gradual Neovim adoption',
    'Source history and application state are different records', 'Status and diff describe different comparisons',
    'A commit graph is a history of snapshots', 'Branches and remote tracking references are movable names',
    'Detached HEAD and worktrees support isolated experiments', 'Merge state explains abort and quit',
    'Tracebacks expose a call path and a failure point', 'Profiling connects cost to repeated work',
    'Specify which localhost you mean', 'Read TCP as a byte stream with explicit framing',
    'Verify TLS trust and hostname separately', 'Interpret methods status codes and uncertain retries',
    'Trace browser behavior from DOM to request', 'Separate cookies sessions CSRF CORS and origins',
    'Identify which source controls the rendered interface', 'Troubleshoot with the narrowest useful experiment',
    'Identity keys and relationships establish a model',
    'Indexes accelerate selected access paths and enforce some rules',
    'Isolation defines what concurrent operations can observe', 'Optimistic versions detect stale human decisions',
    'Separate images containers filesystems and kernels', 'Read Compose ports networks environment and volumes',
    'Isolate project names ports and storage', 'Reproduce dependencies builds and artifact identity',
    'Change schemas with a compatibility window', 'Design retries acknowledgements and outbox limits',
    'Preserve useful logs with correlation and redaction', 'Measure observability cost and choose useful signals',
    'An abstraction has a contract and a cost', 'AI assistance is another interface to verify',
    'Choose tools from a measured need', 'Keep knowledge as runnable explanations',
    'Five omissions that deserve early attention', 'A precise investigation note',
]
selected = []
adaptations = {
    78: "In Bash, the rightmost pipeline stage means its position in the pipeline, not the process that finished last. PIPESTATUS exposes individual stage statuses, but the next command replaces it; capture it immediately. Even an apparently harmless assignment or status-printing command counts as the next command.",
    80: "Early termination can create legitimate nonzero statuses. head reads the requested prefix and closes its input. A writer that subsequently writes into a pipe without readers receives SIGPIPE unless its signal policy changes that behavior. A producer such as GNU yes normally terminates under that signal; Bash commonly reports 128 plus signal number 13, giving 141.",
    95: "A reduction accumulates a smaller result from records. A synthetic departmental report might retain a count and a total per department. Reading one row at a time avoids retaining every record, although the dictionary grows with distinct departments. Choose the accumulator according to the question. A total discards details; identifying which record contributed an unexpected amount requires rereading input or preserving a separate audit trail.",
    96: "JSON makes output structure explicit but does not invent a schema. A report can deliberately encode decimal totals as strings; consumers must follow that contract. The standard encoder handles control characters safely. Printing a Python dictionary produces Python syntax rather than JSON; manually assembling strings reintroduces escaping mistakes. Keep diagnostics on stderr so stdout remains one valid JSON document. Bash can coordinate files and processes while a format-aware program owns record boundaries and numeric meaning.",
    97: "A CSV validator that checks header, field count and numeric values does not thereby establish that identifiers are unique or departments are authorized values. Successful parsing and those particular checks justify only those particular guarantees. Add schema rules because the workflow requires them, not because a filename ends in .csv.",
    100: "A shell wrapper should preserve the command as an argument vector. If it removes a label argument and invokes the remaining quoted argument vector, the first remaining item identifies the command and the rest become its arguments. The wrapper should not reinterpret embedded wildcards or shell operators.",
    170: "A bounded arithmetic workload consumes user CPU with machine-dependent duration. A sleeping process can show little cumulative CPU time while substantial elapsed time passes. A socket listing is a separate inventory of listeners, not evidence that a sleeping process owns any of them. Process attribution requires an appropriate observation and sufficient permissions.",
    178: "Include process exit status when judging whether a producer completed. An artifact left on disk can predate the current attempt, so its existence alone cannot establish that the requested work succeeded.",
    188: "In Vim, word depends partly on iskeyword; WORD treats nonblank runs differently. Inclusive and exclusive rules have documented boundary exceptions, particularly when a motion ends at column one. Doubled operators such as dd operate on lines. Also, cw has special historical behavior, so do not assume every change command is mechanically a deletion followed by insertion. The ciw operation offers an explicit inner-word target for practice.",
    189: "Confusing buffers, windows and tab pages makes navigation feel dangerous and some destructive commands seem harmless. For a first working arrangement, one window is enough. Add a split when you need two positions visible at once. Add a second buffer when you need another document. Add tab pages when separate layouts serve separate tasks. This order keeps the concepts attached to real needs. A tab page need not correspond to one file, and a buffer need not currently appear anywhere on screen.",
    196: "Registers are named storage slots used by editing commands. The unnamed register supplies a normal p or P when no other register is selected. Deletes and changes can replace its contents, so recovering an earlier copy requires a more precise intention. Register 0 retains the most recent yank that did not explicitly target another register. The black-hole register accepts deleted text without retaining it in the ordinary deletion registers. Clipboard integration is a further boundary whose behavior depends on the editor build and operating environment.",
    232: "For each proposed call-graph edge, record its basis: explicit call, imported binding, attribute access, textual coincidence, tag destination or language-server suggestion. Follow the actual code toward a request entry and the service boundaries relevant to the question. Do not force every function into a preferred architecture when the evidence shows a different arrangement. Use simultaneous editor views only when they preserve useful context.",
    272: "Choose the relationship before the Git command. To ask what changed between two snapshots, compare their trees directly. To ask what an unmerged branch contributes relative to its integration branch, a merge-base comparison can be suitable. To ask which commits a local branch has not received, use an appropriate reachability query. These are different questions even when their output sometimes looks similar.",
    284: "A useful change description states the concrete trigger, resulting behavior and relevant verification. It should let a reviewer understand the contract without replaying the author's conversation. Code style alone cannot communicate why an operation must preserve an existing decision or why a query requires a particular scope.",
    302: "Parsing, representation and execution are distinct levels of evidence. Development tools expose them through source syntax in an editor, symbols in a language server, code objects in a debugger, and machine instructions or system calls in lower-level inspection. Choose the representation that can answer the current question.",
    325: "Change one assumption at a time using a test whose possible outcomes point to different next steps. This avoids random configuration edits and browser-policy folklore. Separate transport reachability, message semantics, browser access rules, rendering behavior and asynchronous completion while retaining a connected account of the user's action.",
    329: "Windows-to-WSL localhost behavior depends on the WSL version, networking mode and firewall configuration. Microsoft documents typical NAT and supported mirrored-networking behavior, but a particular machine still needs its own observation. Test the Windows browser separately from a Linux command-line client rather than assuming that one successful path proves the other.",
    343: "Certificate verification is not the same test as a live TLS handshake or browser compatibility. Trusting a certificate and accepting its hostname are distinct checks. A real service can also present intermediate certificates, select a certificate using SNI and negotiate protocol parameters. Testing by an IP address can change the requested identity and SNI behavior, so it is not always equivalent to testing the original hostname.",
    345: "A sequential idempotency demonstration that returns one stored row on retry is not a production deduplication implementation by itself. Simultaneous requests require an atomic uniqueness strategy, and real systems must define key scope, retention, payload equivalence and result storage. A key without such rules is merely a header with a hopeful name.",
    436: "Compose uses service names for peer discovery on its networks. A peer can use a service name and internal port while a host client uses the explicitly published host port. A host port does not become the internal service port merely because both reach one application. Likewise, .env interpolation helps construct the Compose model, while container environment values require explicit configuration. Volumes preserve data across container replacement, but preservation is not a backup.",
    441: "Distinct container projects and storage names do not establish security isolation against a user with daemon access. They also do not prove that two applications use different external databases when configuration points to the same endpoint. Review every shared dependency, including brokers, databases, object stores, email sinks, callback URLs and external volumes.",
    442: "Name collision is especially subtle when two application copies share a synthetic database inadvertently. A successful page load can conceal cross-project writes. A useful staging check uses a distinct harmless fixture marker through each copy and verifies that each reads only its intended marker. Do not perform this mutation against production merely to inspect configuration.",
    452: "Source files, built artifacts and process-loaded code can disagree without Git being broken. Pulling new files does not necessarily reload imported Python modules, and rebuilding an image does not replace an existing container. A release check must reach the processes actually serving requests and consuming tasks.",
}
for index, row in enumerate(rows):
    if 131 <= row['page'] <= 145 or 172 <= row['page'] <= 174 or row['page'] >= 177:
        continue
    if index in {263, 264, 289, 318, 363}:
        continue
    text = adaptations.get(index, row['text'])
    if bad.search(text) or not text[0].isupper():
        continue
    if text.startswith(('The expected', 'Now ', 'Afterward', 'Finally ', 'Then ', 'This separation',
                        'This matters', 'This combines', 'This lesson', 'These details', 'Its current',
                        'The order is', 'The loop ', 'The script ', 'The subshell ', 'The lessons ',
                        'By the end', 'The central question', 'The experiments ', 'For a first')):
        continue
    text = re.sub(r'\s*\[[A-Z]\d+\]', '', text)
    text = text.removeprefix('Capstone lab A reliable fixture report ')
    text = text.removeprefix('Archaeology connects a line to its contract ')
    text = text.removeprefix('Names references and mutation are separate ideas ')
    text = text.replace('non- sensitive', 'non-sensitive').replace('engine- specific', 'engine-specific')
    text = text.replace('user- space', 'user-space').replace('Raw- mode', 'Raw-mode')
    for prefix in prefixes:
        if text.startswith(prefix + ' '):
            text = text[len(prefix):].lstrip()
            break
    text = re.sub(r'^(?:Precision check|Practice and answer|Question and answer)\.\s*', '', text)
    text = text.replace('tamper- proof', 'tamper-proof').replace('in- progress', 'in-progress')
    text = re.sub(r'[\u2010-\u2015]', '-', text).replace('\u2019', "'").replace('\u2018', "'")
    text = text.replace('\u201c', '"').replace('\u201d', '"')
    words = len(re.findall(r"\b[\w]+(?:['-][\w]+)*\b", text))
    selected.append({'id': index, 'page': row['page'], 'words': words, 'text': text})
out = ROOT / 'tmp/pdfs/curated-readings.json'
out.write_text(json.dumps(selected, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps({'paragraphs': len(selected), 'words': sum(x['words'] for x in selected)}))
