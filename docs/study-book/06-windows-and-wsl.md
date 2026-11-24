# 6. Know which computer and shell owns your command

## The LiveKit boundary to trace

This repository is commonly opened through a Windows UNC path while its files
live inside Ubuntu under WSL. A PowerShell prompt and a Bash prompt may both
display a directory that looks like the same project. That does not mean they
resolve node, npm, Java, Python or Git to the same executable. Before a failing
build becomes a source investigation, establish which process is interpreting
the command and which filesystem contains its working directory.

In PowerShell, inspect Get-Command for an executable. In Ubuntu, inspect
command -v and the executable's own version output. Run the project's Node
version manager in the shell that will actually execute npm. The project's
declared Node 22 requirement is not satisfied merely because Windows has some
other Node installation. Record the version in the evidence log, especially
when an earlier successful run used Node 20 or a bundled runtime.

## A worked local investigation

Suppose npm works in a standalone Ubuntu terminal but an automated command
reports a missing binary. First compare working directories and PATH
resolution, not package.json. A login shell may initialize nvm while a
non-login shell does not. Conversely, inheriting Windows PATH entries can
select an unintended binary. The diagnosis is an environment difference until
you show that the same executable, source and arguments behave differently.

The command interpreter also owns quoting. A dollar expression expanded by
PowerShell cannot later be recovered by Bash as literal text. When invoking
wsl.exe, keep the command boundary explicit and avoid constructing destructive
commands from unresolved variables. For ordinary investigations, a read-only
version check is a better first probe than an installation or cleanup command.

## Exercise with answer

Predict whether changing a Windows terminal profile changes an already running
Ubuntu process. It does not rewrite that process's existing environment. Start
a new controlled shell or inspect the live process directly. Now explain why
a task that passed yesterday might fail after opening a different terminal:
the source may be unchanged while startup files, executable resolution, working
directory or environment differ. Compare those facts before reinstalling
dependencies. Reinstallation can erase the evidence of the difference.

For a LiveKit build handoff, write a short environment receipt containing the
OS context, shell, repository root, Node version, package-manager version and
source commit. Do not print the entire environment, because credentials may be
present. The receipt should let a teammate reconstruct the tool boundary
without receiving any secret configuration values.

## A practical two-environment notebook

Make a notebook with two explicitly named environments: Windows PowerShell and Ubuntu WSL. Do not call them “terminal one” and “terminal two,” because those names describe windows rather than execution contexts. In each environment record the current directory, operating-system identity, selected interpreter and repository root. Use the normal read-only commands for that shell, and write down the resulting values rather than a screenshot of the prompt decoration. A customized prompt can be stale or abbreviated; the process's actual directory and executable are stronger evidence.

Now identify which environment owns the project files. In this workspace, the Linux project is available through a Windows UNC path and through a Linux home path. Those are two access routes, not two independent clones. Editing through one route can change what the other sees. Conversely, a similarly named directory on the Windows drive can be a separate checkout. Verify repository identity with the root and commit rather than assuming that a folder named Livekit is the same working tree everywhere.

Consider a hypothetical test that passes in WSL and fails in PowerShell. Before changing application code, compare runtime selection and path interpretation. One shell may select Node from a version manager while the other selects a globally installed version. One command may use a Linux package installation while another uses Windows executables through interoperability. Native packages, executable permissions, newline conventions and dependency paths can differ. The useful question is not which operating system is better; it is which difference can explain the observed failure.

Change only one condition in the next experiment. Run the same source revision under the declared runtime in the environment where the project normally builds. If it succeeds there but fails under an accidental global runtime, the result supports an environment-selection explanation. It does not prove that every Windows development configuration is unsupported. Record the actual executable and version with the test log so another student can reconstruct the distinction.

## Keep configuration and secrets out of the experiment

Environment comparison can become an accidental credential disclosure. Printing every environment variable may reveal service-account material, database settings or provider keys. Instead, compare the presence and intended source of required names, and inspect harmless synthetic variables when learning inheritance. For a real secret, report “present from local configuration” or “not available” unless its value is essential to an authorized operation. Never put that value in the teaching notebook.

A child process receives an environment when it starts. If you change a variable in one shell, an already-running development server does not automatically acquire it. A second shell also retains its own state. This explains why editing a configuration file and refreshing the browser may leave server behavior unchanged. The browser might have new client assets while the existing server process still uses old initialization. Establish the read point and process lifetime before deciding that the configuration edit was ignored.

Do not solve confusion by copying every configuration file between environments. That can duplicate secrets, introduce contradictory sources and make future diagnosis harder. Identify the owning configuration path, document how the runtime obtains it, and keep machine-specific overrides narrow. The goal is a dependable laboratory, not an environment whose behavior depends on remembered manual copying.

## A recovery exercise

