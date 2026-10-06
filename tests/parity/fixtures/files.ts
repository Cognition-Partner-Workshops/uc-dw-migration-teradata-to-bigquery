import type supertest from 'supertest';
import { adminUser, asUser } from './users';

/**
 * The JPEG from FileUtilitiesTest.cls line 9 (`validBase64Data`), verbatim.
 * It is 659 characters, i.e. base64 without the trailing `=` padding: Apex
 * EncodingUtil.base64Decode accepts it, so the API must too (Node's
 * Buffer.from(data, 'base64') does; a strict validator would wrongly reject it).
 */
export const VALID_BASE64_DATA =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAAAAAAAAAAAAAAAABh' +
  'Y3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAAB' +
  'UAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAA' +
  'AAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9Y' +
  'WVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAM' +
  'ZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb';

/** A padded, strictly valid 1x1 PNG for fixtures that are not about base64 edge cases. */
export const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

/** TestPropertyController.cls line 3. */
export const MOCK_PICTURE_NAME = 'MockPictureName';

export interface PictureFixtureInput {
  propertyId: string;
  /** ContentVersion.Title; the API derives it from `filename` minus its extension. */
  title?: string;
  /** PathOnClient extension → ContentDocument.FileType (PNG/JPG/GIF are pictures). */
  extension?: string;
  base64Data?: string;
}

export interface PictureFixture {
  id: string;
  url: string;
  filename: string;
}

/**
 * Apex `insert ContentVersion` + `insert ContentDocumentLink` (TestPropertyController
 * lines 94-110; VersionData = base64Decode('MockValue')). The target has no separate "version" and "link" rows the test could
 * insert directly: the files table + S3 object only exist behind POST /files, the
 * port of FileUtilities.createFile. So the fixture uploads through that endpoint as
 * the administrator, exactly what the Apex DML did in the test-running user's context.
 */
export async function createPicture(
  api: () => ReturnType<typeof supertest>,
  input: PictureFixtureInput,
): Promise<PictureFixture> {
  const filename = `${input.title ?? MOCK_PICTURE_NAME}.${input.extension ?? 'png'}`;
  const response = await api()
    .post('/files')
    .set(asUser(adminUser))
    .send({
      base64Data: input.base64Data ?? ONE_PIXEL_PNG_BASE64,
      filename,
      recordId: input.propertyId,
    });
  if (response.status !== 201) {
    throw new Error(
      `picture fixture: POST /files answered ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  return { ...(response.body as { id: string; url: string }), filename };
}
