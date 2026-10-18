export function shouldShowLastManStandingOnHome(
  competition: { status: string; finishedAt: string | null },
  now?: Date
): boolean;
