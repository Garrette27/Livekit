# 10. Git as a model of history, working state and release evidence

## The LiveKit boundary to trace

Git records content snapshots and relationships between commits. Your working
tree, index, local branch and remote-tracking branch are different states.
Fetching updates what you know about the remote; it does not by itself replace
your current files. A safe update begins with status inspection and preserves
uncommitted work. In this project, the local AGENTS.md has repeatedly differed
from the committed version, making that distinction practically important.

Use immutable commit IDs when citing evidence. A report saying latest main
becomes ambiguous as soon as another commit is pushed. A source snapshot can
be tested locally, then published, then deployed later. Keep those timestamps
and results separate rather than compressing them into one word, shipped.

## A worked local investigation

Before pulling, inspect the branch and dirty files. If the remote can be
fast-forwarded safely, do so without inventing a merge strategy. If unrelated
edits overlap, preserve them explicitly and inspect the result after recovery.
Do not use a hard reset as a shortcut to a clean audit. A clean verification
worktree is often the smaller, more explainable experiment.

The repository also documents a squash-merge workflow. A follow-up branch can
retain commits whose changes already exist in main under a different merge
identity. Blind rebasing or force pushing can then damage history or lose
work. Follow the repository's prescribed recovery process, inspect the exact
commit intended for delivery, and use guarded updates rather than assuming
that matching messages mean matching objects.

## Exercise with answer

An application test log names commit A, but the rules file was modified after
that commit. Is the log worthless? Not necessarily, but the candidate must be
identified as A plus a specific diff or source hashes. A test result attached
to an unqualified commit would be misleading. Record the tested files and
their hashes, then tie the later publication commit to those bytes.

A documentation-only commit follows a passing application commit. Must you
claim the new documentation commit has already passed CI? No. State the
commit whose code was tested and the status of the newer checkpoint
separately. Evidence should not become a self-perpetuating claim that every
future descendant automatically inherits every test result under every
environment. Git ancestry helps explain change; it does not execute tests.

## Read three comparisons instead of one vague status

Git's working tree, index and current commit represent different states. An unstaged edit changes the working file relative to the index. A staged edit changes the index relative to the current commit. A file can have both kinds of changes at once. If you stage a correction and then edit the file again, a normal commit includes the staged version, not an automatic snapshot of every later visible change. This is why reviewing only the working-tree diff can miss what will actually be published.

Use a disposable repository to observe the distinction. Start with one short note, commit it, change one line, stage it, then add another line without staging. Predict the two diffs and inspect them. Commit only after the prediction is clear. In the real LiveKit repository, do not use this learning exercise to stage the user's unrelated AGENTS modification or existing evidence archives. A clean demonstration belongs in its own sandbox.

Record a stable commit identifier when citing implementation. A branch name moves. A merge message describes intent but does not prove file content or ancestry. A recent author date does not establish that the commit is the ancestor of the deployed artifact. Use graph relationships and actual content comparisons for those questions. In a forked workflow, identify which remote owns each branch; origin is a local configuration name, not a guarantee that it points to the authoritative repository.

## Fetching, integrating and releasing are separate acts

Fetching updates remote-tracking information without making every local file equal to remote main. Integration may fast-forward, merge, conflict or require a different recovery strategy under the repository's history policy. Read that policy before choosing rebase or cherry-pick. Do not solve a conflict by resetting away a dirty working tree. The local edits may be the only copy of the user's work.

After integration, inspect the new source and rerun the checks relevant to the changed behavior. A previous test result belongs to its original tree and environment. If the merge changes a policy file, dependency lock or test harness, the old pass cannot simply be copied into the new status row. Preserve it as historical evidence and record the new verification separately. This append-only approach makes progress visible without rewriting inconvenient failures out of history.

A push transfers source commits to a remote branch. It does not necessarily start a deployment, satisfy project permissions, publish Firestore rules or activate a new runtime. CI can pass while a deployment fails. A deployment can succeed while the production alias still points elsewhere. A rule release can update the database boundary independently of the frontend. Release evidence should identify those artifacts individually.

## Review the publication as an interface

Before committing, read the exact staged diff. Look for credentials, real identifiers, generated noise, unrelated changes and claims broader than the evidence. Include documentation when security or performance status changes. A reviewer should not need the author's memory to understand why a test was added or which environment passed. A concise commit can contain both the correction and the evidence note that explains it.

