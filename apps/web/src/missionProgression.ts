import type { LessonDefinition } from "@abl/block-schema";

export type MissionStatus = "complete" | "ready" | "locked";

export type MissionProgressionItem = {
  lesson: LessonDefinition;
  index: number;
  status: MissionStatus;
  lockedBy?: LessonDefinition;
};

export type MissionProgression = {
  items: MissionProgressionItem[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  totalMinutes: number;
  completedMinutes: number;
  remainingMinutes: number;
  recommended?: MissionProgressionItem;
};

function lessonMinutes(lesson: LessonDefinition) {
  return lesson.minutes ?? Math.max(15, 10 + lesson.starterProject.components.length * 5 + lesson.starterProject.program.length * 3);
}

export function createMissionProgression(lessons: LessonDefinition[], progress: Record<string, boolean>): MissionProgression {
  let firstIncompleteIndex = lessons.findIndex((lesson) => !progress[lesson.id]);
  if (firstIncompleteIndex === -1) firstIncompleteIndex = lessons.length;

  const items = lessons.map((lesson, index) => {
    const complete = Boolean(progress[lesson.id]);
    const status: MissionStatus = complete ? "complete" : index === firstIncompleteIndex ? "ready" : "locked";
    return {
      lesson,
      index,
      status,
      ...(status === "locked" && firstIncompleteIndex >= 0 ? { lockedBy: lessons[firstIncompleteIndex] } : {})
    };
  });

  const completedCount = items.filter((item) => item.status === "complete").length;
  const totalMinutes = lessons.reduce((total, lesson) => total + lessonMinutes(lesson), 0);
  const completedMinutes = lessons.reduce((total, lesson) => total + (progress[lesson.id] ? lessonMinutes(lesson) : 0), 0);

  return {
    items,
    completedCount,
    totalCount: lessons.length,
    progressPercent: lessons.length === 0 ? 0 : Math.round((completedCount / lessons.length) * 100),
    totalMinutes,
    completedMinutes,
    remainingMinutes: Math.max(0, totalMinutes - completedMinutes),
    recommended: items.find((item) => item.status === "ready")
  };
}

export function missionStatusLabel(status: MissionStatus) {
  if (status === "complete") return "Complete";
  if (status === "ready") return "Ready";
  return "Locked";
}
