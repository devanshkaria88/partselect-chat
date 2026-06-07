import { closeAgent, runTurn } from './helpers/run-turn';

jest.setTimeout(180000);
afterAll(closeAgent);

const OUT_OF_SCOPE = [
  'How do I fix my washing machine that won’t spin?',
  'What’s the weather in San Francisco today?',
  'Can you recommend a good pizza recipe?',
  'My oven isn’t heating up, what part do I need?',
];

const IN_SCOPE = [
  'I need a water filter for my refrigerator',
  'How do I install part PS11752778?',
  'My dishwasher isn’t draining',
];

describe('Scope discipline', () => {
  it.each(OUT_OF_SCOPE)('declines out-of-scope: "%s"', async (q) => {
    const { text, blocks, tools } = await runTurn(undefined, q);
    // No tools should fire and no product/compat/troubleshoot cards should render.
    expect(tools).toHaveLength(0);
    const dataBlocks = blocks.filter((b) =>
      ['product_card', 'compat_result', 'install_guide', 'troubleshoot'].includes(b.kind),
    );
    expect(dataBlocks).toHaveLength(0);
    expect(text.toLowerCase()).toMatch(/refrigerator|dishwasher|parts/);
  });

  it.each(IN_SCOPE)('does NOT decline in-scope: "%s"', async (q) => {
    const { text } = await runTurn(undefined, q);
    // In-scope requests must not be refused (may answer, search, or ask a clarifying question).
    expect(text.toLowerCase()).not.toMatch(/can.?t help with that one/);
    expect(text.trim().length).toBeGreaterThan(0);
  });
});
