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

export const LEAVE_TYPES =
  ["Casual", "Sick", "Paid", "Unpaid", "Permission", "Work from home"] as const;
