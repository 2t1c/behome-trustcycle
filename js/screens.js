// Every screen in the prototype, in journey order. `file` is the name the screens link to.
export const STAGES = [
  { id: 0, label: 'Overview' },
  { id: 1, label: 'Stage 1 · Pre-booking' },
  { id: 2, label: 'Stage 2 · Booking' },
  { id: 3, label: 'Stage 3 · Service delivery' },
  { id: 4, label: 'Stage 4 · Post-service' },
  { id: 5, label: 'Stage 5 · Rebooking' },
];

export const SCREENS = [
  { file: 'V2-0-Guide', label: 'Start here · guide', stage: 0, board: true },
  { file: 'V2-0-DVF', label: 'DVF check', stage: 0, board: true },
  { file: 'V2-1-1-CleaningLevel', label: '1.1 Cleaning level', stage: 1 },
  { file: 'V2-1-2-YourHome', label: '1.2 Your home', stage: 1 },
  { file: 'V2-1-3-Priorities', label: '1.3 Priority areas', stage: 1 },
  { file: 'V2-1-4-RecommendedPlan', label: '1.4 Recommended plan', stage: 1 },
  { file: 'V2-1-5-QualityAgreement', label: '1.5 Quality Agreement', stage: 1 },
  { file: 'V2-1-6-RecoveryPolicy', label: '1.6 Recovery Promise', stage: 1 },
  { file: 'V2-2-1-MatchedTaskers', label: '2.1 Matched Taskers', stage: 2 },
  { file: 'V2-2-2-CapabilityCard', label: '2.2 Quality profile', stage: 2 },
  { file: 'V2-2-3-SendRequest', label: '2.3 Send request', stage: 2 },
  { file: 'V2-2-4-TaskerConfirms', label: '2.4 Tasker confirms', stage: 2, tasker: true },
  { file: 'V2-2-5-BookingConfirmed', label: '2.5 Confirm booking', stage: 2 },
  { file: 'V2-3-1-FirstCleanCheck', label: '3.1 First-visit check', stage: 3, tasker: true },
  { file: 'V2-3-2-ApproveChange', label: '3.2 Approve a change', stage: 3 },
  { file: 'V2-3-3-PhotoChecklist', label: '3.3 Photo checklist', stage: 3, tasker: true },
  { file: 'V2-4-1-CheckResult', label: '4.1 Check the result', stage: 4 },
  { file: 'V2-4-2-ReportNotMet', label: '4.2 Report an item not met', stage: 4 },
  { file: 'V2-4-3-CaseFeedback', label: '4.3 Your case', stage: 4 },
  { file: 'V2-5-1-RebookPlan', label: '5.1 Book again', stage: 5 },
];

// Names the v1 prototype used for the same boards.
export const ALIASES = { 'TC00-Guide': 'V2-0-Guide', 'TC01-DVF': 'V2-0-DVF' };

export const byFile = (file) => SCREENS.find((s) => s.file === (ALIASES[file] || file));
