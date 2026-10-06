import { Controller, Get } from '@nestjs/common';
import { ApiNotImplementedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { ContactDto } from './dto/contact.dto';

@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List contacts' })
  @ApiOkResponse({ type: ContactDto, isArray: true })
  @ApiNotImplementedResponse({ description: 'Not ported yet (UNT3-19)' })
  findAll(): Promise<ContactDto[]> {
    return this.contacts.findAll();
  }
}
