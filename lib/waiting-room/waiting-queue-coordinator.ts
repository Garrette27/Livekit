/**
 * Shares waiting-queue polling across every component watching the same scope.
 *
 * The waiting queue is rendered in several places at once (the invitation
 * detail panel, the queue list, the in-room panel). Each one previously owned
 * its own timer and its own request, so identical calls went out together and
 * the read volume scaled with how many panels happened to be on screen.
 *
 * This collapses that to one request in flight and one timer per scope, which
 * is the same de-duplication strategy data-fetching libraries such as SWR and
 * React Query use. Callers keep a plain "give me the data" interface and never
 * see the registry.
 */

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type Unsubscribe = () => void;

interface StreamSubscriber {
  onInvalidate: () => void;
  onUnavailable: (reason: unknown) => void;
}

interface StreamGroup {
  subscribers: Set<StreamSubscriber>;
  unsubscribe: Unsubscribe;
}

const streamGroupsByDoctor = new Map<string, StreamGroup>();

/**
 * Invalidates the doctor's queue when Firestore changes. Snapshot contents
 * never become UI state: callers re-query the authenticated API, whose room,
 * invitation-expiry and freshness projection is authoritative. Sharing this
 * listener keeps multiple panels from creating duplicate subscriptions.
 *
 * `onUnavailable` is the important part of this interface: security rules,
 * offline state, or a missing client can all make the stream impossible, and in
 * every one of those cases the caller must be able to fall back to polling
 * rather than show an empty queue. Returns null when no listener could be
 * started at all.
 */
export function subscribeToDoctorQueueChanges(input: {
  doctorUserId: string;
  onInvalidate: () => void;
  onUnavailable: (reason: unknown) => void;
}): Unsubscribe | null {
  if (!db || !input.doctorUserId) {
    return null;
  }

  const subscriber: StreamSubscriber = {
    onInvalidate: input.onInvalidate,
    onUnavailable: input.onUnavailable,
  };

  try {
    let group = streamGroupsByDoctor.get(input.doctorUserId);
    if (!group) {
      const subscribers = new Set<StreamSubscriber>();
      const waitingQuery = query(
        collection(db, 'waitingPatients'),
        where('doctorUserId', '==', input.doctorUserId)
      );
      const createdGroup: StreamGroup = {
        subscribers,
        unsubscribe: () => undefined,
      };
      createdGroup.unsubscribe = onSnapshot(
        waitingQuery,
        () => {
          createdGroup.subscribers.forEach((currentSubscriber) => {
            currentSubscriber.onInvalidate();
          });
        },
        (streamError) => {
          createdGroup.subscribers.forEach((currentSubscriber) => {
            currentSubscriber.onUnavailable(streamError);
          });
          streamGroupsByDoctor.delete(input.doctorUserId);
        }
      );
      group = createdGroup;
      streamGroupsByDoctor.set(input.doctorUserId, group);
    }

    group.subscribers.add(subscriber);

    const joinedGroup = group;
    return () => {
      joinedGroup.subscribers.delete(subscriber);
      if (joinedGroup.subscribers.size === 0) {
        joinedGroup.unsubscribe();
        if (streamGroupsByDoctor.get(input.doctorUserId) === joinedGroup) {
          streamGroupsByDoctor.delete(input.doctorUserId);
        }
      }
    };
  } catch (subscribeError) {
    input.onUnavailable(subscribeError);
    return null;
  }
}

/** In-flight request per server query, so simultaneous callers share one round trip. */
const inFlightByRequest = new Map<string, Promise<unknown>>();

interface PollGroup {
  intervalId: number;
  tickers: Set<() => void>;
}

const pollGroupsByScope = new Map<string, PollGroup>();

/**
 * Runs `fetcher` for this scope, or joins the request already running for it.
 * Resolves when that request settles, so callers can await their own refresh
 * without issuing a duplicate.
 */
export function fetchWaitingQueueOnce<T>(requestKey: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlightByRequest.get(requestKey) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const request = fetcher().finally(() => {
    inFlightByRequest.delete(requestKey);
  });

  inFlightByRequest.set(requestKey, request);
  return request;
}

/**
 * Registers a periodic refresh for this scope. Every subscriber on a scope
 * shares one timer, so the polling rate is a property of the scope rather than
 * of how many components are mounted. Returns an unsubscribe function; the
 * timer stops when the last subscriber leaves.
 */
export function subscribeToWaitingQueuePoll(
  scopeKey: string,
  intervalMs: number,
  tick: () => void
): Unsubscribe {
  let group = pollGroupsByScope.get(scopeKey);

  if (!group) {
    const tickers = new Set<() => void>();
    const intervalId = window.setInterval(() => {
      // One shared request per interval; subscribers read the resulting state.
      tickers.forEach((subscriberTick) => subscriberTick());
    }, intervalMs);
    group = { intervalId, tickers };
    pollGroupsByScope.set(scopeKey, group);
  }

  group.tickers.add(tick);
  const joinedGroup = group;

  return () => {
    joinedGroup.tickers.delete(tick);
    if (joinedGroup.tickers.size === 0) {
      window.clearInterval(joinedGroup.intervalId);
      pollGroupsByScope.delete(scopeKey);
    }
  };
}
