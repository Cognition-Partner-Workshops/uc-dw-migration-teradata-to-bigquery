import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../auth/decorators';
import { ContactsService } from './contacts.service';
import { ContactDto } from './dto/contact.dto';

/** Contact is a standard object: CRUD comes from the profile baseline, rows from sharing (ControlledByParent, see sharing.ts). */
@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @RequirePermission('contacts.read')
  @ApiOperation({ summary: 'List contacts', description: 'standard-Contact tab (sample data).' })
  @ApiOkResponse({ type: ContactDto, isArray: true })
  findAll(): Promise<ContactDto[]> {
    return this.contacts.findAll();
  }

  @Get(':id')
  @RequirePermission('contacts.read')
  @ApiOperation({ summary: 'Get a contact' })
  @ApiOkResponse({ type: ContactDto })
  @ApiNotFoundResponse({ description: 'No contact with this id' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ContactDto> {
    return this.contacts.findOne(id);
  }
}