If the task is interrupted, leave a handoff with the last completed step and next unfinished one. State whether a change is local, committed, pushed, in CI or deployed. Those words should not be interchangeable. A future investigator can then continue from the correct boundary instead of repeating an audit or assuming a release happened.

For the independent exercise, examine a hypothetical commit whose message says “secure consultation writes” while the active rule source is older. What is the correct readiness state? The repository change may be reviewed and locally tested, but production security acceptance remains incomplete for that boundary. The next step is an authorized rule release and source verification, not another reassuring commit message. Git supplies trustworthy history only when the investigator asks a precise question of it.

## Foundational systems reading - adapted companion material

These adapted Git readings distinguish content history, references and operational state. Work through them in a disposable repository first, then use the same reasoning to inspect LiveKit without discarding unrelated changes or assuming a deployment.

## Supplied systems reference - page 75

A commit records a tree of versioned content together with metadata and parent relationships. Your working tree can contain edits that are not in that commit. Your database, media volume, running worker, and browser cache hold other state. A complete description of an application therefore requires several identities. A commit is essential release evidence, but it is not a snapshot of the entire operational system.

## Supplied systems reference - page 76

Git gives you several views because your work has several states. The working tree contains editable files. The index records the content selected for the next commit. HEAD identifies the current commit. A default git diff compares tracked working-tree content with the index. git diff --cached compares the index with HEAD. git status summarizes these relationships and additional path states.

## Supplied systems reference - page 78

Content addressing supplies integrity properties: an identifier depends on object content, so changing that content changes its identity. It does not establish that the code is correct, authorized by your organization, or deployed. A hash is an identifier and integrity mechanism under its algorithm's assumptions. A signature can add a claim about a key, but trust in the key's owner and review of the change remain separate concerns.

A visually recent date or a merge message does not prove that one commit is an ancestor of another. Use git merge-base --is-ancestor old new when ancestry is the question, and inspect its exit status.

Can a merge commit have no visible file changes against one parent? Yes. A merge records parent relationships as well as a tree. Its significance can be ancestry integration even when one comparison yields no content difference.

A local branch name points to a commit and normally moves when you commit on that branch. A remote-tracking reference such as origin/develop records the remote state last fetched into your repository. It is local information about a remote, not a live query of the remote server. HEAD can point symbolically to a local branch or directly to a commit.

## Supplied systems reference - page 79

Multiple remotes add another namespace. In a fork workflow, origin may be the personal fork while upstream names the company repository. One developer's origin can be another developer's upstream. The URL gives the meaning of the name. A command that is harmless when origin means a fork can have a different organizational consequence when origin means a production deployment repository.

Remote history can also be rewritten under permitted policies. A remote-tracking update may then no longer be a fast-forward. Record the old and new IDs if you are investigating such a change. Reflogs may preserve prior local reference movement for a limited period; they are not permanent remote audit records.

A branch being up to date means up to date with some identified comparison at some observation time. It does not mean every remote is synchronized or every build is current.

What does git fetch change if you are detached at yesterday's commit? It can update remote-tracking references and download objects while your detached HEAD and working tree remain at the selected commit. You then choose whether to switch or inspect another snapshot.

Detached HEAD means HEAD identifies a commit directly rather than a local branch name. It is useful for reading and testing a historical or fetched snapshot. You can still edit and commit, but a new commit is not attached to a branch unless you create or move a reference to preserve it. The state is ordinary Git behavior, not a damaged repository.

## Supplied systems reference - page 80

Two worktrees can accidentally launch Compose against the same project name and volumes. Give development experiments explicitly distinct service projects, ports, and test resources when they need to run simultaneously. If the objective is only source reading, do not start another application stack.

Shared Git objects and refs mean worktrees are related checkouts, not independent clones. Default Git rules also prevent checking out the same local branch in two worktrees at once. Separate directories do not guarantee operational separation.

## Source trail

Read docs/testing/verification-status.md and .github/workflows/quality.yml.
Use the ledger as the current projection and dated reports as preserved
history. Never silently rewrite a failed baseline to make the release story
look simpler than the actual sequence.
