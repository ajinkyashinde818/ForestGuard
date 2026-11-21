import { EventType } from '@prisma/client';
import { isLoggingRelatedType } from './event-classification';

describe('isLoggingRelatedType', () => {
  it.each([
    EventType.CHAINSAW,
    EventType.AXE_IMPACT,
    EventType.HAND_SAW,
    EventType.MACHINERY,
    EventType.TREE_FALL,
  ])('classifies %s as possibly logging-related', (type) => {
    expect(isLoggingRelatedType(type)).toBe(true);
  });

  it.each([
    EventType.NORMAL_FOREST,
    EventType.BIRD,
    EventType.RAIN,
    EventType.WIND,
    EventType.UNKNOWN,
  ])('keeps %s non-suspicious', (type) => {
    expect(isLoggingRelatedType(type)).toBe(false);
  });
});
