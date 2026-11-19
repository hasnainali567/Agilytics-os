import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { EventBusService } from "./event-bus.service";
import { RealtimeController } from "./realtime.controller";

describe("RealtimeController — SSE stream (no longer 501)", () => {
  let bus: EventBusService;
  let controller: RealtimeController;

  beforeEach(() => {
    // No REDIS_URL → in-memory bus, no network.
    bus = new EventBusService({ get: () => undefined } as never);
    controller = new RealtimeController(bus);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("opens the stream with a connected event, then emits workspace events for the tenant", async () => {
    const received: unknown[] = [];
    const sub = controller.stream("tenant-1").subscribe((msg) => received.push(msg.data));
    await bus.publish({
      room: "workspace:tenant-1",
      event: "ticket.created",
      payload: { id: "T-1" },
    });
    await bus.publish({
      room: "workspace:tenant-2",
      event: "ticket.created",
      payload: { id: "T-2" },
    });
    expect(received[0]).toEqual({ event: "connected", room: "workspace:tenant-1" });
    expect(received).toContainEqual({ event: "ticket.created", payload: { id: "T-1" } });
    expect(received).not.toContainEqual({ event: "ticket.created", payload: { id: "T-2" } });
    sub.unsubscribe();
  });

  it("sends a heartbeat every 30s while subscribed, and stops on unsubscribe", () => {
    jest.useFakeTimers();
    const received: unknown[] = [];
    const sub = controller.stream("tenant-1").subscribe((msg) => received.push(msg.data));
    expect(received).toHaveLength(1); // connected only, no heartbeat yet
    jest.advanceTimersByTime(30_000);
    expect(received).toHaveLength(2);
    expect(received[1]).toMatchObject({ event: "heartbeat" });
    jest.advanceTimersByTime(30_000);
    expect(received).toHaveLength(3);
    sub.unsubscribe();
    jest.advanceTimersByTime(60_000);
    expect(received).toHaveLength(3); // no more heartbeats after unsubscribe
  });
});
