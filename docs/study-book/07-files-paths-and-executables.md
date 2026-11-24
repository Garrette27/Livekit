# 7. Files, paths, permissions and executable identity

## The LiveKit boundary to trace

A path is interpreted within an environment. The Windows workspace view can
show the Ubuntu repository through a UNC share, while a Linux process sees
/home/garre/Livekit. A package installation under a Windows directory is not
automatically the package installation used by a Linux build. Treat file
identity and executable identity as questions to inspect, not visual
similarities to trust.

Generated Next.js files create another distinction. They are real filesystem
objects but not the authoritative source of your feature. Editing a generated
route or type file can disappear on the next build. If a typecheck complains
about missing generated files, check whether a dev server or build is
concurrently replacing .next before assuming the application contains a type
defect. A stable sequential check is a useful control.

## A worked local investigation

Create a clean verification worktree only after checking existing working
state. The original checkout can contain a user-modified AGENTS.md, archives
and diagnostic logs. Those changes belong to their owner. A clean worktree
lets you test committed source without silently discarding them. Record
whether dependencies were installed cleanly or symlinked from another
checkout, since that difference affects reproducibility.

When a file changes, compare its content or hash rather than only its
modification time. Line-ending conversion can change object bytes while
leaving readable source effectively equivalent. A rules comparison in this
project explicitly documents normalization of carriage returns and surrounding
whitespace. Do not silently use that normalization for binary artifacts or
for a case where whitespace is semantically meaningful.

## Exercise with answer

Two developers report the same branch name but different behavior. Is the
branch name sufficient evidence that they ran identical code? No. They may
have different commits, dirty files, generated output or installed dependency
trees. Ask for the commit, relevant diff and runtime receipt. Do not ask for
production secrets. A screenshot of the editor tab proves little about the
process that served the browser request.

A report contains a hash for firestore.rules. Decide whether it names raw
file bytes or normalized source. Either can be useful if the method is stated.
The mistake is comparing a normalized hash to a raw-byte hash and treating
their difference as proof of different policy. The method belongs in the
evidence record next to the digest, not only in the investigator's memory.

## Follow a file from the editor to the build

Choose a harmless documentation file in a disposable exercise directory. Open it in two editor views, change the in-memory text in one view, and inspect the disk from a separate read-only command. The disk still contains the last saved version until the editor writes. This distinction matters when a build appears to ignore a correction. The compiler reads a filesystem path, not the text you can currently see in an unsaved buffer. Two editor windows may show one buffer, two buffers for one file, or two different paths with similar names.

Save the file, then undo the edit without saving again. The visible buffer and disk now disagree in the opposite direction. A Git diff reports the filesystem state, not necessarily the editor's unsaved state. This small exercise explains why “I reverted it in the editor” is not sufficient evidence that a test ran against the reverted code. Record when the save occurred and inspect the actual file that the command consumed.

Next compare a relative path from two working directories. The same text can resolve to different objects because the process supplies the starting directory. A script should either define its input base clearly or accept an explicit path. A fragile instruction such as “run this from somewhere near the project” exposes temporal and environmental complexity to every user. A deeper tool resolves its own repository-relative resources or fails early with a precise missing-input explanation.

## Names, contents and permissions answer different questions

A filename is not a permanent content identity. A build can replace a file under the same path, and a process can retain an open handle to an older object. A checksum identifies content under the selected algorithm; it does not tell you who authorized that content or whether it is safe. A timestamp can help locate a change, but preserved or rounded timestamps are not proof of equal bytes. Use the right identity for the claim you are making.

Permissions also have scope. A readable file may be inaccessible through a directory the process cannot traverse. An executable bit on a script does not select the right interpreter or guarantee that its dependencies exist. Windows and Linux access models are not interchangeable labels. When an operation fails, record the acting process and filesystem view before proposing a broad permission change. Recursively making a project writable to everyone can conceal the immediate symptom while weakening the environment.

The LiveKit repository contains generated build output, dependency packages, source files, test fixtures and evidence archives. They should not all be treated alike. A source edit belongs in a reviewed diff. A generated file should be reproducible from its inputs. A test fixture should contain synthetic data. An evidence archive may be a user's retained artifact. Do not remove an untracked item simply because Git does not manage it; untracked means outside the index, not disposable.

## Executable identity and safe correction

Resolve a command name before trusting it. A shell function or wrapper can select another interpreter, inject arguments or change directories. A global tool may have the same name as the project's package script while using different dependencies. Prefer the documented project invocation, then record the runtime it actually selects. If a failure depends on that selection, preserve a minimal comparison rather than editing source to satisfy an accidental tool version.

For a safe correction, first name the exact target. Read it, inspect the intended diff, and verify that the resolved path stays inside the authorized workspace. Apply the smallest edit through the normal patching workflow. Re-read the changed region and run the relevant check. This may sound slower than a broad replacement, but it reduces the chance that a shell glob or escaped path touches unrelated files. Precision is a performance improvement for the investigation as a whole.

