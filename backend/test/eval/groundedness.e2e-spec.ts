import { closeAgent, groundedTokens, runTurn } from './helpers/run-turn';

jest.setTimeout(180000);
afterAll(closeAgent);

// Invariant: every PS# the assistant utters must come from a rendered (grounded) block —
// the model may never speak a part number it didn't retrieve.
const QUERIES = [
  'How can I install part number PS11752778?',
  'I need a door shelf bin for a Frigidaire fridge under $40',
  'The ice maker on my Whirlpool fridge is not working. How can I fix it?',
];

describe('Groundedness', () => {
  it.each(QUERIES)('no hallucinated PS# in: "%s"', async (q) => {
    const { text, blocks } = await runTurn(undefined, q);
    const allowed = groundedTokens(blocks);
    const psInText = [...text.matchAll(/PS\d{5,}/gi)].map((m) => m[0].toUpperCase());
    for (const ps of psInText) {
      expect(allowed.has(ps)).toBe(true);
    }
  });
});
