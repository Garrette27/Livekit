# 9. Processes, ports and environment boundaries

## The LiveKit boundary to trace

The editor, development server, browser and emulator are separate processes.
They can read different environments and keep different state alive. Closing
an editor tab does not stop a dev server. Updating a configuration file does
not guarantee that a long-running process reloaded it. A browser page may
continue communicating with a server that was started from another worktree.

This matters when a test base URL points at a port rather than an immutable
deployment. A reused port can make a browser test appear to validate a new
candidate while it is actually reaching an old process. Record the server
startup, working directory, source state and base URL. If the test runner
starts its own server, inspect that configuration instead of assuming the
currently visible terminal owns the endpoint.

## A worked local investigation

Run a local browser regression and a build sequentially, not concurrently in
the same .next directory. The repository's prior tests encountered generated
type collisions when processes shared that output. A missing-file error can
therefore be a runner artifact rather than a product defect. Reproduce the
check against stable output, retain the initial failure category, and explain
why the sequential control changes your interpretation.

Environment variables are copied into process context according to the
runtime and framework's rules. A variable available to a command-line test may
be absent in a deployed function. A server-only secret must not be promoted to
a browser-exposed variable merely to make a client component work. Correct
configuration follows the authority boundary: the backend signs tokens; the
browser receives a scoped credential, not the signing key.

## Exercise with answer

A terminal displays the correct source commit while the browser shows old
labels. List three explanations before clearing every cache. The browser may
reach another server process, the deployed alias may point to an older build,
or a client bundle may be stale relative to the intended server. Compare the
actual request destination and build identity. Clearing caches changes the
environment, so record the before state if cache behavior is part of the
question.

For emulator tests, verify that the application is using the emulator
configuration and a synthetic project before creating fixtures. A local
terminal does not make every network request local. The destination, not the
keyboard's location, determines whether an operation touches production.
That distinction is the foundation of safe fault injection.

## Diagnose the server you actually reached

A browser is open to a local address, yet your new log message never appears. The tempting response is to add more logging. First identify the listener. Another server may already own the port, the development tool may have selected a different port, or the browser may be using an old tab connected to another environment. Record the host, address family and port as a complete endpoint. The word localhost describes a caller-relative loopback context, not a universal machine shared by Windows, WSL and every container.

Inspect the listening process with read-only tools appropriate to its environment. Correlate its process identifier, command and working directory with the launch you intended. Do not terminate every Node process on the computer; the user may have unrelated work. If a supervisor launches workers, distinguish the parent from the worker that serves requests. A log line from the parent does not necessarily prove that every child loaded the same code or configuration.

Now send one harmless local request and observe the matching log or response marker. Use a synthetic request label if the application supports safe correlation. Avoid logging headers or request bodies indiscriminately. The decisive observation is that this endpoint reaches this process running this artifact. Once that chain is established, application-level debugging has a stable target.

## Process lifetime explains configuration surprises

A running process can retain old configuration after a file changes. It may read settings only during module initialization. A development reloader can replace it automatically, but that is a tool behavior to verify, not a universal property of servers. Build-time public frontend settings introduce another lifetime: changing a server environment variable does not necessarily rewrite already downloaded JavaScript. Describe when the value is bound and when a new artifact or process is required.

A process also has its own current directory and inherited environment. Changing directories in another terminal does not move it. Exporting a new value in a parent shell does not update an already-running child. A command that works after opening a fresh login shell may depend on a profile-defined version manager. Record that dependency so automated runs do not accidentally select a different interpreter.

Stopping a process is an operation with consequences. A graceful termination can allow cleanup, while a forced kill prevents application handlers from running. Neither guarantees that every external effect was undone. A database transaction may have committed before the process died, or a provider request may have succeeded without its response reaching the caller. Recovery needs idempotent intent and durable state, not the assumption that termination means nothing happened.

## Separate waiting from computation