An independent exercise is to explain why two commands reporting the same filename can read different contents. Possible answers include different working directories, mounts, container images, separate checkouts, symlinks and a file replaced while a process holds an older handle. Choose one, construct a synthetic demonstration, and state which observation distinguishes it from the others. Understanding the namespace is more useful than memorizing another path command.

## Foundational systems reading - adapted companion material

These adapted filesystem and editor readings examine representations that source work depends on. Practice only on disposable text. A buffer, pathname, mount and running process have different lifetimes even when their visible names look similar.

## Supplied systems reference - page 11

Open the directory from Windows with explorer.exe . if WSL interoperability is available. Windows Explorer can present the same Linux-hosted project through WSL's supported interface. Avoid reaching into the distribution's internal storage files through an unsupported path. The public filesystem interface is the right integration boundary.

Windows case sensitivity is configurable in some contexts, and mounted filesystem behavior depends on mount settings. Treat "Windows ignores case" as a common default, not a universal law. Avoid projects that depend on two filenames differing only in case when multiple environments will access them.

If you copy a file to another filesystem and preserve its timestamp, is it the same filesystem object? No. Content and metadata can be similar while object identity and storage location differ.

Typing python3 does not inherently select a particular file. Bash checks definitions such as functions and builtins, then resolves external programs using its command lookup rules, including PATH and cached locations. Your activated virtual environment, an alias, or a wrapper script can alter the result. The command name is the beginning of a resolution process.

## Supplied systems reference - page 12

PATH is a colon-separated directory search list in typical Unix environments. Display it when diagnosing selection, but do not assume that printing it establishes every lookup behavior. Aliases, functions, builtins, cached locations, and explicit paths are distinct cases. If you intentionally change PATH after relocating an executable, Bash's hash -r can clear remembered external command locations. Understand that operation before using it as a ritual.

An executable path is better evidence than a prompt decoration, but a wrapper can launch another program. When diagnosis requires it, inspect the script and the running process. A version string also does not prove the configuration, installed modules, or database target.

Why can python -m pytest help when pytest alone fails? It selects the pytest module through the chosen Python interpreter instead of relying on an independently resolved command wrapper. It cannot help if that interpreter does not have pytest installed.

## Supplied systems reference - page 47

A pathname is a sequence of directory lookups. It is not the file's complete identity. On a typical Linux filesystem, a directory entry maps a name to an inode, which represents the file's metadata and data relationship. A hard link adds another directory entry for the same inode. A symbolic link instead contains a pathname to follow, which may later resolve to a different object or no object.

Opening a file creates a descriptor that refers through an open file description to the opened object. Renaming a directory entry does not retarget that descriptor. Unlinking removes a name; the file's data can remain available while an open descriptor still refers to it. Storage can therefore stay allocated after a large file disappears from a directory listing. This model connects log rotation, temporary files, and safe artifact publication.

That prevents readers from observing a half-published replacement through that name, but atomic visibility does not itself guarantee persistence after a power failure. Cross- filesystem moves may require copy and deletion rather than one rename operation.

## Supplied systems reference - page 48

"The file was deleted" can mean its name vanished, all links vanished, or its storage was reclaimed. These are separate events. Never infer descriptor state solely from a directory listing.

After rotating a log by rename, must the old writer append to the new pathname? No. Its descriptor can still reference the rotated file until it closes and reopens.

File permissions and directory permissions answer different questions. Reading a regular file requires permission to read its contents and permission to traverse the containing path. Reading a directory permits listing names. Executing a directory permits searching through it by known name. Writing a directory governs changes to its entries, subject to other rules such as the sticky bit. This is why a read-only file can sometimes be deleted by someone who can modify its directory.

## Supplied systems reference - page 49

Text begins as bytes with an interpretation. UTF-8 encodes Unicode code points using variable-length byte sequences. A visible character may consist of several code points, such as a letter followed by a combining accent. Therefore byte count, code-point count, and user-perceived character count can all differ. A tool that slices bytes can split an encoding sequence; a tool that slices code points can still split a visible grapheme.

Newlines are another interpretation boundary. Linux tools commonly use LF, while Windows text files often use CRLF. Python text mode can normalize line endings during reading, masking the difference that a byte-oriented parser or checksum will observe. A text editor's clean display does not prove the absence of carriage returns, a byte order mark, or an invalid byte sequence.

## Supplied systems reference - page 50

Choose an encoding and error policy at each input boundary. Silently replacing undecodable bytes can produce a plausible-looking value while destroying information needed for diagnosis. Normalization can be appropriate for some comparisons, but apply it according to the data contract: exact identifiers, signed data, and checksummed payloads can require preserving original bytes. Human names also deserve their full Unicode representation rather than a guessed ASCII substitute.

Unicode does not mean UTF-8, and UTF-8 does not guarantee one byte per character. LF normalization, Unicode normalization, and whitespace stripping are three distinct transformations with different consequences.

