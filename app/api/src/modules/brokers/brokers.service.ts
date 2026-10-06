import { Injectable, NotFoundException } from '@nestjs/common';
import { assertRecordAccess, ownershipColumns, recordAccessWhere } from '../../auth/sharing';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BrokerDto, CreateBrokerDto, UpdateBrokerDto } from './dto/broker.dto';

type BrokerRow = Prisma.BrokerGetPayload<Record<string, never>>;
/** Column values of a request body; `name` is only optional on PATCH. */
type BrokerData = Omit<Prisma.BrokerUncheckedCreateInput, 'name'> & { name?: string };

/**
 * Home of Salesforce `Broker__c`. The object had no Apex: the Broker__c tab, the
 * Broker_Record_Page and the brokerCard LWC (`lightning-record-view-form`) read it through
 * Lightning Data Service, and the standard New/Edit/Delete actions wrote it. That implicit
 * CRUD is this service. No triggers or record-triggered flows exist for the object
 * (docs/migration/inventory.json: apexTriggers 0), so there are no domain hooks to run.
 */
@Injectable()
export class BrokersService {
  constructor(private readonly prisma: PrismaService) {}

  /** `SELECT ... FROM Broker__c ORDER BY Name` (Broker__c tab list view). */
  async findAll(): Promise<BrokerDto[]> {
    const rows = await this.prisma.broker.findMany({
      where: recordAccessWhere('Broker__c', 'read'),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toBroker);
  }

  /** `getRecord` on a Broker__c (brokerCard / Broker_Record_Page). */
  async findOne(id: string): Promise<BrokerDto> {
    const row = await this.prisma.broker.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Broker not found');
    assertRecordAccess('Broker__c', 'read', row);
    return toBroker(row);
  }

  /** LDS `createRecord(Broker__c)`. */
  async create(input: CreateBrokerDto): Promise<BrokerDto> {
    const row = await this.prisma.broker.create({
      data: { ...toData(input), ...ownershipColumns() } as Prisma.BrokerUncheckedCreateInput,
    });
    return toBroker(row);
  }

  /** LDS `updateRecord(Broker__c)`; 404 when the record is gone (P2025 → PrismaExceptionFilter). */
  async update(id: string, input: UpdateBrokerDto): Promise<BrokerDto> {
    await this.assertAccess(id, 'edit');
    const row = await this.prisma.broker.update({ where: { id }, data: toData(input) });
    return toBroker(row);
  }

  /**
   * LDS `deleteRecord(Broker__c)`. The Broker__c lookup on Property__c clears on delete
   * (schema: ON DELETE SET NULL), as the Salesforce lookup did.
   */
  async remove(id: string): Promise<void> {
    await this.assertAccess(id, 'delete');
    await this.prisma.broker.delete({ where: { id } });
  }

  /** Sharing check before a write (owner-only unless Modify All / Public Read/Write, see sharing.ts). */
  private async assertAccess(id: string, operation: 'edit' | 'delete'): Promise<void> {
    const row = await this.prisma.broker.findUnique({ where: { id }, select: { ownerId: true } });
    if (!row) throw new NotFoundException('Broker not found');
    assertRecordAccess('Broker__c', operation, row);
  }
}

function toData(input: CreateBrokerDto | UpdateBrokerDto): BrokerData {
  const data: BrokerData = {};
  if (input.name !== undefined) data.name = input.name;
  for (const key of ['title', 'email', 'phone', 'mobilePhone', 'picture'] as const) {
    if (input[key] !== undefined) data[key] = input[key];
  }
  if (input.brokerId !== undefined) {
    data.brokerId = input.brokerId === null ? null : new Prisma.Decimal(input.brokerId);
  }
  return data;
}

export function toBroker(row: BrokerRow): BrokerDto {
  return {
    id: row.id,
    sfId: row.sfId,
    name: row.name,
    brokerId: row.brokerId === null ? null : row.brokerId.toFixed(0),
    title: row.title,
    email: row.email,
    phone: row.phone,
    mobilePhone: row.mobilePhone,
    picture: row.picture,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
