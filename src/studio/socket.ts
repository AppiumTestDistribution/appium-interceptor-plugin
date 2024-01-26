import { Server } from 'http';
import { Socket, Server as SocketServer } from 'socket.io';
import { EventBus } from './notifier/event-bus';
import { SessionCreatedEvent } from './events/session-created-event';
import { ProxySession } from './proxy-session';
import { v4 as uuid } from 'uuid';
import { RequestInfo } from '../types';

export function registerSocket(httpServer: Server, eventBus: EventBus) {
  const io = new SocketServer(httpServer);

  eventBus.addListener(
    SessionCreatedEvent.listener((session: ProxySession) => {
      const sessionId = session.id;
      const proxy = session.proxy;
      console.log(`new Session created: ${sessionId}`);
      const sniffer = proxy.addSniffer({});
      sniffer.on('request', (request: RequestInfo) => {
        io.sockets.in(sessionId).emit('request', request);
      });
    })
  );

  io.on('connection', (socket: Socket) => {
    const sessionId = socket.handshake.query.sessionId;
    if (sessionId) {
      socket.join(sessionId);
    }
  });
}
