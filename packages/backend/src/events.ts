import { Observable, Subject, fromEvent } from 'rxjs';
import { filter, map, share } from 'rxjs/operators';
import Redis from 'ioredis';

// Event types
export interface PaymentEvent {
  type: 'created' | 'statusChange' | 'failed' | 'completed';
  payment: any;
  timestamp: Date;
  userId?: string;
}

export interface EventBus {
  emit(event: PaymentEvent): Promise<void>;
  subscribe(filter?: (event: PaymentEvent) => boolean): Observable<PaymentEvent>;
  subscribeByUserId(userId: string): Observable<PaymentEvent>;
  close(): Promise<void>;
}

// 1. In-Memory Event Bus (good for single instance)
export class InMemoryEventBus implements EventBus {
  private subject = new Subject<PaymentEvent>();
  private stream$ = this.subject.asObservable().pipe(share());

  async emit(event: PaymentEvent): Promise<void> {
    this.subject.next(event);
  }

  subscribe(filterFn?: (event: PaymentEvent) => boolean): Observable<PaymentEvent> {
    if (filterFn) {
      return this.stream$.pipe(filter(filterFn));
    }
    return this.stream$;
  }

  subscribeByUserId(userId: string): Observable<PaymentEvent> {
    return this.stream$.pipe(
      filter(event => event.userId === userId)
    );
  }

  async close(): Promise<void> {
    this.subject.complete();
  }
}

// 2. Redis Pub/Sub Event Bus (scalable across multiple instances)
export class RedisEventBus implements EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private subject = new Subject<PaymentEvent>();
  private stream$ = this.subject.asObservable().pipe(share());
  private readonly channelName = 'payment-events';

  constructor(redisUrl: string = 'redis://localhost:6379') {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
    
    this.subscriber.subscribe(this.channelName);
    this.subscriber.on('message', (channel, message) => {
      if (channel === this.channelName) {
        try {
          const event: PaymentEvent = JSON.parse(message);
          this.subject.next(event);
        } catch (error) {
          console.error('Failed to parse event:', error);
        }
      }
    });
  }

  async emit(event: PaymentEvent): Promise<void> {
    const eventWithTimestamp = { ...event, timestamp: new Date() };
    await this.publisher.publish(this.channelName, JSON.stringify(eventWithTimestamp));
  }

  subscribe(filterFn?: (event: PaymentEvent) => boolean): Observable<PaymentEvent> {
    if (filterFn) {
      return this.stream$.pipe(filter(filterFn));
    }
    return this.stream$;
  }

  subscribeByUserId(userId: string): Observable<PaymentEvent> {
    return this.stream$.pipe(
      filter(event => event.userId === userId)
    );
  }

  async close(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
    this.subject.complete();
  }
}

// 3. Hybrid Event Bus (Redis + local caching)
export class HybridEventBus implements EventBus {
  private redis: RedisEventBus;
  private memory: InMemoryEventBus;

  constructor(redisUrl?: string) {
    this.redis = new RedisEventBus(redisUrl);
    this.memory = new InMemoryEventBus();
    
    // Bridge Redis events to memory for local caching
    this.redis.subscribe().subscribe(event => {
      this.memory.emit(event);
    });
  }

  async emit(event: PaymentEvent): Promise<void> {
    // Emit to Redis (which will broadcast to all instances)
    await this.redis.emit(event);
  }

  subscribe(filter?: (event: PaymentEvent) => boolean): Observable<PaymentEvent> {
    // Subscribe to local memory stream for better performance
    return this.memory.subscribe(filter);
  }

  subscribeByUserId(userId: string): Observable<PaymentEvent> {
    return this.memory.subscribeByUserId(userId);
  }

  async close(): Promise<void> {
    await this.redis.close();
    await this.memory.close();
  }
}

// Factory function to create the appropriate event bus
export function createEventBus(type: 'memory' | 'redis' | 'hybrid' = 'memory', redisUrl?: string): EventBus {
  switch (type) {
    case 'redis':
      return new RedisEventBus(redisUrl);
    case 'hybrid':
      return new HybridEventBus(redisUrl);
    default:
      return new InMemoryEventBus();
  }
}

// Helper function to convert RxJS Observable to async generator for tRPC subscriptions
export async function* observableToAsyncGenerator<T>(
  observable: Observable<T>,
  transform?: (data: T) => any
): AsyncGenerator<any, void, unknown> {
  const eventQueue: T[] = [];
  let resolveNext: ((event: T) => void) | null = null;
  let isActive = true;
  let error: any = null;
  
  const subscription = observable.subscribe({
    next: (event) => {
      if (resolveNext) {
        resolveNext(event);
        resolveNext = null;
      } else {
        eventQueue.push(event);
      }
    },
    error: (err) => {
      error = err;
      isActive = false;
      if (resolveNext) {
        resolveNext = null;
      }
    },
    complete: () => {
      isActive = false;
      if (resolveNext) {
        resolveNext = null;
      }
    }
  });

  try {
    while (isActive && !error) {
      let event: T;
      
      if (eventQueue.length > 0) {
        event = eventQueue.shift()!;
      } else {
        try {
          event = await new Promise<T>((resolve, reject) => {
            if (!isActive || error) {
              reject(error || new Error('Stream closed'));
              return;
            }
            resolveNext = resolve;
          });
        } catch (err) {
          break;
        }
      }
      
      // Transform the data if a transform function is provided
      const result = transform ? transform(event) : event;
      yield result;
    }
  } finally {
    subscription.unsubscribe();
  }
  
  if (error) {
    throw error;
  }
}

