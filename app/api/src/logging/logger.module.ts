import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { AppConfigModule } from '../config/app-config.module';
import { AppConfigService } from '../config/app-config.service';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          autoLogging: {
            ignore: (req) => req.url === '/health' || req.url === '/health/ready',
          },
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          transport: config.isProduction
            ? undefined
            : { target: 'pino-pretty', options: { colorize: true, singleLine: true } },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
