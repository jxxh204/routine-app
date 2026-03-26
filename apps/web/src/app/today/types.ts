export type Routine = {
  id: string;
  title: string;
  timeRangeLabel: string;
  startMinute: number;
  endMinute: number;
  doneByMe: boolean;
  doneByBuddy: boolean;
  doneAt?: string;
  proofImage?: string;
  isDefault: boolean;
};

export type StoredRoutineDefinition = {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
};
