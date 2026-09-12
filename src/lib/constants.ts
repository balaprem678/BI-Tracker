export const WORK_STATUSES = [
  "Inprogress",
  "Hold",
  "Completed",
  "Testing",
  "Client Changes",
  "Bug Fixing",
  "Deployment",
  "Deployed",
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export const LEAVE_TYPES = [
  "Casual Leave",
  "Sick",
  "Emergency",
  "Permission",
  "WFH",
  "Others",
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];
