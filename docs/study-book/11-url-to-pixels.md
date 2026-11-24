# 11. From URL to HTML, JavaScript and pixels

## The LiveKit boundary to trace

Opening a consultation page initiates several kinds of work. The browser
requests a document, parses markup, loads styles and scripts, constructs a
rendered interface and later performs application requests. A visible page
does not establish that authentication completed or that a media connection
exists. The first useful observation is the sequence of dependencies between
those operations, not the final color of a status badge.

Next.js can send HTML before client behavior is ready. In the patient journey,
that makes initial guidance important: someone should not stare at a blank
surface while JavaScript and authentication settle. Read the route's initial
render and then follow the client component. Distinguish a server-rendered
loading explanation from the later decision that validates an invitation.

## A worked investigation

Use a synthetic invalid invitation in a local environment. With Network
recording active, compare the initial document request, script downloads and
validation call. Predict which response can decide whether the invitation is
valid. The document can carry the interface and loading state; server
validation must check the signed capability and persisted policy. A successful
document response cannot grant direct admission by itself.

Now repeat with JavaScript disabled only in an isolated browser experiment.
Record what information remains readable, but do not interpret the missing
interactive flow as evidence that server authorization vanished. The browser
has simply stopped executing the code that normally sends the next request.
Restore the experiment's setting afterward. Do not change privacy or security
permissions in another user's active clinical session.

## Exercise with answer

A screenshot shows a spinner, while Network shows the document returned 200.
What should you inspect next? Identify the specific asynchronous operation
that controls the spinner: authentication initialization, validation, room
access, or another request. Check its outcome and the component branch that
updates state. Rebuilding CSS because a spinner is visible is not a causal
repair unless layout actually prevents access to a completed result.

Compare the meaning of a first paint, an enabled Join button and remote media
being received. They are three milestones. A performance report should name
the milestone it times and the start event it uses. Otherwise two researchers
can report very different durations while both honestly describing them as
page load time. The measurement becomes useful when its operational definition
is precise enough to reproduce.

## Foundational systems reading - adapted companion material

These adapted network readings separate naming, listening, framing and TLS identity. They provide models for diagnosing a request path; container and local-server examples must not be mistaken for the deployed teleconsultation system's topology.

## Supplied systems reference - page 101

Change one assumption at a time using a test whose possible outcomes point to different next steps. This avoids random configuration edits and browser-policy folklore. Separate transport reachability, message semantics, browser access rules, rendering behavior and asynchronous completion while retaining a connected account of the user's action.

## Supplied systems reference - page 102

localhost describes loopback from the caller's network environment. It does not name a universal shared machine. A process running in an ordinary Linux container generally reaches that container's own network namespace when it connects to 127.0.0.1. A process in WSL and a Windows browser can have different views, with WSL integration providing particular forwarding or mirrored-network behavior. State the caller before interpreting a loopback address.

Binding to 0.0.0.0 means listening on all available IPv4 interfaces there; it is not a usable remote destination address or proof of Internet exposure. Routing, port publication, firewalls, and surrounding virtualization still determine reachability. IPv6 ::1 is a separate loopback address. A client resolving localhost to IPv6 can fail against a listener that only accepts IPv4.

Windows-to-WSL localhost behavior depends on the WSL version, networking mode and firewall configuration. Microsoft documents typical NAT and supported mirrored-networking behavior, but a particular machine still needs its own observation. Test the Windows browser separately from a Linux command-line client rather than assuming that one successful path proves the other.

For Docker, published host ports and service-internal ports are distinct addresses. A browser uses the host's published port; a peer container usually uses the service name and container port. The choice belongs to the caller, not to the framework.

## Supplied systems reference - page 103

Resolution can consult local files, operating system resolver configuration, DNS servers, caches, or application-specific mechanisms. Once an address is returned, a separate connection attempt must reach a listener. Separating these stages gives a precise meaning to "DNS works": a chosen resolver returned an answer for a chosen name at a chosen time.

Compose networks provide service-name discovery to attached containers; those names are not automatically names the Windows browser can resolve. Docker documents this scope and recommends service names instead of retaining container IP addresses across replacement. A replacement can have a new IP while keeping the service name.

## Supplied systems reference - page 104

Do not fix every resolution failure by editing a hosts file. Record the caller environment, expected resolver, actual answers, address families, and whether the failure occurs before connecting. Hard-coded addresses can conceal a discovery problem and become stale. When a proxy performs the destination lookup, the client machine's lookup may not be the decisive one at all.

## Supplied systems reference - page 105

If messages may contain newline characters themselves, this framing needs escaping or another boundary rule. A length-prefixed protocol solves a different version of the problem by specifying how many bytes follow before parsing the next message.

## Supplied systems reference - page 106

TLS protects a connection using cryptographic negotiation and authentication. For a typical HTTPS client, certificate verification must establish a chain to a trusted authority and match the requested hostname to the certificate identity. An encrypted connection to the wrong party is not the intended guarantee. A certificate can be internally valid but untrusted by your client, or trusted for one name while wrong for another. This gives a disciplined interpretation of common errors. "Unknown authority" concerns the trust path. "Hostname mismatch" concerns identity. An expired certificate concerns time validity. A protocol negotiation failure can occur before the application exchanges HTTP at all. Fix the demonstrated category instead of removing verification globally, which erases the evidence and changes the security contract.

Certificate verification is not the same test as a live TLS handshake or browser compatibility. Trusting a certificate and accepting its hostname are distinct checks. A real service can also present intermediate certificates, select a certificate using SNI and negotiate protocol parameters. Testing by an IP address can change the requested identity and SNI behavior, so it is not always equivalent to testing the original hostname.

## Supplied systems reference - page 107

HTTP defines request methods and response semantics, but an application's business contract decides what "success" means for a workflow. GET is intended to be safe; PUT and DELETE have idempotent semantics; POST does not have a universal idempotency guarantee. Idempotent means repeated identical requests have the same intended effect, not necessarily identical response bodies or absence of logs. The difficult retry case is an ambiguous outcome. A client can send a POST, the server can commit its effect, and the response can be lost before the client sees it. A timeout then proves only that the client did not obtain a timely response. It does not prove the operation failed. Automatically replaying the request can create a duplicate unless the application offers a suitable identity and deduplication contract.

## Source trail

Inspect app/invite/[token]/page.tsx and the patient room components. Use the
initial-response guidance fix in the dated verification history as a case
study, not a promise that every slow connection renders identically.
