# 8. Compose safe commands and inspect their exit status

## The LiveKit boundary to trace

A shell command is a program with parsing and control flow. An invocation that
prints a reassuring line can still fail later, and a wrapper can hide the exit
status of the operation you care about. Before putting a command in a thesis
reproduction guide, identify which program's status is being returned and where
its standard output and standard error go.

The maintained verification runner executes checks separately, stores their
logs and records each exit code. This is more useful than chaining several
checks and reporting only the last one's result. It also allows a failed
dependency audit to remain visible while unrelated policy, lint and build
results are recorded honestly. A red job is a reason to inspect its failed
step, not a reason to rename every result a failure.

## A worked local investigation

Suppose security tests fail but a later echo prints complete. Do not use that
word as acceptance evidence. Run the test directly, record its exit status,
and read the failing assertion. If a runner intentionally continues after
failure to collect several results, its final status should still reflect
whether every required gate passed. Continuing observation and declaring
success are different decisions.

Quoting errors deserve the same discipline. A regular expression intended to
match a carriage return can become a literal letter after crossing several
interpreters. A bulk rewrite then corrupts source instead of normalizing line
endings. Prefer explicit patch tools for source edits. For mechanical
formatting, inspect a small diff before applying the operation broadly and
keep unrelated files out of the target set.

## Exercise with answer

You need to compare two rule files and deploy only the reviewed Firestore
rules. Which command scope is safer: the whole Firebase project or the
explicit firestore:rules target? The explicit target expresses the approved
operation and avoids releasing Functions, Storage rules or indexes merely
because they share a configuration file. Verify the project identifier before
the write. A default project alias is convenient, not a substitute for
checking the destination of a production action.

Now design a safe failure demonstration. Use a synthetic local test that exits
nonzero, capture its status and retain its message. Do not deliberately break
the live database to prove your wrapper notices an error. The notebook should
state whether the command was a read, an emulator operation or a production
write; otherwise a future reader can reproduce the wrong kind of experiment.

## Preserve structure across command boundaries

Suppose you need a report of failing test cases. One approach prints human-readable output, searches for the word “fail,” and counts matching lines. Another consumes the test runner's structured result and counts cases whose status is explicitly failed. The first approach may count an explanation containing “fail closed,” miss a differently formatted failure, or include a historical baseline. The second still needs schema validation, but it preserves the meaning of the field instead of guessing from appearance.

The same distinction applies to command arguments. A filename containing spaces is one value, not several words that happen to be adjacent. Quoting preserves the shell boundary, but the receiving tool may still interpret a leading hyphen as an option. A JSON string, regular expression, URL and shell argument each have different escaping rules. Do not assume that safely quoting one layer makes the value valid at every later layer. Trace which parser receives the bytes next.

When invoking WSL from PowerShell, there can be several parsers: PowerShell constructs arguments for the launcher, the launcher selects a Linux command, and Bash may parse another command string. Avoid composing destructive operations through that stack. Keep filesystem operations in one shell with literal paths and read-only validation first. For teaching experiments, use a disposable directory created for the exercise, never a broad home directory or project root as a deletion target.

## Exit status is evidence with a defined boundary

A command can print an error and exit successfully if its author chose that behavior. It can also exit nonzero for a condition that is expected in the workflow, such as a search finding no matches. Therefore, inspect the tool's documented semantics and the relevant output. A process exit status reports termination under that interface; it does not independently prove the business invariant you care about.

Pipelines add another trap. In some shells, the pipeline status defaults to the last stage, so a successful formatter can hide an earlier failing producer. Even when pipeline failure detection is enabled, it covers that pipeline, not every asynchronous process or nested command substitution. Capture the status at the boundary where it matters and avoid printing another command's status accidentally. A test report should preserve the runner's exit result, not only the success of the command that displayed its log.

Keep machine-readable results on the intended output channel and diagnostics separate. If a helper prints a friendly banner before JSON on standard output, a downstream parser can fail even though the JSON fragment itself is valid. This resembles the browser symptom of receiving HTML where JSON was expected: the consumer's parse error identifies a contract mismatch, not necessarily the original failure. Inspect the complete response type and producing stage.

