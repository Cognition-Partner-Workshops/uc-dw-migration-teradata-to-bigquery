import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockApi } from '@/test/api-mock';
import { renderApp, renderWithProviders, signedInStubClient } from '@/test/render';
import { CreatePropertyWizard } from './CreatePropertyWizard';
import {
  FLOW_DEFAULTS,
  FLOW_FAULTS,
  INITIAL_INPUTS,
  REQUIRED_FIELD_MESSAGE,
  createPropertyBody,
  mainPictureUrl,
} from './createPropertyFlow';

/** tests/parity/fixtures/create-property-flow.ts `createPropertyFlowBaseline` (the screens' inputs). */
const baseline = {
  newProperty: {
    name: 'Stunning Victorian',
    description: 'Lorem ipsum dolor sit amet',
    price: 975000,
  },
  address: {
    street: '18 Henry St',
    city: 'Cambridge',
    province: 'MA',
    postalCode: '01742',
    country: 'USA',
  },
  propertyDetails: { beds: 4, baths: 3, tags: 'victorian' },
};
const BROKER = { id: '2b1d3f6e-0000-4000-8000-000000000001', name: 'Caroline Kingsley' };
const CREATED_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

/** `flowRequestBody(brokerId)` of the parity fixture: what the wizard must POST for the baseline. */
const expectedBody = {
  name: baseline.newProperty.name,
  description: baseline.newProperty.description,
  brokerId: BROKER.id,
  price: baseline.newProperty.price,
  address: baseline.address.street,
  city: baseline.address.city,
  state: baseline.address.province,
  zip: baseline.address.postalCode,
  country: baseline.address.country,
  beds: baseline.propertyDetails.beds,
  baths: baseline.propertyDetails.baths,
  tags: baseline.propertyDetails.tags,
  geocode: true,
};

function apiError(
  statusCode: number,
  message: string,
  output: object = { errors: [], fieldErrors: {} },
) {
  return jsonResponse({ statusCode, error: 'Error', message, output }, statusCode);
}

function wizardApi({
  create = () => jsonResponse({ id: CREATED_ID, name: baseline.newProperty.name }, 201),
  file = () =>
    jsonResponse({ id: 'f1', url: '/files/f1', title: 'house', fileType: 'JPG', size: 3 }, 201),
  patch = () => jsonResponse({ id: CREATED_ID }),
}: {
  create?: () => Response;
  file?: () => Response;
  patch?: () => Response;
} = {}) {
  const bodies: Record<string, unknown[]> = { properties: [], files: [], patch: [] };
  const mock = mockApi(async (url, request) => {
    if (url.pathname.endsWith('/brokers')) return jsonResponse([BROKER]);
    if (url.pathname.endsWith('/health')) return jsonResponse({ status: 'ok' });
    if (url.pathname.endsWith('/properties') && request.method === 'POST') {
      bodies.properties.push(await request.json());
      return create();
    }
    if (url.pathname.endsWith('/files') && request.method === 'POST') {
      bodies.files.push(await request.json());
      return file();
    }
    if (url.pathname.endsWith(`/properties/${CREATED_ID}`) && request.method === 'PATCH') {
      bodies.patch.push(await request.json());
      return patch();
    }
    return jsonResponse({ statusCode: 404 }, 404);
  });
  return { ...mock, bodies };
}

