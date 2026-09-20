import { expect, test } from 'vitest';
import { applyKarmaChoice, initialKarma, KARMA_REQUESTS } from '../src/logic/karma';
import { requestOutcome } from '../src/logic/requestOutcome';

test('every normal request uses its own outcome and the actual growth deltas', () => {
  for (const request of KARMA_REQUESTS) {
    for (const accepted of [true, false]) {
      const before = initialKarma();
      const after = applyKarmaChoice(before, request, accepted);
      const outcome = requestOutcome(request, accepted, before, after);
      expect(outcome.title).not.toContain('食料');
      expect(outcome.deltas.reduce((sum, value) => sum + value, 0)).toBe(accepted ? request.karmaDelta : 3);
      expect(outcome.deltas.filter(value => value > 0)).toHaveLength(accepted ? 1 : 3);
    }
  }
});
