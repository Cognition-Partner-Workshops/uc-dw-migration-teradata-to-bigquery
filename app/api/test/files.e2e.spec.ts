import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import './setup-env';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.factory';
import { FILE_STORAGE, FileStorage } from '../src/modules/files/storage/file-storage';
import { PrismaService } from '../src/prisma/prisma.service';
import { adminUser, asUser } from './support/test-users';

process.env.FILES_MAX_INLINE_BYTES = '128';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';
const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

/**
 * HTTP surface of the FileUtilities port with Prisma stubbed out and the local file storage
 * (the database round-trip is tests/parity/characterisation/file-utilities.spec.ts).
 */
describe('POST /files, GET /files/:id (http)', () => {
  let app: INestApplication;
  let storage: FileStorage;
  const rows = new Map<
    string,
    { id: string; title: string; fileType: string; s3Key: string; recordId: string }
  >();
  const prisma = {
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
    property: { findUnique: vi.fn() },
    file: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    onModuleDestroy: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    storage = app.get<FileStorage>(FILE_STORAGE);
  });

  beforeEach(() => {
    rows.clear();
    prisma.property.findUnique
      .mockReset()
      .mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(where.id === PROPERTY_ID ? { id: PROPERTY_ID } : null),
      );
    prisma.file.create
      .mockReset()
      .mockImplementation(({ data }: { data: Record<string, string> }) => {
        const row = {
          id: data.id,
          title: data.title,
          fileType: data.fileType,
          s3Key: data.s3Key,
          recordId: data.recordId,
          createdBy: data.createdBy,
        };
        rows.set(row.id, row);
        return Promise.resolve({ id: row.id, title: row.title, fileType: row.fileType });
      });
    prisma.file.findUnique
      .mockReset()
      .mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.get(where.id) ?? null),
      );
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores the body, inserts the files row and serves it back under the returned url', async () => {
    const created = await request(app.getHttpServer())
      .post('/files')
      .set(asUser(adminUser))
      .send({ base64Data: ONE_PIXEL_PNG, filename: 'house01.png', recordId: PROPERTY_ID })
      .expect(201);

    expect(created.body).toMatchObject({
      url: `/files/${created.body.id}`,
      title: 'house01',
      fileType: 'PNG',
      size: Buffer.from(ONE_PIXEL_PNG, 'base64').length,
    });
    const row = rows.get(created.body.id)!;
    expect(row).toMatchObject({
      s3Key: `files/${created.body.id}/house01.png`,
      recordId: PROPERTY_ID,
      createdBy: 'admin',
    });
    expect(await storage.headObject(row.s3Key)).toEqual({
      contentLength: Buffer.from(ONE_PIXEL_PNG, 'base64').length,
    });

    const served = await request(app.getHttpServer())
      .get(created.body.url)
      .set(asUser(adminUser))
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['content-disposition']).toContain('inline; filename="house01.png"');
    expect(Buffer.from(served.body as Buffer).equals(Buffer.from(ONE_PIXEL_PNG, 'base64'))).toBe(
      true,
    );
  });

  it('rolls the row back when the storage write fails', async () => {
    const putObject = vi
      .spyOn(storage, 'putObject')
      .mockRejectedValueOnce(new Error('bucket down'));
    prisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      try {
        return await fn(prisma);
      } catch (error) {
        rows.clear();
        throw error;
      }
    });
    await request(app.getHttpServer())
      .post('/files')
      .set(asUser(adminUser))
      .send({ base64Data: ONE_PIXEL_PNG, filename: 'house01.png', recordId: PROPERTY_ID })
      .expect(500);
    expect(putObject).toHaveBeenCalledTimes(1);
    expect(rows.size).toBe(0);
  });

  it('answers 4xx like AuraHandledException for bad input', async () => {
    const api = request(app.getHttpServer());
    // FileUtilitiesTest.createFileFailsWhenIncorrectRecordId
    await api
      .post('/files')
      .set(asUser(adminUser))
      .send({ base64Data: ONE_PIXEL_PNG, filename: 'f.png', recordId: 'INVALID_ID' })
      .expect(400);
    await api
      .post('/files')
      .set(asUser(adminUser))
      .send({ base64Data: ONE_PIXEL_PNG, filename: 'f.png', recordId: FILE_ID })
      .expect(404);
    // FileUtilitiesTest.createFileFailsWhenIncorrectBase64Data
    await api
      .post('/files')
      .set(asUser(adminUser))
      .send({ base64Data: '', filename: 'f.png', recordId: PROPERTY_ID })
      .expect(400);
    await api
      .post('/files')
      .set(asUser(adminUser))
      .send({ base64Data: '%%%', filename: 'f.png', recordId: PROPERTY_ID })
      .expect(400);
    await api
      .post('/files')
      .set(asUser(adminUser))
      .send({ filename: 'f.png', recordId: PROPERTY_ID })
      .expect(400);
    // FileUtilitiesTest.createFileFailsWhenIncorrectFilename
    await api
      .post('/files')
      .set(asUser(adminUser))
      .send({ base64Data: ONE_PIXEL_PNG, filename: '', recordId: PROPERTY_ID })
      .expect(400);
    await api
      .post('/files')
      .set(asUser(adminUser))
      .send({ base64Data: ONE_PIXEL_PNG, filename: '   ', recordId: PROPERTY_ID })
      .expect(400);
    await api
      .post('/files')
      .set(asUser(adminUser))
      .send({ base64Data: ONE_PIXEL_PNG, filename: '../x.png', recordId: PROPERTY_ID })
      .expect(400);
    // one body source at a time
    await api
      .post('/files')
      .set(asUser(adminUser))
      .send({
        base64Data: ONE_PIXEL_PNG,
        uploadKey: `uploads/${PROPERTY_ID}/x/f.png`,
        filename: 'f.png',
        recordId: PROPERTY_ID,
      })
      .expect(400);
    expect(rows.size).toBe(0);
  });

  it('caps inline bodies at FILES_MAX_INLINE_BYTES with 413', async () => {
    const big = Buffer.alloc(129, 1).toString('base64');
    const res = await request(app.getHttpServer())
      .post('/files')
      .set(asUser(adminUser))
      .send({ base64Data: big, filename: 'big.bin', recordId: PROPERTY_ID })
      .expect(413);
    expect(res.body.message).toContain('presigned-upload');
  });

  it('finalises a pre-signed upload from its uploadKey', async () => {
    const uploadKey = `uploads/${PROPERTY_ID}/token/house02.jpg`;
    await storage.putObject(uploadKey, Buffer.from('jpeg bytes'), 'image/jpeg');

    await request(app.getHttpServer())
      .post('/files')
      .set(asUser(adminUser))
      .send({
        uploadKey: `uploads/${FILE_ID}/token/house02.jpg`,
        filename: 'house02.jpg',
        recordId: PROPERTY_ID,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/files')
      .set(asUser(adminUser))
      .send({
        uploadKey: `uploads/${PROPERTY_ID}/missing/house02.jpg`,
        filename: 'house02.jpg',
        recordId: PROPERTY_ID,
      })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/files')
      .set(asUser(adminUser))
      .send({ uploadKey, filename: 'house02.jpg', recordId: PROPERTY_ID })
      .expect(201);
    expect(created.body).toMatchObject({ fileType: 'JPG', size: 10 });
    expect(await storage.headObject(`files/${created.body.id}/house02.jpg`)).toEqual({
      contentLength: 10,
    });
    expect(await storage.headObject(uploadKey)).toBeNull();
  });

  it('POST /files/presigned-upload needs the S3 bucket (501 on local storage) and an existing record', async () => {
    await request(app.getHttpServer())
      .post('/files/presigned-upload')
      .set(asUser(adminUser))
      .send({ filename: 'big.jpg', recordId: FILE_ID })
      .expect(404);
    const res = await request(app.getHttpServer())
      .post('/files/presigned-upload')
      .set(asUser(adminUser))
      .send({ filename: 'big.jpg', recordId: PROPERTY_ID })
      .expect(501);
    expect(res.body.message).toContain('FILES_BUCKET');
  });

  it('GET /files/:id answers 404 for unknown ids and 400 for non-uuids', async () => {
    await request(app.getHttpServer()).get(`/files/${FILE_ID}`).set(asUser(adminUser)).expect(404);
    await request(app.getHttpServer()).get('/files/not-a-uuid').set(asUser(adminUser)).expect(400);
  });
});
