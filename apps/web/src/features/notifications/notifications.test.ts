import { describe, expect, it } from "vitest";
import { filterNotifications, type NotificationItem } from "./notifications.api";

const items: NotificationItem[] = [
  {
    id: "1",
    type: "MENTION",
    title: "Mentioned",
    isRead: false,
    createdAt: "2026-11-18T10:00:00.000Z",
  },
  {
    id: "2",
    type: "ASSIGNMENT",
    title: "Assigned",
    isRead: true,
    createdAt: "2026-11-18T09:00:00.000Z",
  },
  {
    id: "3",
    type: "BLOCKER",
    title: "Blocked",
    isRead: false,
    createdAt: "2026-11-18T08:00:00.000Z",
  },
];

describe("filterNotifications", () => {
  it("returns everything for ALL", () => {
    expect(filterNotifications(items, "ALL")).toHaveLength(3);
  });

  it("returns only unread for UNREAD", () => {
    expect(filterNotifications(items, "UNREAD").map((n) => n.id)).toEqual(["1", "3"]);
  });

  it("filters by type", () => {
    expect(filterNotifications(items, "ASSIGNMENT").map((n) => n.id)).toEqual(["2"]);
    expect(filterNotifications(items, "AUTOMATION")).toHaveLength(0);
  });
});