async function fillBaselineScreens(user: ReturnType<typeof userEvent.setup>) {
  // new_property
  const newProperty = await screen.findByRole('form', { name: 'New Property' });
  await user.type(within(newProperty).getByLabelText(/Property Name/), baseline.newProperty.name);
  await user.type(
    within(newProperty).getByLabelText('Description'),
    baseline.newProperty.description,
  );
  await user.click(within(newProperty).getByLabelText(/Broker/));
  await user.click(await screen.findByText(BROKER.name));
  const price = within(newProperty).getByLabelText(/Price/);
  await user.clear(price);
  await user.type(price, String(baseline.newProperty.price));
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // address
  const address = await screen.findByRole('form', { name: 'Address' });
  await user.type(within(address).getByLabelText(/Street/), baseline.address.street);
  await user.type(within(address).getByLabelText(/City/), baseline.address.city);
  await user.type(within(address).getByLabelText(/State\/Province/), baseline.address.province);
  await user.type(within(address).getByLabelText(/Zip\/Postal Code/), baseline.address.postalCode);
  await user.type(within(address).getByLabelText(/Country/), baseline.address.country);
  await user.click(screen.getByRole('button', { name: 'Next' }));

  // property_details (beds keeps its default 4, baths 2 -> 3)
  const details = await screen.findByRole('form', { name: 'Property Details' });
  expect(within(details).getByLabelText('Number of Bedrooms')).toHaveValue(
    String(FLOW_DEFAULTS.number_of_beds),
  );
  const baths = within(details).getByLabelText('Number of Bathrooms');
  expect(baths).toHaveValue(String(FLOW_DEFAULTS.number_of_baths));
  await user.clear(baths);
  await user.type(baths, String(baseline.propertyDetails.baths));
  await user.type(within(details).getByLabelText('Tags'), baseline.propertyDetails.tags);
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

describe('createPropertyFlow (the Create_property flow as data)', () => {
  it('starts with the screen defaults: price 100000, 4 bedrooms, 2 bathrooms', () => {
    expect(INITIAL_INPUTS.propertyPrice).toBe(100000);
    expect(INITIAL_INPUTS.numberOfBeds).toBe(4);
    expect(INITIAL_INPUTS.numberOfBaths).toBe(2);
  });

  it('builds the parity fixture request body for the baseline inputs (status/dateListed left to the API)', () => {
    const body = createPropertyBody({
      propertyName: baseline.newProperty.name,
      propertyDescription: baseline.newProperty.description,
      brokerId: BROKER.id,
      propertyPrice: baseline.newProperty.price,
      address: baseline.address,
      numberOfBeds: baseline.propertyDetails.beds,
      numberOfBaths: baseline.propertyDetails.baths,
      propertyTags: baseline.propertyDetails.tags,
    });
    expect(body).toEqual(expectedBody);
    expect(body).not.toHaveProperty('status');
    expect(body).not.toHaveProperty('dateListed');
    expect(body).not.toHaveProperty('latitude');
  });

  it('keeps the fault screen texts of the flow', () => {
    expect(FLOW_FAULTS.geocode_address.message).toBe('Error retrieving geocoded address.');
    expect(FLOW_FAULTS.create_property.message).toBe('Error creating records. Try again.');
    expect(FLOW_FAULTS.get_main_content_document.message).toBe(
      'Unknown error retrieving uploaded picture.',
    );
    expect(FLOW_FAULTS.set_main_picture.message).toBe(
      'Unknown error setting picture as Property thumbnail.',
    );
  });

  it('main_picture_url is the absolute URL of the uploaded file', () => {
    expect(
      mainPictureUrl({ id: 'f1', url: '/files/f1', title: 't', fileType: 'JPG', size: 1 }),
    ).toBe(`${window.location.origin}/api/files/f1`);
  });
});

describe('CreatePropertyWizard (flows/Create_property)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is mounted at /properties/new for the dreamhouse group', async () => {
    wizardApi();
    renderApp({ initialPath: '/properties/new', authClient: await signedInStubClient() });

    expect(await screen.findByRole('heading', { name: 'Create Property' })).toBeInTheDocument();
    expect(await screen.findByRole('form', { name: 'New Property' })).toBeInTheDocument();
  });

  it('refuses to leave New Property until the required fields are complete', async () => {
    wizardApi();
    renderWithProviders(<CreatePropertyWizard />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findAllByText(REQUIRED_FIELD_MESSAGE)).toHaveLength(2); // name, broker
    expect(screen.getByRole('form', { name: 'New Property' })).toBeInTheDocument();
  });

  it('creates the baseline record with one POST /properties (geocode: true) and opens it without a picture', async () => {
    const { bodies } = wizardApi();
    const { router } = renderWithProviders(<CreatePropertyWizard />, {
      initialPath: '/properties/new',
    });
    const user = userEvent.setup();

    await fillBaselineScreens(user);

    expect(await screen.findByRole('form', { name: 'Upload Picture' })).toBeInTheDocument();
    expect(bodies.properties).toEqual([expectedBody]);

    await user.click(screen.getByRole('button', { name: 'Finish' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/properties/${CREATED_ID}`));
    expect(bodies.files).toEqual([]);
    expect(bodies.patch).toEqual([]);
  });

  it('uploads the pictures to the new record and sets the first one as picture and thumbnail', async () => {
    const { bodies } = wizardApi();
    const { router } = renderWithProviders(<CreatePropertyWizard />, {
      initialPath: '/properties/new',
    });
    const user = userEvent.setup();
    await fillBaselineScreens(user);

    const upload = await screen.findByRole('form', { name: 'Upload Picture' });
    const input = upload.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, [
      new File(['abc'], 'house01.jpg', { type: 'image/jpeg' }),
      new File(['def'], 'house02.png', { type: 'image/png' }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(`/properties/${CREATED_ID}`));
    expect(bodies.files).toEqual([
      { base64Data: btoa('abc'), filename: 'house01.jpg', recordId: CREATED_ID },
      { base64Data: btoa('def'), filename: 'house02.png', recordId: CREATED_ID },
    ]);
    const url = `${window.location.origin}/api/files/f1`;
    expect(bodies.patch).toEqual([{ picture: url, thumbnail: url }]);
  });

  it('shows the geocode_address fault (Error5) on 502 GEOCODING_FAULT and Previous returns to Address', async () => {
    wizardApi({
      create: () =>
        apiError(502, 'Geocoding failed', {
          errors: [{ errorCode: 'GEOCODING_FAULT', message: 'Nominatim timed out' }],
          fieldErrors: {},
        }),
    });
    renderWithProviders(<CreatePropertyWizard />);
    const user = userEvent.setup();
    await fillBaselineScreens(user);

    const fault = await screen.findByTestId('create-property-fault');
    expect(within(fault).getByRole('alert')).toHaveTextContent(
      'Error retrieving geocoded address.',
    );
    expect(within(fault).getByRole('alert')).toHaveTextContent('Nominatim timed out');

    await user.click(within(fault).getByRole('button', { name: 'Previous' }));
    expect(await screen.findByRole('form', { name: 'Address' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Street/)).toHaveValue(baseline.address.street);
  });

  it('shows the create_property fault on a 400 with the field errors and no Previous', async () => {
    wizardApi({
      create: () =>
        apiError(400, 'Validation failed: beds', {
          errors: [],
          fieldErrors: {
            beds: [
              {
                field: 'beds',
                errorCode: 'FIELD_INTEGRITY_EXCEPTION',
                message: 'beds must not be greater than 99',
              },
            ],
          },
        }),
    });
    const { router } = renderWithProviders(<CreatePropertyWizard />, {
      initialPath: '/properties/new',
    });
    const user = userEvent.setup();
    await fillBaselineScreens(user);

    const fault = await screen.findByTestId('create-property-fault');
    expect(within(fault).getByRole('alert')).toHaveTextContent(
      'Error creating records. Try again.',
    );
    expect(within(fault).getByRole('alert')).toHaveTextContent('beds must not be greater than 99');
    expect(within(fault).queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();

    await user.click(within(fault).getByRole('button', { name: 'Finish' }));
    expect(router.state.location.pathname).toBe('/property-explorer');
  });

  it('shows the upload faults (Error2 / Error4) with their flow texts', async () => {
    const { bodies } = wizardApi({ patch: () => apiError(400, 'picture must be a URL address') });
    renderWithProviders(<CreatePropertyWizard />);
    const user = userEvent.setup();
    await fillBaselineScreens(user);
    const upload = await screen.findByRole('form', { name: 'Upload Picture' });
    await user.upload(
      upload.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['abc'], 'house01.jpg', { type: 'image/jpeg' }),
    );
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    const fault = await screen.findByTestId('create-property-fault');
    expect(within(fault).getByRole('alert')).toHaveTextContent(
      'Unknown error setting picture as Property thumbnail.',
    );
    expect(bodies.files).toHaveLength(1);
    expect(within(fault).queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
  });

  it('a failed POST /files is the get_main_content_document fault and Previous keeps the record', async () => {
    wizardApi({ file: () => apiError(403, 'Forbidden') });
    renderWithProviders(<CreatePropertyWizard />);
    const user = userEvent.setup();
    await fillBaselineScreens(user);
    const upload = await screen.findByRole('form', { name: 'Upload Picture' });
    await user.upload(
      upload.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['abc'], 'house01.jpg', { type: 'image/jpeg' }),
    );
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    const fault = await screen.findByTestId('create-property-fault');
    expect(within(fault).getByRole('alert')).toHaveTextContent(
      'Unknown error retrieving uploaded picture.',
    );
    await user.click(within(fault).getByRole('button', { name: 'Previous' }));
    expect(await screen.findByRole('form', { name: 'Upload Picture' })).toBeInTheDocument();
  });
});
