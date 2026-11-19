import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** One envelope for every realtime event, whatever the transport. */
export interface RealtimeEnvelope {
  /** Room to emit to, e.g. `workspace:demo-tenant` or `ticket:<id>`. */
  room: string;
  /** Event name, e.g. `ticket.created`. */
  event: string;
  payload: unknown;
}

type Handler = (envelope: RealtimeEnvelope) => void;

/**
 * Pub-sub abstraction (docs/REALTIME.md §3 Phase 2).
 *
 * - **In-memory (default):** single-task local dev — no Redis required,
 *   the app boots and realtime works with zero extra infrastructure.
 * - **Redis/Valkey (optional):** enabled only when `REDIS_URL` is set.
 *   The gateway publishes through this bus, so with more than one
 *   Fargate task an event emitted on task A reaches sockets on task B.
 *   `ioredis` is loaded lazily (require) so the app still boots when
 *   the package — or the server — is absent; a Redis failure at runtime
 *   degrades to a logged warning, never a crashed request.
 *
 * Channel: one channel, `agilytics:realtime`. Production (multi-task)
 * uses Redis/Valkey via REDIS_URL; ElastiCache Serverless Terraform is
 * still a TODO (see docs/REALTIME.md).
 */
@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlers = new Set<Handler>();
  private readonly redisUrl?: string;
  private publisher: { publish(channel: string, message: string): Promise<unknown> } | null = null;
  private subscriber: {
    subscribe(channel: string): Promise<unknown>;
    on(event: string, cb: (...args: unknown[]) => void): void;
    disconnect(): void;
  } | null = null;

  constructor(config: ConfigService) {
    this.redisUrl = config.get<string>("REDIS_URL") || undefined;
  }

  /** Which backend is active — "memory" locally, "redis" when REDIS_URL is set. */
  get backend(): "memory" | "redis" {
    return this.redisUrl ? "redis" : "memory";
  }

  async onModuleInit(): Promise<void> {
    if (!this.redisUrl) return;
    try {
      // Lazy require: ioredis is an optional dependency.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Redis = require("ioredis") as new (
        url: string,
        opts?: Record<string, unknown>,
      ) => {
        publish(channel: string, message: string): Promise<number>;
        subscribe(channel: string): Promise<number>;
        on(event: string, cb: (...args: unknown[]) => void): void;
        disconnect(): void;
      };
      this.publisher = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: false,
      });
      const subscriber = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: false,
      });
      this.subscriber = subscriber;
      await subscriber.subscribe("agilytics:realtime");
      subscriber.on("message", (_channel: unknown, message: unknown) => {
        if (typeof message !== "string") return;
        try {
          this.deliver(JSON.parse(message) as RealtimeEnvelope);
        } catch {
          // Malformed envelope from another publisher — ignore it.
        }
      });
      this.logger.log("Realtime event bus: redis backend (REDIS_URL set)");
    } catch (err) {
      this.logger.warn(
        `Realtime event bus: Redis unavailable (${(err as Error).message}) — falling back to in-memory; multi-task fan-out is off`,
      );
      this.publisher = null;
      this.subscriber = null;
    }
  }

  onModuleDestroy(): void {
    this.subscriber?.disconnect();
    // The publisher has no disconnect in the narrowed type; ioredis
    // disconnect is best-effort here — process shutdown closes it.
    (this.publisher as { disconnect?: () => void } | null)?.disconnect?.();
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /** Publish an envelope to every task (Redis) or this task (memory). Never throws. */
  async publish(envelope: RealtimeEnvelope): Promise<void> {
    try {
      if (this.publisher) {
        await this.publisher.publish("agilytics:realtime", JSON.stringify(envelope));
        return;
      }
      this.deliver(envelope);
    } catch (err) {
      this.logger.warn(`Realtime publish failed (${(err as Error).message}) — event dropped`);
    }
  }

  private deliver(envelope: RealtimeEnvelope): void {
    for (const handler of this.handlers) {
      try {
        handler(envelope);
      } catch {
        // One bad subscriber must never break the others.
      }
    }
  }
}
