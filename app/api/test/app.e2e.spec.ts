import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import './setup-env';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { API_TAGS, setupOpenApi } from '../src/openapi/openapi';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Dreamhouse API (http)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    configureApp(app);
    setupOpenApi(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health answers 200 without touching the database', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'dreamhouse-api' });
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(() => new Date(res.body.timestamp).toISOString()).not.toThrow();
  });

  it('GET /health/ready reports database up when the ping succeeds', async () => {
    prisma.ping = async () => true;
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(res.body).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  it('GET /health/ready answers 503 when the database is unreachable', async () => {
    prisma.ping = async () => {
      throw new Error('connection refused');
    };
    const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
    expect(res.body).toEqual({
      status: 'error',
      checks: { database: 'down' },
      errors: { database: 'connection refused' },
    });
  });

  it('GET /openapi.json serves the spec generated from the controllers', async () => {
    const res = await request(app.getHttpServer()).get('/openapi.json').expect(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.title).toBe('Dreamhouse API');
    expect(Object.keys(res.body.paths).sort()).toEqual(
      [
        '/brokers',
        '/brokers/{id}',
        '/contacts',
        '/contacts/{id}',
        '/files',
        '/files/presigned-upload',
        '/files/{id}',
        '/geocode',
        '/geocoding/addresses',
        '/health',
        '/health/ready',
        '/properties',
        '/properties/{id}',
        '/properties/{id}/pictures',
        '/sample-data/import',
      ].sort(),
    );
    expect(res.body.tags.map((t: { name: string }) => t.name)).toEqual(API_TAGS.map((t) => t.name));
    expect(res.body.components.schemas).toHaveProperty('PagedPropertiesDto');
    expect(res.body.components.schemas).toHaveProperty('ApiErrorDto');
    // Every CRUD operation of the mapping matrix (policy.properties.crud / policy.brokers.crud).
    for (const path of ['/properties', '/brokers']) {
      expect(Object.keys(res.body.paths[path]).sort()).toEqual(['get', 'post']);
      expect(Object.keys(res.body.paths[`${path}/{id}`]).sort()).toEqual([
        'delete',
        'get',
        'patch',
      ]);
    }
  });

  it('GET /docs serves Swagger UI', async () => {
    const res = await request(app.getHttpServer()).get('/docs').expect(200);
    expect(res.text).toContain('swagger-ui');
  });

  it('validates query parameters like the Apex method normalises its inputs', async () => {
    await request(app.getHttpServer()).get('/properties?pageSize=0').expect(400);
    await request(app.getHttpServer()).get('/properties?unknown=1').expect(400);
  });
});