## A synthetic reporting exercise

Use two small synthetic result files, one passing and one containing a deliberate failure. Define the expected count before writing the reducer. Then supply malformed JSON, a missing field and an unknown status. Decide explicitly whether the report rejects the input or records an unknown category. Do not silently treat malformed input as zero failures. That would make the least trustworthy data produce the cleanest-looking result.

Publish the completed report only after validation succeeds. A temporary output and final replacement can prevent readers from seeing a half-written report, but atomic publication is not the same as durability or concurrency control. Another writer may still publish a different valid report later. If that matters, add an explicit version or ownership policy rather than assuming that a rename solves every race.

Finally inspect the report's own wording. “No failing cases were returned by these inputs” is narrower than “the application is secure.” Include input identity, scope and exclusions. Command composition becomes reliable when each stage preserves structure and each conclusion stays within the stage's guarantee. A clever one-liner that obscures those boundaries is not necessarily an improvement over a small readable script.

## Foundational systems reading - adapted companion material

These adapted shell readings explain parsing, arguments, streams and publication. Bash and Python examples are supporting systems models rather than LiveKit implementation listings. Preserve each interpreter boundary when translating an exercise into your own shell.

## Supplied systems reference - page 13

Formatting is often a one-way loss of information. A human-readable table can truncate a value, round a number, or insert spaces. Parsing that table may produce an apparently successful script whose assumptions fail on another input. Keep structured data structured when possible. In PowerShell, postpone Format-Table until presentation. In Python, parse CSV with the CSV module and JSON with the JSON module. In Bash, let a structured-data program own the relevant parsing.

Crossing into a native executable adds another boundary. PowerShell versions have changed some native argument and redirection behaviors. A PowerShell object pipeline does not magically pass .NET objects into a Linux program launched through wsl.exe.

A similar-looking command is not proof of equivalent semantics. An alias named ls in PowerShell may invoke a PowerShell command whose options differ from GNU ls. Use Get-Command to identify the receiver of the command.

## Supplied systems reference - page 19

When you type a command, the program does not receive the visible command line as one string. Bash first recognizes words and operators, parses a command structure, expands its words, arranges redirections, and executes the resulting command. That sequence explains why a quoted semicolon can be data while an unquoted semicolon separates commands. Redirection syntax belongs to Bash and is removed from the arguments delivered to the program. For an external Linux executable, the useful interface is an argument vector: an ordered sequence of strings. Argument boundaries survive execution; the original choice of single quotes, double quotes, or backslashes does not. The kernel interface uses NUL terminated strings, so an individual argument cannot contain a NUL byte. Spaces and newlines are allowed inside an argument. A program may subsequently interpret an argument as an option, filename, expression, or configuration value according to its own rules.

## Supplied systems reference - page 20

There are therefore two parsers to consider. Bash interprets shell syntax; the selected command interprets its arguments. In rg -F 'annual leave' report.txt, Bash makes four words, and ripgrep decides what -F means. Quotes preserve one pattern argument but do not make that pattern immune to ripgrep's interpretation. Likewise, quoting a filename beginning with a hyphen preserves its bytes without necessarily preventing a command from treating it as an option.

Removing quotes is not equivalent to removing characters from the final argument. Quotes originally participate in parsing and expansion. Also, a semicolon stored inside a variable does not automatically become a command separator when that variable expands; Bash does not normally parse expansion results again as shell source.

## Supplied systems reference - page 21

The unquoted expansion rules depend on context. An assignment such as message=$other does not perform the ordinary word splitting and pathname expansion applied to command arguments. [[ ... ]] also has different expansion rules. Avoid transferring a rule from one syntactic position to another merely because the same dollar sign appears in both. For external command arguments, "$value" is the normal choice when the value represents one item.

Command substitution has another boundary: it collects stdout and removes trailing newline characters. Internal newlines remain, but the exact original ending cannot be recovered from the resulting value. A shell variable also cannot store NUL bytes. This makes command substitution useful for small textual results, such as a synthetic label, but unsuitable as a general transport for arbitrary file contents. For binary data or a large export, keep the data in a file or stream instead of forcing it through a shell variable.

