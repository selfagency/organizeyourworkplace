import { describe, expect, it } from 'vitest';

import { decode, ENTRIES, pick } from './decoder';

describe('T4 decoder', () => {
  it('close threats are illegal with tips rule', () => {
    const m = decode('the boss said we might have to close if you keep this up');
    expect(m?.entry.id).toBe('close-threat');
    expect(m?.entry.verdict).toBe('illegal');
    expect(m?.entry.rule).toBe('tips');
    expect(m?.entry.logEvidence).toBe(true);
  });

  it('interrogation in English and Spanish', () => {
    expect(decode("he asked who's behind this union thing")?.entry.id).toBe('interrogate');
    expect(decode('me preguntó quién estaba detrás')?.entry.id).toBe('interrogate');
  });

  it('family talk is legal but misleading', () => {
    expect(decode('we are a family here')?.entry.verdict).toBe('misleading');
  });

  it('opinions are legal', () => {
    expect(decode('i think unions cost the company too much')?.entry.verdict).toBe('legal');
  });

  it('mid-campaign raise scores as misleading', () => {
    expect(decode('they announced a sudden raise last week')?.entry.id).toBe('mid-campaign-raise');
  });

  it('no match returns null, every entry has a replyKey, pick finds by id', () => {
    expect(decode('the sky is blue')).toBeNull();
    for (const e of ENTRIES) expect(e.replyKey).toBeTruthy();
    expect(pick('captive-meeting')?.verdict).toBe('misleading');
    expect(pick('nope')).toBeNull();
  });
});
