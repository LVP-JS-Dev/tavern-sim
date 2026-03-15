/**
 * Event Log System Types (Stub)
 *
 * Will be expanded in Chunk 8
 */
export type LogEventType =
  | 'hero_hired' | 'hero_upgraded' | 'visitor_arrived' | 'visitor_departed'
  | 'adventure_started' | 'adventure_completed' | 'adventure_failed'
  | 'loot_obtained' | 'gold_earned' | 'world_event' | 'personality_changed';

export interface LogEntry {
  readonly id: string;
  readonly timestamp: number;
  readonly type: LogEventType | string;
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

export interface EventLogSlice {
  readonly eventLog: EventLogState;
}

export interface EventFilter {
  readonly since?: number;
  readonly until?: number;
  readonly types?: readonly string[];
  readonly limit?: number;
}

export interface EventLogService {
  append(entry: LogEntry, state: EventLogState): EventLogState;
  query(filter: EventFilter, state: EventLogState): readonly LogEntry[];
  getUnread(state: EventLogState): readonly Notification[];
  markRead(ids: readonly string[], timestamp: number, state: EventLogState): EventLogState;
  createNotification(input: Omit<Notification, 'id' | 'timestamp'>, id: string, timestamp: number, state: EventLogState): EventLogState;
}
