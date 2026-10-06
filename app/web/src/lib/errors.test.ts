import { describe, expect, it } from 'vitest';
import { reduceErrors } from './errors';

// Port of lwc/ldsUtils/__tests__/ldsUtils.test.js
describe('lib/errors (c-lds-utils)', () => {
  describe('reduceErrors', () => {
    it('reduces single error with message in body', () => {
      const FULL_ERROR = { body: { message: 'mockError' } };
      expect(reduceErrors(FULL_ERROR)).toStrictEqual([FULL_ERROR.body.message]);
    });

    it('reduces single error with multiple bodies with messages', () => {
      const FULL_ERROR = { body: [{ message: 'mockError1' }, { message: 'mockError2' }] };
      expect(reduceErrors(FULL_ERROR)).toStrictEqual([
        FULL_ERROR.body[0].message,
        FULL_ERROR.body[1].message,
      ]);
    });

    it('reduces single error message string', () => {
      const FULL_ERROR = { message: 'mockError' };
      expect(reduceErrors(FULL_ERROR)).toStrictEqual([FULL_ERROR.message]);
    });

    it('reduces array of error message string', () => {
      const FULL_ERROR = [{ message: 'mockError1' }, { message: 'mockError2' }];
      expect(reduceErrors(FULL_ERROR)).toStrictEqual([
        FULL_ERROR[0].message,
        FULL_ERROR[1].message,
      ]);
    });

    it('reduces single error with unknown shape', () => {
      const FULL_ERROR = { statusText: 'mockStatus' };
      expect(reduceErrors(FULL_ERROR)).toStrictEqual([FULL_ERROR.statusText]);
    });

    it('reduces an Error instance (TanStack Query error) and drops empty items', () => {
      expect(
        reduceErrors([new Error('Loading properties failed (500)'), null, undefined]),
      ).toStrictEqual(['Loading properties failed (500)']);
    });
  });
});
