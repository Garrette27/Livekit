# 53. Coordinate application, rule and index releases

## The LiveKit boundary to trace

A release can span several independently deployed artifacts. Next.js source,
Firestore rules, indexes, TTL configuration and Functions do not become
current merely because one commit is merged. The release plan must identify
which artifacts changed, their compatibility order and the observations
needed to confirm each resulting state.

The consultation-integrity repair required both application behavior and
client-rule restrictions. Publishing only the rules would leave unsafe
server reassignment paths in old application code; publishing only the
application would leave direct client writes open. Coordination means
understanding these windows, not issuing a broad deploy command and hoping
every service happens to update.

## A worked release review

List the exact changed artifacts and preserve rollback references. Confirm
the project and team before any production write. Deploy only the approved
scope, then retrieve active rule source or deployment metadata as appropriate.
Run safe denial probes and a synthetic authenticated journey. The sources
and observations should name immutable commits or hashes.

If direct metadata access is blocked, record that limitation. A GitHub
deployment status can provide indirect evidence but does not prove the
exact live rules or successful consultation. Do not access an unrelated
account or change team permissions merely to erase the blocked label.

## Exercise with answer

A deploy command says complete but retrieved source differs. Which result
should drive acceptance? Investigate the actual target, release binding and
retrieval method. The command outcome and active state disagree; neither
should be edited out of the record. Acceptance remains pending until the
discrepancy is explained and the intended state is verified.

Why not roll back everything automatically when one artifact fails? An
uncoordinated rollback can create a worse compatibility combination or
reopen an authorization defect. Use a prepared decision with known backward
compatibility and explicit authority. Rollback is a release operation, not
an emotional reaction to a red dashboard.

## Foundational systems reading - adapted companion material

These adapted delivery readings distinguish source, artifacts, running processes and compatibility windows. Container and relational examples are comparative tools; the LiveKit release must still identify its own application, rules and index artifacts separately.

## Supplied systems reference - page 82

Runtime state also affects the experiment. A database migration may be required. A cached module may still be loaded. An old worker can keep executing the pre-merge code. A local secret or network service can alter execution. Record which checks run against which source and resource identities.

When finished, intentionally keep the merge as a commit or abandon it with the appropriate operation. If the purpose was temporary testing, an isolated worktree reduces interruption to your main directory. It does not remove the need to account for generated files or database changes produced by the tests.

"No commit" refers to Git history creation. It does not mean no files were changed, no database operations occurred, or no test fixtures were written. A test can have effects outside the repository even when no new source commit exists.

## Supplied systems reference - page 83

Choose the relationship before the Git command. To ask what changed between two snapshots, compare their trees directly. To ask what an unmerged branch contributes relative to its integration branch, a merge-base comparison can be suitable. To ask which commits a local branch has not received, use an appropriate reachability query. These are different questions even when their output sometimes looks similar.

Renames and line matching are additional presentation decisions. Git stores trees; rename detection in diffs is an inference based on similarity and options. A moved function may appear as deleted and added or as a rename, without changing the underlying object model. Use context and file history when you need intent beyond the displayed patch.

A small diff is not necessarily a small behavioral change. Changing a default, an ordering key, a transaction boundary, or a predicate can affect many records through unchanged call sites.

## Supplied systems reference - page 151

Two Compose projects have different names but both publish 127.0.0.1:8000. Can both claim it? Normally no. Choose distinct host ports or an intentional routing arrangement.

Reproducibility has several meanings. Repeating a dependency resolution can choose equivalent versions without producing identical bytes. Repeating a build can produce identical bytes but still embed the wrong configuration. Deploying the same artifact can produce different behavior against different schemas or data. Say which property you need, then capture the inputs and evidence that establish it.

A lockfile records a dependency selection according to a particular tool's format. It does not freeze the interpreter, operating system packages, build tools, environment, or every remote input automatically. Python dependency constraints, fully pinned requirements, hash checking, and wheel selection offer different guarantees. A pip freeze snapshot describes installed distributions; it is not by itself a complete cross-platform build recipe.

## Supplied systems reference - page 152

Deploy the built artifact you tested rather than rebuilding an allegedly equivalent artifact during every stage. This reduces uncontrolled differences, although runtime configuration and external systems still require verification. A checksum proves bytes match; it does not prove provenance, absence of defects, or compatibility.

A migration changes the database's structure or data expectations. A code deployment changes the processes interpreting that structure. These changes need not happen at one instant, particularly when old web workers and task workers continue running during replacement. A migration can succeed while an old process immediately fails on the new schema. Therefore "migration applied" and "release compatible" are different claims.

An expand-and-contract approach creates an overlap period. First add a compatible structure, then deploy code that can use it, backfill or dual-write according to a defined policy, verify completeness, and later remove obsolete structure when no active reader needs it. The exact sequence depends on the database, application behavior, and rollout strategy; the phrase is not a universal recipe that makes every schema change safe.

## Supplied systems reference - page 153

A backup is only useful if its consistency, restoration procedure, and restored application's behavior have been verified. A volume containing the database is its storage, not an independent backup.

An additive column migration passes locally. Does that prove a large production table can migrate without disruptive locks? No. Test and analyze the actual backend and workload separately.

## Supplied systems reference - page 154

Source files, built artifacts and process-loaded code can disagree without Git being broken. Pulling new files does not necessarily reload imported Python modules, and rebuilding an image does not replace an existing container. A release check must reach the processes actually serving requests and consuming tasks.

Embed trustworthy build identity in the artifact and expose it through controlled logs or a diagnostic endpoint. Compare that identity across web replicas and task workers. An environment variable containing a claimed commit is weaker evidence if deployment can set it independently of the artifact. A single successful request can hit one replica while another remains old, so verification needs coverage of the relevant population or rollout control plane.

## Source trail

Read the rules-release scripts, firebase.json and the dated defense report.
The latter's pending room-rule publication is a concrete example of why
repository fixes and deployed acceptance must be narrated separately.
