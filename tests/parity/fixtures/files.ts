import type { TransactionalPrisma } from '../characterisation/harness/transactional-prisma';

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
  /** ContentVersion.Title (what `filename` minus its extension would give). */
  title?: string;
  /** PathOnClient extension → ContentDocument.FileType (PNG/JPG/GIF are pictures). */
  extension?: string;
}

export interface PictureFixture {
  id: string;
  filename: string;
}

/**
 * Apex `insert ContentVersion` + `insert ContentDocumentLink` (TestPropertyController
 * lines 94-110; VersionData = base64Decode('MockValue')). ContentDocument, its latest
 * ContentVersion and the ContentDocumentLink collapse into one `files` row (UNT3-16
 * migration), so the fixture inserts that row straight through Prisma inside the
 * per-test transaction, the admin DML the Apex test performs. The S3 object is not
 * needed by anything `getPictures` returns; `POST /files` (UNT3-18) is the port of
 * FileUtilities.createFile and is exercised by file-utilities.spec.ts instead.
 */
export async function createPicture(
  prisma: TransactionalPrisma,
  input: PictureFixtureInput,
): Promise<PictureFixture> {
  const title = input.title ?? MOCK_PICTURE_NAME;
  const extension = input.extension ?? 'png';
  const filename = `${title}.${extension}`;
  const file = await prisma.db.file.create({
    data: {
      title,
      fileType: extension.toUpperCase(),
      s3Key: `files/fixture/${filename}`,
      recordId: input.propertyId,
    },
  });
  return { id: file.id, filename };
}
