# 52. Read CI, package inventories and runtime compatibility separately

## The LiveKit boundary to trace

The quality workflow has distinct application, dependency-audit and Functions
jobs. A dependency advisory should remain visible without concealing whether
policy tests, lint and build passed. A failed deployment for an unrelated
project should not be mistaken for the intended frontend's outcome. Read the
job or status context and the failed step before interpreting the red mark.

Package inventories are time-bound observations. The earlier full application
audit reported development-tooling findings associated with picomatch; later
scans returned zero without a corresponding application-code repair. The
correct report preserves both dates and avoids inventing a causal explanation
that the evidence does not establish.

## A worked investigation

Inspect the lockfile, declared engine and actual executable. Run the relevant
audit and retain its structured result, including whether development
dependencies were included. A production-only zero result is not the same
claim as a full-tree zero result. Then run a runtime startup regression when
the incident concerns module loading rather than only compilation.

The Firebase/jose incident illustrates why these checks complement each other.
An inventory can have no known advisories while an import still fails under
the hosted runtime. A successful build can coexist with that failure. The
narrow compatibility override and startup test address a loading contract,
not an assertion that every dependency is forever safe.

## Exercise with answer

CI proposes a major-version downgrade to remove an advisory. Should the team
apply it automatically before a defense? No. Review compatibility, actual
affected dependency paths and the availability of a narrow supported repair.
Record unresolved risk rather than breaking the application to obtain a
green badge. Never hide a failing audit by weakening its threshold silently.

A hosted deployment refuses the commit author because of team access. Is
changing repository visibility or buying a plan an ordinary code fix? No.
Those are account, privacy or billing decisions requiring separate authority.
The investigator can identify the cause and use an authorized publication
workflow without silently expanding access.

## Source trail

Read .github/workflows/quality.yml, package.json and the dated audit JSONs.
Dependency security, source correctness, runtime compatibility and deployment
authorization remain four distinct evidence categories.
