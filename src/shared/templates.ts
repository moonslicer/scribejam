import type { TemplateId } from './ipc';

export interface TemplateDefinition {
  id: TemplateId;
  name: string;
  instructions: string;
}

export const BUILT_IN_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'auto',
    name: 'Auto',
    instructions: ''
  },
  {
    id: 'one-on-one',
    name: '1:1 with Direct Report',
    instructions: [
      'This is a 1:1 meeting between a manager and a direct report. If the relationship is not clear from the transcript, fall back gracefully to a general 1:1 structure without inventing roles.',
      '',
      'Blocks — structure in this order, skipping any section with no meaningful content:',
      '- Blockers and support needed: include blockers or requests for help that were stated clearly',
      '- Growth, performance, or career: anything discussed about the direct report\'s development',
      '- General updates',
      '- Any other topics',
      '',
      'Action items: include these — 1:1s often produce commitments from both sides. Attribute carefully: distinguish between what the direct report owns vs. what the manager committed to do.',
      '',
      'Decisions: rare in 1:1s — only include if something was explicitly agreed upon.',
      '',
      'Summary: 2–3 sentences. Name the main themes and call out any commitments the manager made.'
    ].join('\n')
  },
  {
    id: 'standup',
    name: 'Team Standup',
    instructions: [
      'This is a team standup — brief per-person status updates.',
      '',
      'Blocks: each person who gave an update should become their own heading block. Under each person, capture:',
      '- What they completed or are currently working on',
      '- Any blockers they called out',
      'Keep bullets to one line each. Skip anyone who had no substantive update.',
      '',
      'Action items: usually empty in standups. Only include them if someone explicitly committed to follow-up work during the meeting; otherwise return an empty array.',
      '',
      'Decisions: usually empty in standups. Only include them if an explicit decision was made; otherwise return an empty array.',
      '',
      'Summary: one or two sentences. Name who is blocked and on what. Skip general topic overviews.'
    ].join('\n')
  },
  {
    id: 'tech-review',
    name: 'Technical Design Review',
    instructions: [
      'This is a technical design or architecture review.',
      '',
      'Blocks — structure to capture:',
      '- The design or proposal under review',
      '- Technical objections or concerns raised (note who raised them)',
      '- Trade-offs discussed',
      '- Open questions not resolved — collect these into an explicit "Open Questions" block if any exist',
      '- Decisions reached about the design',
      '',
      'Action items: include follow-up research, design revisions, and investigation tasks when they were explicitly assigned or clearly accepted in the meeting.',
      '',
      'Decisions: this meeting type often produces design decisions — include them when the meeting reaches an explicit conclusion or clearly stated agreement. Do not infer decisions from tone alone.',
      '',
      'Summary: 2–3 sentences. Focus on what was decided, what remains open, and what the next step is.'
    ].join('\n')
  }
];

export function getBuiltInTemplateById(id: TemplateId): TemplateDefinition | undefined {
  return BUILT_IN_TEMPLATES.find((template) => template.id === id);
}

