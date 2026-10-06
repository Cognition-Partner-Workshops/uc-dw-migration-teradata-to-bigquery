import { Injectable } from '@nestjs/common';
import { NotPortedException } from '../../common/not-ported.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactDto } from './dto/contact.dto';

/** Home of the standard `Contact` object (sample data only in dreamhouse-lwc). */
@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ContactDto[]> {
    throw new NotPortedException('Contact list', 'UNT3-19');
  }
}