## Supplied systems reference - page 22

Quoting protects shell boundaries; it does not validate a value for SQL, JSON, a regular expression, or another interpreter. Avoid building a command string and feeding it to eval. An array of arguments preserves the intended structure without a second round of shell parsing.

A relative path is interpreted from a process's current working directory. That directory is inherited when a child starts; it need not contain the script. An absolute Linux path begins at /. Under WSL, a Windows path such as C:\work is not interchangeable with /mnt/c/work. Case behavior and permissions depend on the filesystem. Home directory fixtures avoid relying on a particular Windows mount configuration.

A glob selects pathnames. In a normal Bash pathname pattern, * matches a sequence within one component, ? matches one character, and bracket syntax specifies a character set. A slash separates components and must be matched explicitly. Initial dots require explicit matching unless relevant shell settings change the default. A plain ** does not promise recursive traversal; Bash's globstar option gives that form its recursive role.

## Supplied systems reference - page 24

A process has a table of file descriptors. By convention, descriptor 0 is standard input, 1 is standard output, and 2 is standard error. These handles can refer to terminal devices, files, pipes, or other resources. <source replaces descriptor 0, >destination replaces 1, and 2>diagnostics replaces 2. An inherited descriptor tells a program where its bytes go without requiring knowledge of the shell spelling.

For a regular file, a descriptor refers through the kernel to an open file description containing state such as the current offset. Duplication makes another descriptor refer to that same open description. In 2>&1, the ampersand tells Bash to duplicate descriptor 1 onto descriptor 2. It does not name a file called 1, and it does not install a permanent relationship saying that stderr must follow future changes to stdout.

Bash applies redirections from left to right. In >result 2>&1, descriptor 1 first becomes the open output file; descriptor 2 then duplicates that connection. In 2>&1 >result, descriptor 2 first duplicates the original stdout destination; only descriptor 1 then moves to the file. This distinction remains true if the original stdout destination is itself a pipe rather than a terminal. Redirection also happens before the program starts. Opening with > normally truncates an existing output file immediately. A program that then fails may leave an empty or partial file. Appending with >> changes that opening behavior but does not make an operation transactional. Keep diagnostics separate from machine readable stdout: a warning inserted into JSON can make an otherwise successful consumer reject it.

## Supplied systems reference - page 25

stdout is a designated channel, not a synonym for the screen. stderr is another channel, not a special class of bytes that the kernel recognizes as errors. After merging both streams, ordinary downstream reads cannot recover their original channel identities.

A pipe connects a writer's bytes to a reader. producer | consumer is not shorthand for completing the producer, storing everything, and then starting the consumer. The processes can run concurrently. A pipe has bounded buffering: when that buffer fills, a blocking writer waits for room; when it is empty but writers remain, a blocking reader waits for data. This pressure propagates upstream when a consumer cannot keep pace.

The stream has no inherent concept of CSV rows, objects, or lines. Programs implement those boundaries. One write need not correspond to one read. A producer can have bytes in its userspace buffer that have not reached the kernel pipe. A program that prints promptly to a terminal may delay output when connected to a pipe, depending on its buffering policy.

End of file also has a concrete condition. The reader sees it when buffered data has been consumed and every open copy of the pipe's write end has closed. A stray descriptor kept open by another process can therefore leave a reader waiting even after the apparent producer has finished. Think in terms of handle lifetime, not merely the lifetime of the process whose name you recognize.

## Supplied systems reference - page 26

A pipe provides bounded kernel buffering, not a bound on the entire pipeline's memory consumption. A consumer that calls read() with no size can still accumulate its whole input. Backpressure also does not imply that every stage is equally busy or equally fast.

Why can a reader wait after the producer exits? Another process may still hold an open write descriptor. EOF requires all write ends to close, after the remaining buffered bytes are read.

## Supplied systems reference - page 27

