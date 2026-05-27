/**
 * LiveKit webhook event classification.
 *
 * Returns true for the events that signal a room/session has ended
 * (`room_finished`) or a participant has left (`participant_left`). The actual
 * finalization + summary generation for these events is handled by the
 * consultation-finalization service via the webhook finalization fallback; this
 * module only classifies the inbound event.
 */
export function isRoomEndEvent(event: unknown): boolean {
  const eventType = (event as { event?: string } | null | undefined)?.event;
  return eventType === 'room_finished' || eventType === 'participant_left';
}
