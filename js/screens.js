// Every screen in the app, in journey order. `file` is the name the screens link to.
export const STAGES = [
  { id: 0, label: 'Start', title: 'Start', color: '#0B1620' },
  { id: 1, label: 'Stage 1 · Pre-booking', title: 'Personalise cleaning expectations', color: '#0F766E',
    solves: "Solves: hours that don't match the job, and not knowing what a package covers." },
  { id: 2, label: 'Stage 2 · Booking', title: 'Capability-based Tasker matching', color: '#1D4ED8',
    solves: "Solves: choosing a Tasker is luck, and skills aren't matched to the job." },
  { id: 3, label: 'Stage 3 · Service delivery', title: 'First-clean quality assurance', color: '#0F766E',
    solves: 'Solves: re-briefing at the door, and surprise extra time or cost.',
    foot: "First booking only. Home matches the agreement? 3.1 goes straight to 3.3 and chị Lan isn't contacted." },
  { id: 4, label: 'Stage 4 · Post-service', title: 'Quality verification and recovery', color: '#B45309',
    solves: 'Solves: no way to check what was done, and vague complaint handling.',
    foot: 'All met: 4.1 → 5.1. Something not met: 4.1 → 4.2 → 4.3 → 5.1.' },
  { id: 5, label: 'Stage 5 · Rebooking', title: 'Continuous quality improvement', color: '#6D28D9',
    solves: 'Solves: starting from zero each time, and a good Tasker who is hard to get back.' },
];

// `side`: a side trip or branch off the main path. `board`: a wide board, not a phone screen.
export const SCREENS = [
  { file: 'V2-0-Welcome', label: 'Welcome', stage: 0, hidden: true },
  { file: 'V2-0-Journey', label: 'The journey', stage: 0, num: '', sub: 'user flow, all screens' },
  { file: 'V2-0-Guide', label: 'Concept guide', stage: 0, num: '', sub: 'the full design board', board: true },
  { file: 'V2-0-DVF', label: 'DVF check', stage: 0, num: '', sub: 'desirable, viable, feasible', board: true },
  { file: 'V2-1-1-CleaningLevel', label: '1.1 Cleaning level', num: '1.1', name: 'Cleaning level', sub: 'Standard or Deep', stage: 1 },
  { file: 'V2-1-2-YourHome', label: '1.2 Your home', num: '1.2', name: 'Your home', sub: 'm², rooms, condition', stage: 1 },
  { file: 'V2-1-3-Priorities', label: '1.3 Priority areas', num: '1.3', name: 'Priority areas', sub: 'must-dos vs 4 hours', stage: 1 },
  { file: 'V2-1-4-RecommendedPlan', label: '1.4 Recommended plan', num: '1.4', name: 'Recommended plan', sub: '4 h · 320,000đ', stage: 1 },
  { file: 'V2-1-5-QualityAgreement', label: '1.5 Quality Agreement', num: '1.5', name: 'Quality Agreement', sub: 'will and won’t be done', stage: 1 },
  { file: 'V2-1-6-RecoveryPolicy', label: '1.6 Recovery Promise', num: '1.6', name: 'Recovery Promise', sub: 'opens from 1.5', stage: 1, side: true },
  { file: 'V2-2-1-MatchedTaskers', label: '2.1 Matched Taskers', num: '2.1', name: 'Matched Taskers', sub: 'capable only', stage: 2 },
  { file: 'V2-2-2-CapabilityCard', label: '2.2 Quality profile', num: '2.2', name: 'Quality profile', sub: 'fit: 7 of 7', stage: 2, side: true },
  { file: 'V2-2-3-SendRequest', label: '2.3 Send request', num: '2.3', name: 'Send request', sub: 'held for her OK', stage: 2 },
  { file: 'V2-2-4-TaskerConfirms', label: '2.4 Tasker confirms', num: '2.4', name: 'Tasker confirms', sub: 'she checks the agreement', stage: 2, tasker: true },
  { file: 'V2-2-5-BookingConfirmed', label: '2.5 Confirm booking', num: '2.5', name: 'You confirm', sub: 'after she accepts', stage: 2 },
  { file: 'V2-3-1-FirstCleanCheck', label: '3.1 First-visit check', num: '3.1', name: 'First-visit check', sub: 'rooms match?', stage: 3, tasker: true },
  { file: 'V2-3-2-ApproveChange', label: '3.2 Approve a change', num: '3.2', name: 'Approve a change', sub: 'only if it differs', stage: 3, side: true },
  { file: 'V2-3-3-PhotoChecklist', label: '3.3 Photo checklist', num: '3.3', name: 'Photo checklist', sub: 'an after-photo per must-do', stage: 3, tasker: true },
  { file: 'V2-4-1-CheckResult', label: '4.1 Check the result', num: '4.1', name: 'Check the result', sub: 'item by item', stage: 4 },
  { file: 'V2-4-2-ReportNotMet', label: '4.2 Report an item not met', num: '4.2', name: 'Report not met', sub: 'within 24 h', stage: 4, side: true },
  { file: 'V2-4-3-CaseFeedback', label: '4.3 Your case', num: '4.3', name: 'Your case', sub: 'vs the agreement', stage: 4, side: true },
  { file: 'V2-5-1-RebookPlan', label: '5.1 Book again', num: '5.1', name: 'Book again', sub: 'saved plan, Nga first', stage: 5 },
];

// The main path a presenter walks (and tests/flow.js taps through): no side trips.
export const MAIN_PATH = [
  'V2-0-Welcome', 'V2-1-1-CleaningLevel', 'V2-1-2-YourHome', 'V2-1-3-Priorities', 'V2-1-4-RecommendedPlan',
  'V2-1-5-QualityAgreement', 'V2-2-1-MatchedTaskers', 'V2-2-3-SendRequest', 'V2-2-4-TaskerConfirms',
  'V2-2-5-BookingConfirmed', 'V2-3-1-FirstCleanCheck', 'V2-3-3-PhotoChecklist', 'V2-4-1-CheckResult', 'V2-5-1-RebookPlan',
];

// Names the v1 prototype used for the same boards.
export const ALIASES = { 'TC00-Guide': 'V2-0-Guide', 'TC01-DVF': 'V2-0-DVF' };

export const byFile = (file) => SCREENS.find((s) => s.file === (ALIASES[file] || file));
