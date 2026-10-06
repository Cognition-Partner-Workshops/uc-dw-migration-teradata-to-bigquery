import type { TransactionalPrisma } from '../characterisation/harness/transactional-prisma';

export interface PropertyFixtureInput {
  name?: string;
  price?: number;
  beds?: number;
  baths?: number;
}

/**
 * Apex TestPropertyController.createProperties(amount) (TestPropertyController.cls
 * lines 5-18): `Property__c` records named "Name " + i with Price__c 20000,
 * Beds__c 3, Baths__c 3. Inserted straight through Prisma inside the per-test
 * transaction, which is the admin DML the Apex helper performs.
 */
export async function createProperties(prisma: TransactionalPrisma, amount: number) {
  const data = Array.from({ length: amount }, (_, i) => ({
    name: `Name ${i}`,
    price: 20000,
    beds: 3,
    baths: 3,
  }));
  await prisma.db.property.createMany({ data });
  return prisma.db.property.findMany({
    where: { name: { in: data.map((row) => row.name) } },
    orderBy: { name: 'asc' },
  });
}

/**
 * A single `new Property__c(...)` insert (TestPropertyController lines 76-77 and
 * 90-91, FileUtilitiesTest lines 6-7). `Name` is auto-numbered in Salesforce
 * when omitted; here it defaults to the same literal the Apex tests use.
 */
export async function createProperty(
  prisma: TransactionalPrisma,
  input: PropertyFixtureInput = {},
) {
  return prisma.db.property.create({
    data: {
      name: input.name ?? 'Name',
      price: input.price,
      beds: input.beds,
      baths: input.baths,
    },
  });
}
