/**
 * Prompt Lab — iterate on the enhancement prompt without recording a meeting.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx vitest run scripts/prompt-lab.test.ts
 *
 * Edit NOTES and TRANSCRIPT below to test different inputs.
 * Edit build-enhancement-prompt.ts to try new prompt strategies.
 * The raw prompt sent to OpenAI and the full output are printed to stdout.
 */

import { test } from 'vitest';
import OpenAI from 'openai';
import { buildEnhancementPrompt } from '../src/main/enhancement/build-enhancement-prompt';
import type { EnhancementArtifacts } from '../src/main/enhancement/enhancement-artifacts';

// ─── Edit these to change the test input ─────────────────────────────────────

const NOTES: EnhancementArtifacts['noteContent'] = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'anthropic getting alot of revenue' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'ai replacing labor not just it backend apis.' }] }
  ]
};

const TRANSCRIPT: EnhancementArtifacts['transcriptSegments'] = [
  { id: 1,  speaker: 'you',  startTs: 0,      endTs: 4000,  isFinal: true, text: "Alright, everybody. Welcome back to the number one podcast in world." },
  { id: 2,  speaker: 'them', startTs: 4000,   endTs: 14000, isFinal: true, text: "Welcome back. We haven't seen you on the pod since you're showered out at the state of the union. Take us behind the scenes for a brief moment here, Brad." },
  { id: 3,  speaker: 'them', startTs: 14000,  endTs: 24000, isFinal: true, text: "Did you know it was coming? Did you choreograph that, or was that more spontaneous?" },
  { id: 4,  speaker: 'you',  startTs: 24000,  endTs: 40000, isFinal: true, text: "I honestly had no idea it was coming. I found out after the fact that it wasn't in the speech and the president added it. We got an invite to the State of the Union and I've never been. I didn't know he was gonna talk about Trump accounts." },
  { id: 5,  speaker: 'them', startTs: 40000,  endTs: 60000, isFinal: true, text: "They're valued at a meager hundred eighty billion last month. Opening act ended twenty twenty five at twenty billion annualized run rate. They've grown revenue from two billion to twenty billion in twenty four months. They're valued at eight hundred forty billion last month, and it looks like Sam Altman has Dario in the rearview mirror." },
  { id: 6,  speaker: 'you',  startTs: 60000,  endTs: 80000, isFinal: true, text: "Nobody expected Dario to be coming around the bend this fast. He's right behind, apparently, and they're winning the business to business side. J curve on these companies is insane. Between two hundred fifty, five hundred billion who knows what gets invested before these companies reach profitability." },
  { id: 7,  speaker: 'them', startTs: 80000,  endTs: 100000, isFinal: true, text: "What's a better buy here? Anthropic at three eighty, OpenAI at eight forty, and do you think these companies should go public?" },
  { id: 8,  speaker: 'you',  startTs: 100000, endTs: 130000, isFinal: true, text: "I love your children equally. They're both incredible companies. The single most important question this year was: would AI revenue show up? Just sixty days ago there was tremendous skepticism. But in January and February we really had a nuclear moment. We had a six billion dollar month out of Anthropic in February. That's a 28 day month. That's more revenue than the annual revenue of Databricks and Snowflake after twelve years." },
  { id: 9,  speaker: 'them', startTs: 130000, endTs: 145000, isFinal: true, text: "Six billion dollars in a month. It was only a twenty eight day month. That's more of revenue than the annual revenue of Databricks and Snowflake that are two of the greatest software companies of all time after twelve years." },
  { id: 10, speaker: 'you',  startTs: 145000, endTs: 170000, isFinal: true, text: "We crossed a threshold with Opus 4.6 and again with ChatGPT 5.4. The models and agents are no longer competing with IT agents. They're now augmenting labor. They're competing with labor budgets. You could not possibly have a six billion dollar month by displacing IT budgets." },
  { id: 11, speaker: 'you',  startTs: 170000, endTs: 195000, isFinal: true, text: "Millions of companies across America say, oh my god, let's spin up these agents and have them do things for us, and we're willing to pay for it because the product of that effort is worth the money. The revenue and usage momentum in March continues and only accelerates from here. Kevin Weil said the models and agents are the dumbest today they will ever be." },
  { id: 12, speaker: 'you',  startTs: 195000, endTs: 225000, isFinal: true, text: "Should they go public? Yes. There's tons of institutional demand. They need cheap access to money to build out compute. There is more compute constraint in these businesses today than any time in the last three years. And you have to have the retail investor in the game. These are two of the most important companies in the history of capitalism. Jensen said he expected his forty billion dollar investment would be his last because they were both going to go public this year." },
  { id: 13, speaker: 'you',  startTs: 225000, endTs: 255000, isFinal: true, text: "The real question is adoption quality. We have all kinds of claims but we are still experimenting. You can't just slot AI into critical workflow in healthcare where if you make a misdiagnosis you can get fined and go to jail. In financial services if you make a mistake about somebody's portfolio you will get sued." },
  { id: 14, speaker: 'them', startTs: 255000, endTs: 275000, isFinal: true, text: "Companies that use Databricks and Snowflake generate enormous revenues and margins and these products are in critical production workflows. That is just not true with AI yet. We are still experimenting." },
  { id: 15, speaker: 'you',  startTs: 275000, endTs: 305000, isFinal: true, text: "Amazon issued an edict that you cannot use agent code inside AWS unless a human reviews it. Because they had three or four sev one faults from code written by agents. I love AWS for hyper reliability. The reason they have twelve nines of accuracy is humans and deterministic code. It doesn't mean these companies can't get to twenty, thirty, forty billion of revenue. But this is an industry that's early. Let's not oversell what this moment is." }
];

