import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactDto } from './dto/contact.dto';

type ContactRow = Prisma.ContactGetPayload<Record<string, never>>;

/**
 * Home of the standard `Contact` object. Dreamhouse only reads it (standard-Contact tab)
 * and rewrites it through the sample data import (SampleDataController, UNT3-18): the
 * permission set grants no Contact CRUD, so the API exposes reads only.
 */
@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ContactDto[]> {
    const rows = await this.prisma.contact.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toContact);
  }

  async findOne(id: string): Promise<ContactDto> {
    const row = await this.prisma.contact.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Contact not found');
    return toContact(row);
  }
}

export function toContact(row: ContactRow): ContactDto {
  return {
    id: row.id,
    sfId: row.sfId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    mobilePhone: row.mobilePhone,
    title: row.title,
  };
}
