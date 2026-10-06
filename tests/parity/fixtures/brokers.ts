import type { TransactionalPrisma } from '../characterisation/harness/transactional-prisma';

/**
 * `insert new Broker__c(Name = ...)`: the broker the Create_property flow's
 * `property_broker` lookup screen component points at. First record of
 * salesforce/data/brokers-data.json by default.
 */
export async function createBroker(prisma: TransactionalPrisma, name = 'Caroline Kingsley') {
  return prisma.db.broker.create({
    data: {
      name,
      title: 'Senior Broker',
      phone: '617-244-3672',
      mobilePhone: '617-244-3672',
      email: 'caroline@dreamhouse.demo',
    },
  });
}
