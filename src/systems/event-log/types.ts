/**
 * Event Log System Types (Stub)
 *
 * Will be expanded in Chunk 8
 */
export type LogEventType =
  | 'hero_hired'
  | 'hero_upgraded'
  | 'visitor_arrived'
  | 'visitor_departed'
  | 'adventure_started'
  | 'adventure_completed'
  | 'adventure_failed'
  | 'loot_obtained'
  | 'gold_earned'
  | 'world_event';

export interface LogEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly type: LogEventType;
  readonly data: Record<string, unknown>;
}

export interface Notification {
  readonly id: string;
  readonly timestamp: number;
  readonly type: 'info' | 'success' | 'warning';
  readonly title: string;
  readonly message: string;
  readonly isRead: boolean;
}

export interface EventLogState {
  readonly entries: readonly LogEntry[];
  readonly notifications: readonly Notification[];
  readonly lastReadAt: number;
  readonly maxEntries: number;
}

export const emptyEventLogState = (): EventLogState => ({
  entries: [],
  notifications: [],
  lastReadAt: 0,
  maxEntries: 100,
});
