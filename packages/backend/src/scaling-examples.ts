// Alternative scaling approaches for real-time events

import { Observable, Subject, merge } from 'rxjs';
import { filter, map, share, retry, catchError } from 'rxjs/operators';
import Redis from 'ioredis';

// 1. Message Queue Pattern (RabbitMQ/AWS SQS style)
export class MessageQueueEventBus {
  private queues = new Map<string, Subject<any>>();
  
  // Create topic-based subscriptions
  publishToTopic(topic: string, message: any): void {
    if (!this.queues.has(topic)) {
      this.queues.set(topic, new Subject());
    }
    this.queues.get(topic)!.next(message);
  }
  
  subscribeToTopic(topic: string): Observable<any> {
    if (!this.queues.has(topic)) {
      this.queues.set(topic, new Subject());
    }
    return this.queues.get(topic)!.asObservable().pipe(share());
  }
  
  // Subscribe to multiple topics
  subscribeToTopics(topics: string[]): Observable<any> {
    const streams = topics.map(topic => this.subscribeToTopic(topic));
    return merge(...streams);
  }
}

// 2. Event Sourcing Pattern
export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  data: any;
  timestamp: Date;
  version: number;
}

export class EventStore {
  private events: DomainEvent[] = [];
  private subject = new Subject<DomainEvent>();
  
  append(event: Omit<DomainEvent, 'timestamp'>): void {
    const fullEvent = { ...event, timestamp: new Date() };
    this.events.push(fullEvent);
    this.subject.next(fullEvent);
  }
  
  getEvents(aggregateId?: string, fromVersion?: number): DomainEvent[] {
    let filtered = this.events;
    
    if (aggregateId) {
      filtered = filtered.filter(e => e.aggregateId === aggregateId);
    }
    
    if (fromVersion !== undefined) {
      filtered = filtered.filter(e => e.version >= fromVersion);
    }
    
    return filtered;
  }
  
  subscribe(filterFn?: (event: DomainEvent) => boolean): Observable<DomainEvent> {
    const stream = this.subject.asObservable();
    return filterFn ? stream.pipe(filter(filterFn)) : stream;
  }
}

// 3. Redis Streams (more advanced than pub/sub)
export class RedisStreamsEventBus {
  private redis: Redis;
  private readonly streamName = 'payment-stream';
  
  constructor(redisUrl: string = 'redis://localhost:6379') {
    this.redis = new Redis(redisUrl);
  }
  
  async addEvent(event: any): Promise<string> {
    const result = await this.redis.xadd(
      this.streamName,
      '*', // auto-generate ID
      'data', JSON.stringify(event)
    );
    return result || '';
  }
  
  // Consumer group pattern for load balancing
  createObservable(consumerGroup: string, consumer: string): Observable<any> {
    return new Observable(subscriber => {
      const pollEvents = async () => {
        try {
          // Try to create consumer group (fails if exists, that's ok)
          try {
            await this.redis.xgroup('CREATE', this.streamName, consumerGroup, '$', 'MKSTREAM');
          } catch (error) {
            // Group probably exists
          }
          
          while (!subscriber.closed) {
            const results = await this.redis.xreadgroup(
              'GROUP', consumerGroup, consumer,
              'COUNT', 10,
              'BLOCK', 1000,
              'STREAMS', this.streamName, '>'
            );
            
            if (results && Array.isArray(results)) {
              for (const result of results) {
                if (Array.isArray(result) && result.length >= 2) {
                  const [streamName, messages] = result;
                  if (Array.isArray(messages)) {
                    for (const message of messages) {
                      if (Array.isArray(message) && message.length >= 2) {
                        const [id, fields] = message;
                        if (Array.isArray(fields) && fields.length > 1) {
                          const data = JSON.parse(fields[1]); // fields[1] is the 'data' value
                          subscriber.next({ id, data });
                          
                          // Acknowledge message
                          await this.redis.xack(this.streamName, consumerGroup, id);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          subscriber.error(error);
        }
      };
      
      pollEvents();
      
      return () => {
        // Cleanup
      };
    }).pipe(
      retry({ delay: 1000 }),
      share()
    );
  }
}

// 4. WebSocket Room-based Pattern
export class RoomBasedEventBus {
  private rooms = new Map<string, Subject<any>>();
  
  joinRoom(roomId: string): Observable<any> {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Subject());
    }
    return this.rooms.get(roomId)!.asObservable().pipe(share());
  }
  
  broadcastToRoom(roomId: string, message: any): void {
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId)!.next(message);
    }
  }
  
  broadcastToMultipleRooms(roomIds: string[], message: any): void {
    roomIds.forEach(roomId => this.broadcastToRoom(roomId, message));
  }
  
  // User can be in multiple rooms
  subscribeToUserRooms(userId: string, userRooms: string[]): Observable<any> {
    const streams = userRooms.map(room => this.joinRoom(room));
    return merge(...streams).pipe(
      map(event => ({ ...event, userId }))
    );
  }
}

// 5. Serverless/Edge Compatible Pattern (for Vercel, Netlify, etc.)
export class ServerlessEventBus {
  // Use external services since serverless functions are stateless
  
  async emitToWebhook(webhookUrl: string, event: any): Promise<void> {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
  }
  
  // Pusher/Ably style
  async emitToPusher(channel: string, event: string, data: any): Promise<void> {
    // Example with Pusher
    // const pusher = new Pusher({ ... });
    // await pusher.trigger(channel, event, data);
  }
  
  // Server-Sent Events for simple real-time
  createSSEStream(userId: string): Observable<any> {
    return new Observable(subscriber => {
      // In a real implementation, this would poll a database or external service
      const interval = setInterval(async () => {
        try {
          // Poll for new events for this user
          const events = await this.pollUserEvents(userId);
          events.forEach(event => subscriber.next(event));
        } catch (error) {
          subscriber.error(error);
        }
      }, 1000);
      
      return () => clearInterval(interval);
    });
  }
  
  private async pollUserEvents(userId: string): Promise<any[]> {
    // Implementation would fetch from database, Redis, etc.
    return [];
  }
}

// Usage examples:

// For single server instance
const messageQueue = new MessageQueueEventBus();
messageQueue.subscribeToTopic('payments').subscribe(console.log);
messageQueue.publishToTopic('payments', { type: 'created', id: '123' });

// For event sourcing
const eventStore = new EventStore();
eventStore.subscribe(e => e.type === 'PaymentCreated').subscribe(console.log);
eventStore.append({
  id: '1',
  type: 'PaymentCreated',
  aggregateId: 'payment-123',
  data: { amount: 100 },
  version: 1
});

// For multi-server with Redis Streams
// const redisStreams = new RedisStreamsEventBus();
// redisStreams.createObservable('payment-processors', 'server-1').subscribe(console.log);
// await redisStreams.addEvent({ type: 'created', paymentId: '123' });

// Export statements are already at class declarations