In Bash, the rightmost pipeline stage means its position in the pipeline, not the process that finished last. PIPESTATUS exposes individual stage statuses, but the next command replaces it; capture it immediately. Even an apparently harmless assignment or status-printing command counts as the next command.

These mechanisms report termination, not correctness. A parser that accepts a malformed business identifier can exit zero. A producer can emit half its intended dataset and incorrectly report success. pipefail neither validates the result nor rolls back an output file, and it does not promise to cancel every stage as soon as one fails.

Early termination can create legitimate nonzero statuses. head reads the requested prefix and closes its input. A writer that subsequently writes into a pipe without readers receives SIGPIPE unless its signal policy changes that behavior. A producer such as GNU yes normally terminates under that signal; Bash commonly reports 128 plus signal number 13, giving 141.

## Supplied systems reference - page 28

pipefail observes only stages in that pipeline. It does not automatically include the status of a producer started by process substitution, such as the command inside < <(...). Nor does it make a background launch's immediate status equivalent to the eventual job outcome; that requires waiting.

A shell variable belongs to a shell process. An environment entry is a name and string value passed when an external command starts. Bash maintains an export attribute that determines which variables participate in that environment. A newly assigned ordinary variable need not be visible to Python; an exported one normally is. A variable inherited through the environment starts with the export attribute in Bash. Inheritance is a snapshot, not a shared dictionary. A child can change its own environment without updating the parent, its siblings, or an already running service.

Starting another process later can pass a newer value because the parent constructs that later environment from its current state. This is the same distinction you use when reasoning about process address spaces: similar initial contents do not imply shared mutable storage.

## Supplied systems reference - page 29

If two children start before and after LAB_MODE changes, must they see the same value? No. Each receives the value supplied at its own creation; neither observes subsequent parent assignments automatically.

## Supplied systems reference - page 30

A reproducible script states its interpreter and its assumptions. A Bash shebang can select Bash when the file is directly executed, but sh script.sh explicitly selects sh and bypasses that choice. On Ubuntu, sh is commonly a different implementation.

Establish where relative inputs come from, check required tools, and diagnose missing settings at the boundary. Reproducibility requires identifying environment entries that affect the result. For experiments, a small environment helps isolate a cause. Application launchers should preserve their documented environment and supply explicit configuration. Disabling profile and rc files does not itself neutralize BASH_ENV for a noninteractive invocation.

A syntax check does not verify tool availability, input schemas, permissions, or runtime branches. Likewise, a valid shebang does not control an explicit sh file invocation. State the supported entry point and test it in the environment that will actually launch the script.

## Supplied systems reference - page 31

Why might an alias defined in .bashrc be unavailable to a Bash script? A normal noninteractive invocation does not simply replay interactive startup, and alias expansion also has its own interactive default. Use a real function or executable with an explicit dependency contract.

Start code investigation by identifying candidate files, then search their contents. rg -- files answers which pathnames belong to the search universe. A content search locates literal or regular expression matches within that universe. Both operations need a scope.

## Supplied systems reference - page 32

Finding every occurrence of a word in the selected files does not find every possible use of the underlying object. Conversely, additional matches do not necessarily indicate additional executable references. Preserve that distinction when estimating the risk of a rename or migration.

## Supplied systems reference - page 33

Parsing and validation are separate. A parser can produce a row with the wrong field count, missing identifier, or invalid decimal. Establish the expected header and field count, then convert values according to the schema. For decimal arithmetic, build Decimal from the original text without an intermediate binary float. Validate special values such as infinity. Large magnitudes and many significant digits also require an appropriate Decimal context precision.

A reduction accumulates a smaller result from records. A synthetic departmental report might retain a count and a total per department. Reading one row at a time avoids retaining every record, although the dictionary grows with distinct departments. Choose the accumulator according to the question. A total discards details; identifying which record contributed an unexpected amount requires rereading input or preserving a separate audit trail.

JSON makes output structure explicit but does not invent a schema. A report can deliberately encode decimal totals as strings; consumers must follow that contract. The standard encoder handles control characters safely. Printing a Python dictionary produces Python syntax rather than JSON; manually assembling strings reintroduces escaping mistakes. Keep diagnostics on stderr so stdout remains one valid JSON document. Bash can coordinate files and processes while a format-aware program owns record boundaries and numeric meaning.

