import { EventType } from '@prisma/client';

export const LOGGING_RELATED_EVENT_TYPES: ReadonlySet<EventType> = new Set([
  EventType.CHAINSAW,
  EventType.AXE_IMPACT,
  EventType.HAND_SAW,
  EventType.MACHINERY,
  EventType.TREE_FALL,
]);

export function isLoggingRelatedType(type: EventType): boolean {
  return LOGGING_RELATED_EVENT_TYPES.has(type);
}