// ─────────────────────────────────────────────────────────────────────────────

const MODEL = 'gpt-5-mini';

test('prompt lab', async () => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('\n  ⚠️  Set OPENAI_API_KEY env var to run the prompt lab.\n');
    return;
  }

  const artifacts: EnhancementArtifacts = {
    meetingId: 'prompt-lab',
    meetingTitle: 'All-In Podcast — AI Revenue & IPO Discussion',
    noteContent: NOTES,
    transcriptSegments: TRANSCRIPT
  };

  const { systemPrompt, userPrompt } = buildEnhancementPrompt(artifacts);

  console.log('\n═══════════════════════════ SYSTEM PROMPT ════════════════════════════\n');
  console.log(systemPrompt);
  console.log('\n════════════════════════════ USER PROMPT ═════════════════════════════\n');
  console.log(userPrompt);
  console.log('\n══════════════════════════════ OUTPUT ════════════════════════════════\n');

  const client = new OpenAI({ apiKey, timeout: 60_000 });

  const t0 = Date.now();
  const response = await client.responses.create({
    model: MODEL,
    instructions: systemPrompt,
    input: userPrompt,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: 'enhanced_output',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['blocks', 'actionItems', 'decisions', 'summary'],
          properties: {
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['source', 'content'],
                properties: {
                  source: { type: 'string', enum: ['human', 'ai'] },
                  content: { type: 'string' }
                }
              }
            },
            actionItems: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['owner', 'description', 'due'],
                properties: {
                  owner: { type: 'string' },
                  description: { type: 'string' },
                  due: { type: ['string', 'null'] }
                }
              }
            },
            decisions: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['description', 'context'],
                properties: {
                  description: { type: 'string' },
                  context: { type: 'string' }
                }
              }
            },
            summary: { type: 'string' }
          }
        }
      }
    }
  });

  console.log(`\nModel: ${MODEL}  |  Latency: ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  const parsed = JSON.parse(response.output_text);

  // Pretty-print blocks — group consecutive human+ai pairs
  let i = 0;
  while (i < parsed.blocks.length) {
    const block = parsed.blocks[i];
    if (block.source === 'human') {
      console.log(`\n\x1b[1m${block.content}\x1b[0m`); // bold heading
      i++;
      while (i < parsed.blocks.length && parsed.blocks[i].source === 'ai') {
        console.log(parsed.blocks[i].content);
        i++;
      }
    } else {
      console.log('\n' + block.content);
      i++;
    }
  }

  if (parsed.summary) {
    console.log('─── Summary ─────────────────────────────────────────────────────────');
    console.log(parsed.summary);
  }

  if (parsed.actionItems.length > 0) {
    console.log('\n─── Action Items ────────────────────────────────────────────────────');
    for (const item of parsed.actionItems) {
      const due = item.due ? ` (due: ${item.due})` : '';
      console.log(`  • [${item.owner}] ${item.description}${due}`);
    }
  }

  if (parsed.decisions.length > 0) {
    console.log('\n─── Decisions ───────────────────────────────────────────────────────');
    for (const d of parsed.decisions) {
      console.log(`  • ${d.description} — ${d.context}`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════════════\n');
}, 120_000);