## Supplied systems reference - page 34

A CSV validator that checks header, field count and numeric values does not thereby establish that identifiers are unique or departments are authorized values. Successful parsing and those particular checks justify only those particular guarantees. Add schema rules because the workflow requires them, not because a filename ends in .csv.

A shell wrapper preserves structure while adding a label, environment setting, or output destination. A function normally executes in the calling shell, so directory changes or assignments can persist after it returns. local limits variable scope within Bash function calls. A separately executed script cannot simply assign values back into the calling shell.

Positional parameters describe the current argument vector: $# is its count, $1 its first item, and shift removes the first item from that vector. "$@" forwards each remaining item as its own argument, preserving empty values and internal whitespace. "$*" instead makes one joined string. That distinction is structural; no later splitting operation can reliably reconstruct arbitrary boundaries once values have been joined.

## Supplied systems reference - page 35

A shell wrapper should preserve the command as an argument vector. If it removes a label argument and invokes the remaining quoted argument vector, the first remaining item identifies the command and the rest become its arguments. The wrapper should not reinterpret embedded wildcards or shell operators.

Return the command's status by making it the last operation, or capture its status before printing anything else. Use return to leave a function. An exit inside a function running in your interactive shell can end that shell instead of returning a failed status to the caller.

A quoted value beginning with - can still be an option to the receiving command. Preserve boundaries with quoting, then use that command's supported option terminator, such as GNU cp --, where appropriate. There is no universal promise that every executable understands -- identically.

Why does "$@" preserve an empty argument that $@ may lose? The quoted form preserves one word per positional parameter. Ordinary unquoted expansion can apply splitting and remove empty results.

## Supplied systems reference - page 36

Atomicity answers a different question: what intermediate state can another observer see? Directly redirecting output onto an existing configuration file truncates it before writing finishes. Creating a complete temporary file and renaming it into place on the same filesystem can publish the new pathname in one replacement step. Existing readers with the old file already open can continue reading the old object; later opens find the new one. This is a property of publication, not a transaction spanning several independent files. Create temporary files in the destination directory so the final move stays on that filesystem, and check creation, writing, and replacement outcomes explicitly. mktemp avoids a predictable temporary filename. A cleanup trap removes the unpublished file on ordinary exit. Crash durability is a further requirement: a successful rename alone is not proof that file data and directory changes survive sudden power loss. That requires appropriate synchronization and a filesystem specific analysis.

Linux filenames can contain spaces, newlines, and leading hyphens, but not NUL or / within a component. Do not parse ls output or transport arbitrary filenames as newline separated text. NUL framing preserves boundaries; argument arrays preserve them inside Bash. Quoting prevents splitting; an option terminator or path prefix prevents option confusion when supported. These techniques cannot secure traversal against an attacker replacing directories or symlinks concurrently. Our fixture directory is controlled by you.

## Supplied systems reference - page 37

Comparing contents does not guarantee that two concurrent writers agree on the intended state. A single atomic replacement does not serialize a read modify write sequence. Locks, version checks, or a database transaction may be needed for a broader invariant, and cleanup cannot run after every possible termination.

Why put the temporary file beside its destination? A rename can publish it atomically within one filesystem. A cross filesystem move may instead require copying and removing, exposing different intermediate behavior.

## Supplied systems reference - page 38

Build a report from two synthetic CSV files, publish it only after validation succeeds, and then deliberately introduce a duplicate identifier. Your contract is concrete: every input has the exact header, three fields per record, a nonempty unique identifier, and finite nonnegative decimal hours. stdout contains one JSON document; stderr carries diagnostics. A failed run must leave the previous published document intact.

## Source trail

Inspect scripts/thesis/deploy-reviewed-rules.mjs and verify-remediation.mjs.
Their existence is not permission to deploy. The authorized scope must come
from the task, while the script makes that scope explicit and reproducible.
