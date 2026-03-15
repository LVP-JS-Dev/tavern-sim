/**
 * Event Log System
 *
 * Manages event history and notifications.
 * Will be expanded in Chunk 8.
 */
export type {
  EventLogService,
  EventLogState,
  EventLogSlice,
  LogEntry,
  Notification,
  EventFilter,
  LogEventType,
} from './types';
export { emptyEventLogState } from './types';
export { EventLogServiceImpl } from './service';
