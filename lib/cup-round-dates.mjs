const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function cupRoundDateError(roundDates, roundCount) {
  if (roundDates.length !== roundCount || roundDates.some((date) => !isoDatePattern.test(String(date ?? "")))) {
    return "Choose a valid date for every round.";
  }
  if (roundDates.some((date, index) => index > 0 && date <= roundDates[index - 1])) {
    return "Each round date must be after the previous round.";
  }
  return null;
}
