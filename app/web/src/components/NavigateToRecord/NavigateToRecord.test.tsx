import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { NavigateToRecord } from './NavigateToRecord';
import { recordRoute } from './recordRoute';

const NAV_RECORD_ID = '00000000-0000-4000-8000-000000000001';

// Port of lwc/navigateToRecord/__tests__/navigateToRecord.test.js
describe('NavigateToRecord (c-navigate-to-record)', () => {
  it('navigates to record view', () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <NavigateToRecord recordId={NAV_RECORD_ID} /> },
        { path: '/properties/:id', element: <div>record</div> },
      ],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);
    expect(router.state.location.pathname).toBe(`/properties/${NAV_RECORD_ID}`);
  });

  it('routes brokers to the broker record page', () => {
    expect(recordRoute('Broker__c', 'b1')).toBe('/brokers/b1');
    expect(recordRoute('Property__c', 'p1')).toBe('/properties/p1');
  });
});