When a local route is slow, compare elapsed time with CPU work and dependency timing. A process sleeping on a network response can have low CPU usage and high elapsed latency. A busy parser can consume CPU before issuing any database call. A browser may also wait because a paused debugger blocks its server worker. These mechanisms produce similar user-facing delay but require different corrections.

Construct two synthetic local operations: one performs bounded computation, the other waits on a controlled delay. Measure both under the same instrumentation. The point is not their absolute speed but the shape of evidence. A CPU profile should reveal repeated computation in the first. Dependency timing should explain the second. If your measurement cannot distinguish them, it is too coarse for the optimization claim.

End the exercise by cleaning up only the resources you created. Stop the known process, verify that its port is no longer listening, and preserve useful logs with their source revision. Do not infer cleanup from closing a terminal window; a detached session or supervisor may keep work alive. Resource ownership should be explicit enough that another investigator can tell what remains running without guessing from the desktop layout.

## Foundational systems reading - adapted companion material

These adapted process and container readings explain execution lifetime, terminals and isolation. Container examples are comparative models, not a description of the application's hosting architecture. Observe your actual environment before applying an operational command.

## Supplied systems reference - page 14

Record where a value is read. A database URL may be read when the application initializes. A frontend public variable may become part of browser JavaScript during build. A per-request parameter may be read repeatedly. A parameter stored in AWS Systems Manager is another resource with its own retrieval policy. Similar names do not make these values interchangeable.

Environment inspection can expose secrets. For exercises, use harmless variables. In actual diagnostics, select the property you need, such as the database host or whether a credential exists, without dumping the entire environment into a chat or log. The durable distinction is configuration scope, not a blanket rule that every variable is safe or secret.

Environment variables are strings supplied to a process, not a typed configuration system or a secure vault. Validation and secret handling must be designed around their contents and access paths.

## Supplied systems reference - page 40

Keep a short lab notebook containing your prediction, the command, the result, and the remaining uncertainty. That notebook is not administrative overhead. It forces you to expose the assumption that the next experiment must discriminate. With practice, debugging becomes a sequence of smaller questions that each have an observable answer.

## Supplied systems reference - page 41

A process is a running program together with operating system state. A program file is only one input to creating that process. Several processes can execute the same program while having different memory, directories, environments, and open descriptors.

Conversely, one process can replace its program through exec while retaining its process identifier. A tree produced by ps describes parentage; it does not tell you whether the child is executing the same application as the parent.

When inspecting a real tree, record both PID and parent PID, plus the actual command. A server supervisor may spawn a worker, and that worker may execute a different binary.

A worker can outlive its original parent and be reparented. PID values are also reused after exit, so a number remembered from yesterday is not a durable identity. Add start time when identity matters.

## Supplied systems reference - page 42

A child changes a list after fork. Must its parent observe the change? No. Ordinary private Python memory diverges; use an explicit shared mechanism if both need the result.

A shell variable belongs to the shell. Export marks a variable for inclusion in the environment passed to future child processes. Export does not update children that already exist, and a child's environment changes do not flow back into its parent.

## Supplied systems reference - page 43

Many modern language APIs create non-inheritable descriptors by default; close-on-exec flags also affect program replacement. Inheritance is a rule to inspect, not a promise that every descriptor will reach every child.

Exporting a new settings value changes an already-running worker? No. The worker retains its environment unless its own code changes it or a replacement process receives new configuration.

An interactive shell distinguishes foreground work from background jobs. The foreground process group receives terminal-generated signals and can normally read from the terminal. A background job frees the prompt but still belongs to the surrounding process and terminal arrangement. Appending & does not create a reliable service, detach every descriptor, or guarantee survival when the terminal closes.

In an interactive Bash terminal, start sleep 300, press Ctrl Z, and run jobs -l. Expect a stopped job. bg resumes it in the background; fg brings it to the foreground. Press Ctrl C after fg to terminate it. Ctrl Z normally causes a terminal stop signal, whereas Ctrl C normally generates an interrupt signal. Applications can alter terminal settings, and some signals can be handled or ignored, so these are configured behaviors rather than magical keyboard laws.