Imagine that you accidentally start the application from a separate Windows checkout while editing the WSL checkout. The browser shows no effect from your change. First identify the listening process and its working directory without killing unrelated programs. Then compare its source revision to the edited tree. Stop only the process you started, launch from the intended project environment, and repeat the smallest visible check. Do not delete dependency directories across both trees or reinstall the entire toolchain before establishing which tree the browser reaches.

The expected learning artifact is a short environment map and a resolved causal claim. It should say which runtime read which files and which process served the browser. If you can explain that chain without relying on window position or prompt color, you have a foundation for diagnosing builds, emulator tests and deployment scripts safely.

## Foundational systems reading - adapted companion material

These adapted environment readings explain the boundaries beneath the LiveKit laboratory. References to Python, editors or containers are comparative teaching examples, not a claim that the teleconsultation application uses those tools as its production backend.

## Supplied systems reference - page 8

When a developer types quickly in a dark window, several programs cooperate. The terminal emulator displays characters and translates keyboard activity into input for a terminal session. The shell parses commands and launches programs. An editor interprets its own editing language. The operating system supplies processes, memory, files, and communication facilities. A multiplexer can keep terminal sessions and organize their views. A graphical window manager arranges application windows on the desktop.

The distinction becomes concrete when the same terminal window first displays a Bash prompt and then Vim. Its display role remains, but a different program receives the input. In Vim Normal mode, the letter j is a movement command. At a Bash prompt, j is part of a command name. In a Python prompt, it can be an expression containing an identifier. A key has no universal application meaning.

## Supplied systems reference - page 9

After Vim exits, must Bash be restarted? Normally no. Bash launched the editor, waited while it owned the foreground interaction, and continues afterward. The shell and editor had separate responsibilities and lifetimes.

The practical value of WSL is access to Linux interfaces and tools while keeping the Windows applications you need. Your browser and communication tools can stay on Windows. Source inspection, Git, Python, and Linux containers can use Linux-friendly workflows. Decide where each task belongs from its dependencies and semantics, rather than from the visual appearance of its window.

## Supplied systems reference - page 10

A boundary can remain even when integration makes it convenient. File paths, executable formats, permissions, networking, process identifiers, and startup mechanisms can differ. A command that works in Ubuntu may not exist in PowerShell. A Windows path supplied to a Linux program may identify nothing unless translated. A tutorial about an ordinary Linux desktop may assume a display server or service setup that your distribution does not have.

WSL2 is not an emulation of every Linux desktop installation, and Ubuntu is not the Linux kernel. WSL version, distribution version, and individual package versions are separate facts. Inspect the one that constrains the behavior being investigated.

Does a newer Ubuntu distribution automatically mean a newer Python inside an existing application image? No. The image can contain its own interpreter and packages, built independently of the distribution that launched Docker.

A pathname is interpreted within a filesystem namespace. In Windows, a path can begin with C:\\Users. In WSL, the Windows drive is commonly available beneath /mnt/c, and Linux home directories are beneath /home. These are not merely spelling conventions.

## Supplied systems reference - page 15

The visible speed in a keyboard-led workflow partly comes from reliable changes of focus. Several layers can interpret keys: Windows, a terminal tab, a tmux pane, Vim, and a plugin within Vim. A shortcut that makes sense in one layer may be consumed before reaching another. Understanding the receiver is more dependable than memorizing a large unclassified shortcut list.

Begin with a modest layout. Put the editor where you can read a function without scrolling sideways, keep a terminal for tests and logs, and leave a browser available for application behavior and documentation. Windows Snap can provide this arrangement.

## Supplied systems reference - page 16

If Ctrl C copies text in one window but interrupts a program in another, which general question resolves the ambiguity? Identify the component receiving the key and its current interpretation rules, including terminal selection and shortcut settings.

A workflow should be small enough to reconstruct. Begin with your existing Windows Terminal profile for Ubuntu, Bash, the editor you are learning, Git, and the project's established runtime. Add tmux when session persistence or pane organization solves a concrete problem. Add a graphical tiling utility when repeatable desktop layout matters.

Keep configuration under version control when it becomes useful, but separate it from secrets and machine-specific state. A minimal .vimrc or documented terminal profile can be easier to maintain than a full dotfile collection copied from someone else's machine.

Read each setting. Record why it exists and how to disable it during diagnosis. A clean Vim invocation, such as vim -Nu NONE -n -N, lets you distinguish editor behavior from your configuration.

The baseline is successful when you can open a project, find code, make a controlled edit, inspect the diff, run the relevant check, and inspect the application result. It need not match anyone else's colors or window placements. The mechanism you understand can be rebuilt with other tools as your needs change.

## Source trail

Inspect package.json, the quality workflow and scripts/thesis/verify-remediation.mjs.
The adapted computer-systems readings below supply general tool mechanics;
they are not evidence that a particular executable is installed on your PC.
