// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from './App';

afterEach(cleanup);

test('the web shell renders one main landmark with the GharPlan heading', () => {
  render(<App />);

  const heading = screen.getByRole('heading', { level: 1, name: 'GharPlan' });
  const landmarks = screen.getAllByRole('main');

  expect(landmarks).toHaveLength(1);
  expect(landmarks[0]?.contains(heading)).toBe(true);
});
