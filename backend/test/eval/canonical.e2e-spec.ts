import { CompatResult, InstallGuide, ProductCard, TroubleshootBlock } from '@partselect/types';
import { closeAgent, runTurn } from './helpers/run-turn';

// The three must-pass case-study journeys. Requires Postgres seeded with enrichment
// and ANTHROPIC_API_KEY set. Run with: pnpm --filter backend eval
jest.setTimeout(180000);
afterAll(closeAgent);

describe('UC1 — installation for an exact part', () => {
  it('returns a grounded install guide for PS11752778', async () => {
    const { text, blocks, tools } = await runTurn(undefined, 'How can I install part number PS11752778?');
    expect(tools).toContain('get_install_guide');
    const guide = blocks.find((b): b is InstallGuide => b.kind === 'install_guide');
    expect(guide).toBeDefined();
    expect(guide!.ps_number).toBe('PS11752778');
    expect(guide!.available).toBe(true);
    expect(guide!.video_url).toMatch(/youtube\.com/);
    expect(text.length).toBeGreaterThan(40);
  });
});

describe('UC2 — compatibility with a model number', () => {
  it('resolves "this part" from context and confirms it fits WDT780SAEM1', async () => {
    // Turn 1 establishes a specific part as the conversational referent.
    const first = await runTurn(undefined, 'Tell me about part PS11753379');
    const card = first.blocks.find((b): b is ProductCard => b.kind === 'product_card');
    expect(card).toBeDefined();
    expect(card!.ps_number).toBe('PS11753379');

    // Turn 2 says "this part" — the agent must resolve it and check the real mapping.
    const second = await runTurn(first.sessionId, 'Is this part compatible with my WDT780SAEM1 model?');
    expect(second.tools).toContain('check_compatibility');
    const verdict = second.blocks.find((b): b is CompatResult => b.kind === 'compat_result');
    expect(verdict).toBeDefined();
    expect(verdict!.model_number).toBe('WDT780SAEM1');
    expect(verdict!.verdict).toBe('COMPATIBLE');
  });
});

describe('UC3 — symptom troubleshooting', () => {
  it('diagnoses the Whirlpool ice maker and recommends real parts', async () => {
    const { blocks, tools } = await runTurn(
      undefined,
      'The ice maker on my Whirlpool fridge is not working. How can I fix it?',
    );
    expect(tools).toContain('troubleshoot_symptom');
    const ts = blocks.find((b): b is TroubleshootBlock => b.kind === 'troubleshoot');
    expect(ts).toBeDefined();
    expect(ts!.parts.length).toBeGreaterThan(0);
    expect(ts!.safety_note.length).toBeGreaterThan(0);
    // Every recommended part is a real in-scope catalog part.
    ts!.parts.forEach((p) => expect(p.ps_number).toMatch(/^PS\d{5,}$/));
  });
});
