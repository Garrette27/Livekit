# 12. Read Network without mistaking one response for the whole feature

## The LiveKit boundary to trace

The Network panel shows requests, not a single unified feature result. In a
consultation you may see HTML, script chunks, Firebase traffic, application
JSON, LiveKit region discovery and a signaling connection. Their statuses
answer different questions. A region response with status 200 does not measure
video latency. A signaling upgrade does not prove the other participant is
receiving decoded frames. An application denial may be the correct security
outcome rather than an availability defect.

Begin by clearing misleading filters. A Fetch/XHR-only view can hide the
document that supplied an error page. Preserve log when navigation is part of
the investigation, then narrow to the relevant time window. Record whether
cache was disabled and whether the request came from the foreground tab you
intend to study. A panel containing old red rows can make a repaired action
look broken if you do not match timestamps and initiators.

## A worked investigation

Study the historical patient-history missing-token incident with a synthetic
fixture. Identify the linking request and inspect whether its Authorization
header exists without copying its value. The source repair routes the request
through the shared authenticated fetch boundary. Then inspect the response
envelope and the client branch that handles failure. A 401 from a request
missing credentials is expected; silently swallowing it is a separate client
feedback problem.

The later legacy linking endpoint intentionally became an authenticated
acknowledgment without reassignment. Do not teach the older request-body
identity repair as the current architecture. A successful response now means
that the legacy call was handled compatibly, not that cached IDs were accepted
as ownership evidence. Network interpretation depends on the endpoint's
current contract.

## Exercise with answer

An endpoint returns HTML and the caller expects JSON. Before editing the
parser, inspect status, content type, destination and server failure. The
parser error explains why the UI failed to interpret the response; it may
not explain why the server returned that body. Preserve both levels in the
incident note and repair the causal boundary first.

For a safe handoff, summarize method, sanitized path, status, content type,
approximate time and expected envelope. Do not export request credentials,
invitation tokens or clinical bodies. The colleague needs enough evidence to
identify the contract failure, not enough material to impersonate a patient.

## Foundational systems reading - adapted companion material

These adapted browser and HTTP readings connect a user action to requests and completion. Their small fixture endpoints are explanatory examples, not LiveKit routes. Apply the evidence method while following the actual application endpoint.

## Supplied systems reference - page 108

A sequential idempotency demonstration that returns one stored row on retry is not a production deduplication implementation by itself. Simultaneous requests require an atomic uniqueness strategy, and real systems must define key scope, retention, payload equivalence and result storage. A key without such rules is merely a header with a hopeful name.

Read responses at the right stage. A 202 indicates acceptance rather than completed processing. A 200 can describe a successful submission endpoint while a returned job identifier still refers to pending work. A 4xx or 5xx says something about this response, but proxy errors and interrupted connections can still leave downstream effects uncertain. Retrying safe reads and retrying money-changing writes demand different application policies.

A POST times out after the server commits. Is an unconditional retry safe? No. Query or retry through an explicit deduplication contract that handles the uncertain first outcome.

The browser exposes several distinct models. The DOM represents current document structure, which may differ from original HTML after scripts run. JavaScript event handlers decide what a click does. The Network panel shows requests made while it is recording. A server response can change application state without visibly changing the page. Inspect these models in sequence when "the button does nothing."

## Supplied systems reference - page 109

Inspect the button in Elements, select a click event listener breakpoint in Sources, and click once. Expect execution to pause inside the handler. Resume execution and inspect the /result.txt request in Network, including its method, status, response body, and initiator. Chrome documents event listener breakpoints and request initiator inspection; labels vary across browsers and releases. This creates an evidence chain: the selected DOM node exists, the click reaches a handler, the handler initiates a request, and the response becomes text in the output node. If a stage is absent, investigate that stage before jumping to a later one. A paused debugger deliberately prevents subsequent work, so a pending request or unchanged page while paused can be caused by your own observation.

The Network panel must be recording at the relevant time. Preserve log can retain requests across navigation; otherwise a navigation can remove the request you meant to inspect. Source maps can map bundled code back to authored sources, but a missing or mismatched map limits confidence in the displayed location. The served JavaScript and its execution are the authoritative runtime evidence.

A missing Network row can mean no request was made, recording started too late, or filters hid it. A successful request does not prove its response was rendered.

## Supplied systems reference - page 114

Network troubleshooting improves when each test distinguishes competing explanations. "Try restarting everything" changes many variables and can destroy the evidence of the original failure. Instead, state two plausible causes and select a test that would produce different observations under them. For example, a nonexistent listener and a wrong HTTP path both look like "the endpoint fails," but a TCP connection attempt and a recorded status code separate them immediately.

For a real failure, proceed through caller environment, name resolution, address family, listener and port, connection, TLS identity, HTTP response, browser policy, and business completion as appropriate. You need not test every layer every time: a captured valid response already establishes several earlier stages for that request. Use existing evidence to choose the next missing boundary.

A diagnostic endpoint's success proves that endpoint's tested path, not all database queries or workers. Reproduction should preserve the original caller, input, and authentication context without exposing secrets.

## Supplied systems reference - page 115

A request returns 403. Is opening firewall ports the demonstrated next step? No. An HTTP responder replied; inspect the responder and its authentication, authorization, or request-validation evidence.

The answer should explain why a network response can reach JavaScript even when its status represents failure. It should also explain why a missing downstream request cannot be established from browser evidence alone when a BFF makes server-side calls.

## Source trail

Inspect lib/auth/authenticated-fetch.ts, app/api/link-patient-consultations/route.ts
and the patient dashboard. Historical screenshots are clues, not immutable
descriptions of the current endpoint's semantics.
