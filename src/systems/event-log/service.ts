// src/systems/event-log/service.ts
import type { EventLogService, EventLogState, LogEntry, Notification, EventFilter } from './types';

export class EventLogServiceImpl implements EventLogService {
  append(entry: LogEntry, state: EventLogState): EventLogState {
    const entries = [...state.entries, entry];

    // Truncate if needed
    if (entries.length > state.maxEntries) {
      entries.splice(0, entries.length - state.maxEntries);
    }

    return { ...state, entries };
  }

  query(filter: EventFilter, state: EventLogState): readonly LogEntry[] {
    let result = [...state.entries];

    if (filter.since !== undefined) {
      result = result.filter(e => e.timestamp >= filter.since!);
    }
    if (filter.until !== undefined) {
      result = result.filter(e => e.timestamp <= filter.until!);
    }
    if (filter.types !== undefined && filter.types.length > 0) {
      result = result.filter(e => filter.types!.includes(e.type));
    }
    if (filter.limit !== undefined) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  getUnread(state: EventLogState): readonly Notification[] {
    return state.notifications.filter(n => !n.isRead);
  }

  markRead(ids: readonly string[], timestamp: number, state: EventLogState): EventLogState {
    const idSet = new Set(ids);

    return {
      ...state,
      lastReadAt: timestamp,
      notifications: state.notifications.map(n =>
        idSet.has(n.id) ? { ...n, isRead: true } : n
      ),
    };
  }

  createNotification(input: Omit<Notification, 'id' | 'timestamp'>, id: string, timestamp: number, state: EventLogState): EventLogState {
    const notification: Notification = {
      ...input,
      id,
      timestamp,
    };

    return {
      ...state,
      notifications: [...state.notifications, notification],
    };
  }
}
