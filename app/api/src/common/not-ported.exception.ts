import { NotImplementedException } from '@nestjs/common';

/**
 * Thrown by scaffolded endpoints whose Apex behaviour has not been ported yet.
 * Each one names the ticket that ports it so the gap is visible in API responses.
 */
export class NotPortedException extends NotImplementedException {
  constructor(apexSource: string, ticket: string) {
    super({
      statusCode: 501,
      error: 'Not Implemented',
      message: `${apexSource} is not ported yet (ticket ${ticket})`,
      apexSource,
      ticket,
    });
  }
}
