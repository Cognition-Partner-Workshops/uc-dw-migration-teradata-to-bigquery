import { it, type TestFunction } from 'vitest';
import { PORTED_TICKETS, RUN_ALL } from './ported';

export interface CharacterisationSuite {
  /** `it` while the suite is live, `it.todo` while the port is pending. */
  spec: (name: string, fn: TestFunction) => void;
  ported: boolean;
}

/**
 * One call per Apex test class. `portedBy` is the plan step / ticket that
 * turns the suite green; `apexClass` is the Apex test class being pinned.
 */
export function characterise(apexClass: string, portedBy: string): CharacterisationSuite {
  const ported = RUN_ALL || PORTED_TICKETS.has(portedBy);
  const spec: CharacterisationSuite['spec'] = ported
    ? (name, fn) => it(name, fn)
    : (name, fn) => it.todo(`${name} [pending ${portedBy}: port of ${apexClass}]`, fn);
  return { spec, ported };
}
