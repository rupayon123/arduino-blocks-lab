import { describe, expect, it } from "vitest";
import { lessons } from "@abl/catalog";
import { createMissionProgression, missionStatusLabel } from "./missionProgression";

describe("mission progression", () => {
  it("starts with the first mission ready and later missions locked", () => {
    const progression = createMissionProgression(lessons, {});

    expect(progression.completedCount).toBe(0);
    expect(progression.totalCount).toBe(lessons.length);
    expect(progression.progressPercent).toBe(0);
    expect(progression.recommended?.lesson.id).toBe(lessons[0]?.id);
    expect(progression.items[0]?.status).toBe("ready");
    expect(progression.items[1]?.status).toBe("locked");
    expect(progression.items[1]?.lockedBy?.id).toBe(lessons[0]?.id);
  });

  it("unlocks the next lesson after the previous mission is complete", () => {
    const progression = createMissionProgression(lessons, { [lessons[0]!.id]: true });

    expect(progression.completedCount).toBe(1);
    expect(progression.items[0]?.status).toBe("complete");
    expect(progression.items[1]?.status).toBe("ready");
    expect(progression.recommended?.lesson.id).toBe(lessons[1]?.id);
    expect(progression.completedMinutes).toBe(lessons[0]?.minutes);
    expect(progression.remainingMinutes).toBe(progression.totalMinutes - progression.completedMinutes);
  });

  it("has no recommended mission once every mission is complete", () => {
    const progress = Object.fromEntries(lessons.map((lesson) => [lesson.id, true]));
    const progression = createMissionProgression(lessons, progress);

    expect(progression.progressPercent).toBe(100);
    expect(progression.recommended).toBeUndefined();
    expect(progression.items.every((item) => item.status === "complete")).toBe(true);
  });

  it("labels mission statuses for the UI", () => {
    expect(missionStatusLabel("complete")).toBe("Complete");
    expect(missionStatusLabel("ready")).toBe("Ready");
    expect(missionStatusLabel("locked")).toBe("Locked");
  });
});
