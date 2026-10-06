import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './config.schema';
import { CONFIG_NAMESPACE } from './load-config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.configService.getOrThrow<AppConfig>(CONFIG_NAMESPACE)[key];
  }

  get all(): AppConfig {
    return this.configService.getOrThrow<AppConfig>(CONFIG_NAMESPACE);
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
}
