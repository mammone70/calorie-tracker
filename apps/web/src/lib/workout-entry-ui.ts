import type { QueryClient } from '@tanstack/react-query';
import type {
  PrescriptionKind,
  WorkoutBlock,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from '@calorie-tracker/shared';

export type OptimisticTemplateExerciseInput = {
  id?: string;
  userId: string;
  templateId: string;
  exerciseId: string | null;
  bodyPart: string | null;
  weekIndex: number;
  sortIndex: number;
  targetSets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  targetWeight: number | null;
  prescriptionKind: PrescriptionKind;
  prescriptionValue: number | null;
};

export type WorkoutBoardData = {
  templates: WorkoutTemplate[];
  entries: WorkoutTemplateExercise[];
  block: WorkoutBlock;
};

export function optimisticTemplateExercise(
  input: OptimisticTemplateExerciseInput,
): WorkoutTemplateExercise {
  const now = new Date().toISOString();
  return {
    id: input.id ?? crypto.randomUUID(),
    userId: input.userId,
    templateId: input.templateId,
    exerciseId: input.exerciseId,
    bodyPart: input.bodyPart,
    weekIndex: input.weekIndex,
    sortIndex: input.sortIndex,
    targetSets: input.targetSets,
    repsMin: input.repsMin,
    repsMax: input.repsMax,
    targetWeight: input.targetWeight,
    prescriptionKind: input.prescriptionKind,
    prescriptionValue: input.prescriptionValue,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

/** Shared enter/exit for workout exercise rows (board + mobile). */
export const workoutEntryMotion = {
  initial: { opacity: 0, height: 0, y: -4 },
  animate: { opacity: 1, height: 'auto', y: 0 },
  exit: { opacity: 0, height: 0, y: -4 },
  transition: {
    layout: { type: 'spring' as const, stiffness: 420, damping: 36 },
    opacity: { duration: 0.18 },
    height: { duration: 0.2 },
    y: { duration: 0.18 },
  },
};

export function workoutBoardQueryKey(forUserId?: string) {
  return ['workout-board', forUserId] as const;
}

export function workoutTemplateExercisesQueryKey(
  templateId: string | null | undefined,
  forUserId?: string,
) {
  return ['workout-template-exercises', templateId, forUserId] as const;
}

/** Client-id → server-id for optimistic rows (shared across board + mobile). */
const serverIdByClientId = new Map<string, string>();
const pendingCreates = new Map<string, Promise<string>>();

export function resolveWorkoutEntryServerId(clientId: string): string {
  return serverIdByClientId.get(clientId) ?? clientId;
}

export function rememberWorkoutEntryServerId(clientId: string, serverId: string) {
  serverIdByClientId.set(clientId, serverId);
}

export function forgetWorkoutEntryClientId(clientId: string) {
  serverIdByClientId.delete(clientId);
  pendingCreates.delete(clientId);
}

export function setPendingWorkoutCreate(clientId: string, promise: Promise<string>) {
  pendingCreates.set(clientId, promise);
}

export function takePendingWorkoutCreate(clientId: string) {
  const promise = pendingCreates.get(clientId);
  pendingCreates.delete(clientId);
  return promise;
}

export function clearWorkoutEntryIdMaps() {
  serverIdByClientId.clear();
  pendingCreates.clear();
}

function entryIdsMatch(entryId: string, targetId: string): boolean {
  if (entryId === targetId) return true;
  const mapped = serverIdByClientId.get(targetId);
  if (mapped && entryId === mapped) return true;
  for (const [clientId, serverId] of serverIdByClientId) {
    if (serverId === targetId && entryId === clientId) return true;
  }
  return false;
}

/**
 * Keep the desktop board and mobile template-exercise list in sync.
 * Updates the per-template list first (seeded from the pre-patch board when needed),
 * then patches the board so seeding cannot double-apply the same change.
 */
export function patchWorkoutExerciseCaches(
  queryClient: QueryClient,
  forUserId: string | undefined,
  templateId: string,
  updater: (entries: WorkoutTemplateExercise[]) => WorkoutTemplateExercise[],
) {
  const boardKey = workoutBoardQueryKey(forUserId);
  const templateKey = workoutTemplateExercisesQueryKey(templateId, forUserId);
  const board = queryClient.getQueryData<WorkoutBoardData>(boardKey);

  const previousTemplate =
    queryClient.getQueryData<WorkoutTemplateExercise[]>(templateKey) ??
    board?.entries.filter((entry) => entry.templateId === templateId) ??
    [];

  queryClient.setQueryData<WorkoutTemplateExercise[]>(
    templateKey,
    updater(previousTemplate),
  );

  queryClient.setQueryData<WorkoutBoardData>(boardKey, (current) => {
    if (!current) return current;
    return { ...current, entries: updater(current.entries) };
  });
}

export function templateExercisesFromBoard(
  queryClient: QueryClient,
  forUserId: string | undefined,
  templateId: string,
): WorkoutTemplateExercise[] | undefined {
  const board = queryClient.getQueryData<WorkoutBoardData>(workoutBoardQueryKey(forUserId));
  if (!board) return undefined;
  return board.entries
    .filter((entry) => entry.templateId === templateId)
    .sort((a, b) => a.sortIndex - b.sortIndex);
}

export function snapshotWorkoutExerciseCaches(
  queryClient: QueryClient,
  forUserId: string | undefined,
  templateId: string,
) {
  return {
    board: queryClient.getQueryData<WorkoutBoardData>(workoutBoardQueryKey(forUserId)),
    templateExercises: queryClient.getQueryData<WorkoutTemplateExercise[]>(
      workoutTemplateExercisesQueryKey(templateId, forUserId),
    ),
  };
}

export function restoreWorkoutExerciseCaches(
  queryClient: QueryClient,
  forUserId: string | undefined,
  templateId: string,
  snapshot: ReturnType<typeof snapshotWorkoutExerciseCaches>,
) {
  const boardKey = workoutBoardQueryKey(forUserId);
  const templateKey = workoutTemplateExercisesQueryKey(templateId, forUserId);

  if (snapshot.board !== undefined) {
    queryClient.setQueryData(boardKey, snapshot.board);
  }

  if (snapshot.templateExercises !== undefined) {
    queryClient.setQueryData(templateKey, snapshot.templateExercises);
  } else if (snapshot.board) {
    queryClient.setQueryData(
      templateKey,
      snapshot.board.entries.filter((entry) => entry.templateId === templateId),
    );
  } else {
    queryClient.removeQueries({ queryKey: templateKey });
  }
}

export function removeWorkoutEntryFromCaches(
  queryClient: QueryClient,
  forUserId: string | undefined,
  templateId: string,
  entryId: string,
) {
  patchWorkoutExerciseCaches(queryClient, forUserId, templateId, (entries) =>
    entries.filter((entry) => !entryIdsMatch(entry.id, entryId)),
  );
}

export function upsertWorkoutEntryInCaches(
  queryClient: QueryClient,
  forUserId: string | undefined,
  templateId: string,
  entry: WorkoutTemplateExercise,
  matchId?: string,
) {
  const idToReplace = matchId ?? entry.id;
  patchWorkoutExerciseCaches(queryClient, forUserId, templateId, (entries) => {
    const index = entries.findIndex((row) => entryIdsMatch(row.id, idToReplace));
    if (index === -1) return [...entries, entry];
    const next = entries.slice();
    next[index] = entry;
    return next;
  });
}
