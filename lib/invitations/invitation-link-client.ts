interface InvitationLinkResponse {
  success: boolean;
  inviteUrl?: string;
  error?: string;
}

interface CachedInvitationLink {
  inviteUrl: string;
  fetchedAtMs: number;
}

interface FetchInvitationLinkArgs {
  invitationId?: string;
  roomName?: string;
  forceRefresh?: boolean;
  cacheTtlMs?: number;
}

export interface FetchInvitationLinkResult {
  success: boolean;
  inviteUrl?: string;
  error?: string;
}

const DEFAULT_CACHE_TTL_MS = 60_000;
const invitationLinkCache = new Map<string, CachedInvitationLink>();

function resolveCacheKey({ invitationId, roomName }: FetchInvitationLinkArgs): string {
  if (invitationId) {
    return `invitation:${invitationId}`;
  }
  if (roomName) {
    return `room:${roomName}`;
  }
  throw new Error('Either invitationId or roomName is required');
}

function getCachedInvitationLink(cacheKey: string, cacheTtlMs: number): string | null {
  const cached = invitationLinkCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.fetchedAtMs > cacheTtlMs) {
    invitationLinkCache.delete(cacheKey);
    return null;
  }

  return cached.inviteUrl;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response but received status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchInvitationLink({
  invitationId,
  roomName,
  forceRefresh = false,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
}: FetchInvitationLinkArgs): Promise<FetchInvitationLinkResult> {
  const cacheKey = resolveCacheKey({ invitationId, roomName });
  if (!forceRefresh) {
    const cachedLink = getCachedInvitationLink(cacheKey, cacheTtlMs);
    if (cachedLink) {
      return { success: true, inviteUrl: cachedLink };
    }
  }

  const query = new URLSearchParams();
  if (invitationId) {
    query.set('invitationId', invitationId);
  }
  if (roomName) {
    query.set('roomName', roomName);
  }

  const response = await fetch(`/api/invite/get-link?${query.toString()}`);
  const result = await parseJsonResponse<InvitationLinkResponse>(response);

  if (!result.success || !result.inviteUrl) {
    return {
      success: false,
      error: result.error || 'Failed to fetch invitation link',
    };
  }

  invitationLinkCache.set(cacheKey, { inviteUrl: result.inviteUrl, fetchedAtMs: Date.now() });
  return {
    success: true,
    inviteUrl: result.inviteUrl,
  };
}

export async function copyTextToClipboard(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

