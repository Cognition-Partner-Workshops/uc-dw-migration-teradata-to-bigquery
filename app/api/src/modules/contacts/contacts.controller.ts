import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { ContactDto } from './dto/contact.dto';

@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List contacts', description: 'standard-Contact tab (sample data).' })
  @ApiOkResponse({ type: ContactDto, isArray: true })
  findAll(): Promise<ContactDto[]> {
    return this.contacts.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a contact' })
  @ApiOkResponse({ type: ContactDto })
  @ApiNotFoundResponse({ description: 'No contact with this id' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ContactDto> {
    return this.contacts.findOne(id);
  }
}