Two strings render as the same accented letter but compare unequal. Is the font necessarily broken? No. Their code-point sequences can differ; inspect representations and the intended normalization policy.

## Supplied systems reference - page 51

A path acquires meaning inside the filesystem view of the process using it. /home in one WSL distribution does not automatically refer to another distribution's home directories.

For a container discrepancy, first identify the daemon with docker context show and docker info, then inspect only the relevant container's mounts. A bind mount places host content at a container path and can obscure files originally present in the image at that path. A Docker volume has its own managed lifecycle. Neither the host directory's spelling nor the image's filesystem listing proves what an already-running container currently sees.

Also distinguish pathname existence from current directory identity. A process can keep a directory open while its name is moved or removed, just as it can hold an open file.

## Supplied systems reference - page 52

A mount changes which filesystem object a path reaches. It does not merge file contents into the directory it covers. WSL access paths and Docker daemon locations are environment-dependent.

The image contains /app/config.txt, but a running container cannot see it. Could a mount explain this? Yes. A mount at /app can cover the image's original directory.

A system call crosses from a user-space program into the kernel. strace observes that boundary: opening files, reading and writing descriptors, creating processes, and waiting. It does not show every Python function call or SQL interpretation inside a library. This narrower view is powerful when the question concerns an operating system operation, such as which path was opened or whether output was actually written. Buffering explains many surprising traces. A call to Python's print can update a user-space buffer without immediately invoking write. When output goes to a file, Python generally uses different buffering from an interactive terminal. The program can execute two print statements while the kernel observes one combined write at shutdown. Neither statement count nor visible timestamps alone tell you how many system calls occurred.

## Supplied systems reference - page 57

A key is an event, not an action with a fixed universal meaning. Vim interprets the event against its current state. In Normal mode, j ordinarily moves down one line. In Insert mode, the same key inserts a letter. After d in Normal mode, Vim is waiting for a movement or another valid continuation. That intermediate condition is called Operator pending mode. The editor has received part of a sentence, but cannot yet determine the text the deletion should affect. This is a useful first model of dispatch. Imagine a function receiving the current state and an input event and producing the next state. The state includes more than a visible mode indicator: the cursor, pending count, active mapping, and current buffer matter too. You need not know Vim's source code to use this model. You need to ask which facts determine the interpretation of the next key. That question replaces the unhelpful impression that the editor has become unpredictable.

## Supplied systems reference - page 58

Vim's editing language gains much of its economy by separating an operation from its target. d deletes, y yanks, and c changes a target, entering Insert mode after removing it.

## Supplied systems reference - page 59

Conversely, a structural command is only reliable when the editor's definition of that structure agrees with your intention. A programmer's identifier, a natural language word, and a space separated field are not automatically the same object.

In Vim, word depends partly on iskeyword; WORD treats nonblank runs differently. Inclusive and exclusive rules have documented boundary exceptions, particularly when a motion ends at column one. Doubled operators such as dd operate on lines. Also, cw has special historical behavior, so do not assume every change command is mechanically a deletion followed by insertion. The ciw operation offers an explicit inner-word target for practice.

## Supplied systems reference - page 60

Confusing buffers, windows and tab pages makes navigation feel dangerous and some destructive commands seem harmless. For a first working arrangement, one window is enough. Add a split when you need two positions visible at once. Add a second buffer when you need another document. Add tab pages when separate layouts serve separate tasks. This order keeps the concepts attached to real needs. A tab page need not correspond to one file, and a buffer need not currently appear anywhere on screen.

## Supplied systems reference - page 61

Two splits show the same buffer. Where should you undo an accidental change? Answer: in either view of that buffer. The change belongs to its text history, not to the particular pane in which you typed it.

Editing history and file contents are different timelines. A buffer can contain a new state while its file still contains the old one. Undo changes the buffer's state. A write serializes the current text to a file. Saving does not erase the ability to undo, and undoing a saved change does not silently rewrite disk. Your Git knowledge adds another distinct timeline: repository history records committed content, not every buffer state or every write.

## Supplied systems reference - page 62

You write a change, then undo it. Which version will another process read from disk? Answer: the written version, until you explicitly write the newly restored buffer. Undo is an editor state transition rather than a filesystem rollback.

Registers are named storage slots used by editing commands. The unnamed register supplies a normal p or P when no other register is selected. Deletes and changes can replace its contents, so recovering an earlier copy requires a more precise intention. Register 0 retains the most recent yank that did not explicitly target another register. The black-hole register accepts deleted text without retaining it in the ordinary deletion registers. Clipboard integration is a further boundary whose behavior depends on the editor build and operating environment.

## Supplied systems reference - page 63

After yanking one line and deleting another, how do you recover the yank? Answer: use "0p, provided the original yank used no explicit alternative register. First inspect :registers if you are uncertain about the preceding operations.

## Source trail

Inspect firebase.json, .gitattributes, next.config.ts and the dated rules-release
reports. Use read-only filesystem checks first; this chapter does not authorize
recursive deletion of build directories or user work.