## Supplied systems reference - page 44

SIGTERM requests termination and permits a handler. SIGKILL cannot be caught and gives application cleanup no opportunity to run. A process blocked in an uninterruptible kernel wait may still not disappear immediately after KILL. A shutdown policy therefore needs a grace period, evidence of progress, and a defined escalation, not an endless series of increasingly angry signals.

Signals can target a process or a process group. A shell pipeline may contain several processes, so stopping only one PID can leave others alive. Inspect the group before choosing the shutdown scope.

kill sends a signal; it does not prove the target exited. wait observes completion of this shell's child and retrieves its exit status. Reused PIDs make careless later signaling dangerous.

## Supplied systems reference - page 45

A terminal window is a connection through which you interact with processes. Closing that window can break the connection while the work itself could, in principle, continue.

Finish by running exit in its only pane, or from outside use tmux -L tool-lab kill- session -t lab. That deliberately ends the lab session and its pane. Do not use a broad server-killing command on a server that contains work you want to retain.

A session survives detachment because the server and pane processes remain alive. Survival requires their operating system environment to remain running; restoring a layout later does not restore arbitrary process memory.

## Supplied systems reference - page 46

Linux terminal settings can collect input into lines, echo typed characters, translate newline conventions, and interpret control characters. A pseudo-terminal supplies that terminal interface without a physical serial device. Terminal emulators, SSH, and tmux use pseudo-terminals to connect interactive programs to a user interface.

Inspect intr, icanon, echo, and isig in stty -a rather than changing them blindly. Raw-mode applications such as editors can disable line processing or signal interpretation and handle keys themselves. A broken terminal display after a crashed program can therefore reflect leftover device settings. stty sane is a useful recovery command in the affected interactive terminal; it restores conventional settings, not every previous custom preference.

Ctrl C is a key gesture interpreted by the emulator and terminal configuration. SIGINT is an operating system signal. A byte whose numerical value is 3 is neither inherently a signal nor inherently a keyboard gesture.

## Supplied systems reference - page 148

A file created in container A must appear in container B from the same image? No. Their writable layers are separate unless a shared mount supplies that path.

Compose describes related services, but four different mechanisms often get confused. A network lets attached services communicate. Port publication exposes a container port through a host address and port. Environment entries supply strings to the container's processes. Volumes provide storage whose lifecycle can extend beyond a particular container. None of these substitutes for the others, and each has a different inspection point.

## Supplied systems reference - page 149

Compose uses service names for peer discovery on its networks. A peer can use a service name and internal port while a host client uses the explicitly published host port. A host port does not become the internal service port merely because both reach one application. Likewise, .env interpolation helps construct the Compose model, while container environment values require explicit configuration. Volumes preserve data across container replacement, but preservation is not a backup.

Running two copies of a project requires more than two directories. Compose project names ordinarily scope generated resources such as networks and named volumes.

## Supplied systems reference - page 150

Docker documents project-name selection, with the command line -p taking precedence over several other naming mechanisms. Prefer an explicit lab name when an experiment could otherwise target a directory-derived project accidentally. Stable development names are convenient, while concurrent branches or CI jobs need distinct names and storage policies.

Distinct container projects and storage names do not establish security isolation against a user with daemon access. They also do not prove that two applications use different external databases when configuration points to the same endpoint. Review every shared dependency, including brokers, databases, object stores, email sinks, callback URLs and external volumes.

Name collision is especially subtle when two application copies share a synthetic database inadvertently. A successful page load can conceal cross-project writes. A useful staging check uses a distinct harmless fixture marker through each copy and verifies that each reads only its intended marker. Do not perform this mutation against production merely to inspect configuration.

Distinct project names do not permit two listeners to publish the same host address and port simultaneously. Storage names and application endpoints must also be distinct when independence is intended.

## Source trail

Inspect playwright.config.ts, firebase.json, lib/firebase.ts and
lib/firebase-admin.ts. Configuration establishes possible destinations;
runtime observations establish which destination a particular process used.
