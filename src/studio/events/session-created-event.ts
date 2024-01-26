import { EventConsumer } from '../../types';
import { Event } from '../notifier/event';
import { EventListener } from '../notifier/event-listener';
import { ProxySession } from '../proxy-session';

export class SessionCreatedEvent extends Event<ProxySession> {
  private static readonly EVENT_NAME: string = 'session-created';

  constructor(session: ProxySession) {
    super(SessionCreatedEvent.EVENT_NAME, session);
  }

  static listener(handler: EventConsumer<ProxySession>) {
    return new EventListener<ProxySession>(SessionCreatedEvent.EVENT_NAME, handler);
  }
}
