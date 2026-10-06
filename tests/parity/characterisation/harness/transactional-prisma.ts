import type { PrismaService } from 'dreamhouse-api/test/support/testing-app';

type TransactionClient = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

const ROLLBACK = Symbol('characterisation rollback');

/**
 * The Apex test runtime wraps each test method in a transaction that is
 * rolled back at the end. This reproduces that for the API: `begin()` opens
 * an interactive Prisma transaction, every query the application (and the
 * fixtures) issue through `client` runs inside it, and `rollback()` discards
 * all of it. Nothing a spec seeds survives the test.
 */
export class TransactionalPrisma {
  private tx: TransactionClient | null = null;
  private release: ((reason: unknown) => void) | null = null;
  private settled: Promise<void> | null = null;
  readonly client: PrismaService;

  constructor(private readonly base: PrismaService) {
    this.client = new Proxy(base, {
      get: (target, prop, receiver) => {
        const tx = this.tx;
        if (tx && prop === '$transaction') {
          // Nested $transaction inside the test transaction: run on the same tx.
          return (arg: unknown) =>
            typeof arg === 'function' ? arg(tx) : Promise.all(arg as Promise<unknown>[]);
        }
        if (tx && prop in tx) {
          const value = Reflect.get(tx, prop, tx);
          return typeof value === 'function' ? value.bind(tx) : value;
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as PrismaService;
  }

  get active(): boolean {
    return this.tx !== null;
  }

  /** Direct access to the live transaction for fixtures. */
  get db(): TransactionClient {
    if (!this.tx) throw new Error('TransactionalPrisma: begin() was not called');
    return this.tx;
  }

  async begin(): Promise<void> {
    if (this.tx) throw new Error('TransactionalPrisma: transaction already open');
    await new Promise<void>((ready, failed) => {
      this.settled = this.base
        .$transaction(
          async (tx) => {
            this.tx = tx;
            ready();
            await new Promise<never>((_, reject) => {
              this.release = reject;
            });
          },
          { maxWait: 10_000, timeout: 120_000 },
        )
        .then(
          () => undefined,
          (error: unknown) => {
            if (error !== ROLLBACK) throw error;
          },
        );
      this.settled.catch(failed);
    });
  }

  async rollback(): Promise<void> {
    if (!this.tx) return;
    this.release?.(ROLLBACK);
    this.release = null;
    this.tx = null;
    await this.settled;
    this.settled = null;
  }
}
