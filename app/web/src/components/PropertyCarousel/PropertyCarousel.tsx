import {
  ActionIcon,
  Alert,
  Box,
  Card,
  Center,
  FileInput,
  Group,
  Image,
  Loader,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconPhoto, IconUpload } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useCreateFile } from '@/api/mutations';
import { propertyPicturesQuery, propertyQuery } from '@/api/queries';
import type { PropertyPictureDto } from '@/api/types';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import { reduceErrors } from '@/lib/errors';
import { blobToBase64, CAROUSEL_IMAGE_OPTIONS, processImage } from '@/lib/media';
import classes from './PropertyCarousel.module.css';

export const NO_PICTURES_MESSAGE = 'There are currently no pictures for this property.';
export const ACCEPTED_PICTURES = '.jpg,.jpeg,.png,.gif';

/** `lightning-carousel`: one picture at a time, previous / next and the indicator dots. */
function Carousel({ pictures }: { pictures: readonly PropertyPictureDto[] }) {
  const [index, setIndex] = useState(0);
  const current = pictures[Math.min(index, pictures.length - 1)];
  const go = (next: number) => setIndex((next + pictures.length) % pictures.length);

  return (
    <Stack gap="xs" data-testid="property-carousel-items">
      <Box pos="relative">
        <Image
          src={current.url}
          alt={current.title}
          h={240}
          fit="cover"
          radius="sm"
          data-testid="property-carousel-image"
        />
        {pictures.length > 1 && (
          <>
            <ActionIcon
              className={classes.previous}
              variant="default"
              radius="xl"
              aria-label="Previous picture"
              onClick={() => go(index - 1)}
            >
              <IconChevronLeft size={18} />
            </ActionIcon>
            <ActionIcon
              className={classes.next}
              variant="default"
              radius="xl"
              aria-label="Next picture"
              onClick={() => go(index + 1)}
            >
              <IconChevronRight size={18} />
            </ActionIcon>
          </>
        )}
      </Box>
      <Text size="sm" ta="center" lineClamp={1} data-testid="property-carousel-caption">
        {current.title}
      </Text>
      {pictures.length > 1 && (
        <Group justify="center" gap={6} data-testid="property-carousel-indicators">
          {pictures.map((picture, pictureIndex) => (
            <UnstyledButton
              key={picture.id}
              aria-label={`Picture ${pictureIndex + 1} of ${pictures.length}`}
              aria-current={pictureIndex === index}
              className={`${classes.dot} ${pictureIndex === index ? classes.dotActive : ''}`}
              onClick={() => setIndex(pictureIndex)}
            />
          ))}
        </Group>
      )}
    </Stack>
  );
}

/**
 * Port of `c/propertyCarousel`: the pictures of the property (`PropertyController.getPictures`
 * -> GET /properties/{id}/pictures) in a carousel titled with the address, plus the "Add picture"
 * upload that resizes each file (`processImage`) and posts it (`FileUtilities.createFile` ->
 * POST /files) before refreshing the pictures.
 */
export function PropertyCarousel({ propertyId }: { propertyId: string }) {
  const property = useQuery(propertyQuery(propertyId));
  const pictures = useQuery(propertyPicturesQuery(propertyId));
  const createFile = useCreateFile();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);

  const errors = [property.error, pictures.error].filter((error) => error);

  const handleFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      // Process each file individually to allow partial uploads to succeed.
      for (const file of files) {
        const blob = await processImage(file, CAROUSEL_IMAGE_OPTIONS);
        const base64Data = await blobToBase64(blob);
        await createFile.mutateAsync({ base64Data, filename: file.name, recordId: propertyId });
      }
    } catch (error) {
      setUploadError(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card withBorder padding="md" data-testid="property-carousel" data-property-id={propertyId}>
      {property.data && (
        <>
          <Card.Section withBorder inheritPadding py="xs">
            <Group gap="xs" wrap="nowrap">
              <IconPhoto size={18} />
              <Title order={3} size="h5" lineClamp={1} data-testid="property-carousel-title">
                {property.data.address}
              </Title>
            </Group>
          </Card.Section>
          <Stack gap="md" mt="md">
            {pictures.data && pictures.data.length > 0 ? (
              <Carousel pictures={pictures.data} />
            ) : pictures.data ? (
              <Stack gap={4} align="center" py="sm">
                <IconPhoto size={32} stroke={1.5} />
                <Text size="sm" c="dimmed" ta="center" data-testid="property-carousel-empty">
                  {NO_PICTURES_MESSAGE}
                </Text>
              </Stack>
            ) : pictures.isPending ? (
              <Center py="md" data-testid="property-carousel-loading">
                <Loader size="sm" />
              </Center>
            ) : null}
            <FileInput
              label="Add picture"
              placeholder={uploading ? 'Uploading…' : 'Upload files'}
              accept={ACCEPTED_PICTURES}
              multiple
              clearable
              value={[]}
              disabled={uploading}
              leftSection={uploading ? <Loader size="xs" /> : <IconUpload size={16} />}
              onChange={(files) => void handleFilesSelected(files)}
              data-testid="property-carousel-upload"
            />
            {uploadError ? (
              <Alert
                color="red"
                title="Error uploading picture"
                data-testid="property-carousel-upload-error"
              >
                {reduceErrors(uploadError).join(', ')}
              </Alert>
            ) : null}
          </Stack>
        </>
      )}
      {!property.data && property.isPending && (
        <Center py="md" data-testid="property-carousel-loading">
          <Loader size="sm" />
        </Center>
      )}
      {errors.length > 0 && (
        <ErrorPanel friendlyMessage="Error retrieving pictures" errors={errors} />
      )}
    </Card>
  );
}
