import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { processImage } from '@/lib/media';
import { jsonResponse, mockApi } from '@/test/api-mock';
import { PICTURES, PROPERTY_RECORD } from '@/test/fixtures/records';
import { renderWithProviders } from '@/test/render';
import { NO_PICTURES_MESSAGE, PropertyCarousel } from './PropertyCarousel';

vi.mock('@/lib/media', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/media')>();
  return { ...original, processImage: vi.fn(async (file: Blob) => file) };
});

function carouselApi(pictures: unknown = PICTURES, failPictures = false) {
  const files: { body: unknown }[] = [];
  const api = mockApi(async (url, request) => {
    if (url.pathname === `/api/properties/${PROPERTY_RECORD.id}`)
      return jsonResponse(PROPERTY_RECORD);
    if (url.pathname === `/api/properties/${PROPERTY_RECORD.id}/pictures`) {
      return failPictures ? jsonResponse({ message: 'boom' }, 500) : jsonResponse(pictures);
    }
    const file = /^\/api\/files\/([^/]+)$/.exec(url.pathname);
    if (file && request.method === 'GET') {
      return new Response(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]), {
        headers: { 'content-type': 'image/png' },
      });
    }
    if (url.pathname === '/api/files' && request.method === 'POST') {
      files.push({ body: await request.json() });
      return jsonResponse({ id: 'f-new', title: 'new', url: 'https://example.com/new.jpg' }, 201);
    }
    return jsonResponse({ message: 'not found' }, 404);
  });
  return { ...api, files };
}

// Port of lwc/propertyCarousel/__tests__/propertyCarousel.test.js
describe('PropertyCarousel (c-property-carousel)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders carousel with pictures when property and pictures returned', async () => {
    const { requests } = carouselApi();
    renderWithProviders(<PropertyCarousel propertyId={PROPERTY_RECORD.id} />);
    expect(await screen.findByTestId('property-carousel-items')).toBeInTheDocument();
    expect(screen.getByTestId('property-carousel-title')).toHaveTextContent(
      PROPERTY_RECORD.address!,
    );
    const image = await screen.findByTestId('property-carousel-image');
    expect(image).toHaveAttribute('data-file-id', PICTURES[0].id);
    expect(image.getAttribute('src')).toMatch(/^blob:/);
    expect(requests().some((url) => url.pathname === `/api/files/${PICTURES[0].id}`)).toBe(true);
    expect(screen.getAllByRole('button', { name: /^Picture \d of/ })).toHaveLength(PICTURES.length);
  });

  it('steps through the pictures', async () => {
    const user = userEvent.setup();
    carouselApi();
    renderWithProviders(<PropertyCarousel propertyId={PROPERTY_RECORD.id} />);
    await screen.findByTestId('property-carousel-items');
    await user.click(screen.getByRole('button', { name: 'Next picture' }));
    expect(await screen.findByTestId('property-carousel-image')).toHaveAttribute(
      'data-file-id',
      PICTURES[1].id,
    );
    expect(screen.getByTestId('property-carousel-caption')).toHaveTextContent(PICTURES[1].title);
  });

  it('renders no pictures message when property but no pictures returned', async () => {
    carouselApi([]);
    renderWithProviders(<PropertyCarousel propertyId={PROPERTY_RECORD.id} />);
    expect(await screen.findByTestId('property-carousel-empty')).toHaveTextContent(
      NO_PICTURES_MESSAGE,
    );
  });

  it('renders error when getProperty returns error', async () => {
    mockApi(() => jsonResponse({ message: 'boom' }, 500));
    renderWithProviders(<PropertyCarousel propertyId={PROPERTY_RECORD.id} />);
    expect(await screen.findByTestId('error-panel')).toHaveTextContent('Error retrieving pictures');
  });

  it('renders error when getPictures returns error', async () => {
    carouselApi(undefined, true);
    renderWithProviders(<PropertyCarousel propertyId={PROPERTY_RECORD.id} />);
    expect(await screen.findByTestId('error-panel')).toHaveTextContent('Error retrieving pictures');
  });

  it('calls processImage, createFile and refreshes the pictures when a picture is uploaded', async () => {
    const user = userEvent.setup();
    const { files, requests } = carouselApi([]);
    const { container } = renderWithProviders(<PropertyCarousel propertyId={PROPERTY_RECORD.id} />);
    await screen.findByTestId('property-carousel-empty');

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'house.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(input, file);

    await waitFor(() => expect(files).toHaveLength(1));
    expect(processImage).toHaveBeenCalledWith(file, expect.objectContaining({ targetWidth: 500 }));
    expect(files[0].body).toEqual({
      filename: 'house.jpg',
      recordId: PROPERTY_RECORD.id,
      base64Data: '/9j/',
    });
    await waitFor(() =>
      expect(
        requests().filter((url) => url.pathname.endsWith('/pictures')).length,
      ).toBeGreaterThanOrEqual(2),
    );
  });
});
