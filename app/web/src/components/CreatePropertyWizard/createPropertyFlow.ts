import { API_BASE_URL, api, resolveBaseUrl } from '@/api/client';
import type { ApiErrorDto, CreatePropertyDto, FileCreatedDto, PropertyDto } from '@/api/types';

/**
 * The `Create_property` screen flow (salesforce/force-app/main/default/flows/Create_property.flow-meta.xml)
 * as data: its screens, the screen defaults, the fault-screen texts and the element calls
 * (`create_property`, `upload_picture` → `set_main_picture`) against the API.
 */

/** Input screens in flow order; `allowBack` is the screen's `<allowBack>`. */
export const CREATE_PROPERTY_SCREENS = [
  { name: 'new_property', label: 'New Property', allowBack: true },
  { name: 'address', label: 'Address', allowBack: true },
  { name: 'property_details', label: 'Property Details', allowBack: true },
  { name: 'upload_picture', label: 'Upload Picture', allowBack: false },
] as const;
export type CreatePropertyScreen = (typeof CREATE_PROPERTY_SCREENS)[number]['name'];

/** `<defaultValue>` of the screen input fields. */
export const FLOW_DEFAULTS = {
  property_price: 100000,
  number_of_beds: 4,
  number_of_baths: 2,
} as const;

/** Value `create_property` assigns to Status__c (the API applies it when `status` is omitted). */
export const FLOW_STATUS = 'Available';

/** `<fieldText>` of the fault screens, keyed by the element whose fault connector reaches them. */
export const FLOW_FAULTS = {
  /** geocode_address → Error5 (allowBack) */
  geocode_address: { message: 'Error retrieving geocoded address.', allowBack: true },
  /** create_property → error_creating_records */
  create_property: { message: 'Error creating records. Try again.', allowBack: false },
  /** get_main_content_document → Error2 / get_main_content_version → Error3 (allowBack) */
  get_main_content_document: {
    message: 'Unknown error retrieving uploaded picture.',
    allowBack: true,
  },
  /** set_main_picture → Error4 */
  set_main_picture: {
    message: 'Unknown error setting picture as Property thumbnail.',
    allowBack: false,
  },
} as const;
export type FlowFaultElement = keyof typeof FLOW_FAULTS;

/** Flow runtime message for an empty required input. */
export const REQUIRED_FIELD_MESSAGE = 'Complete this field.';

/** `forceContent:fileUpload` `accept` of upload_picture. */
export const PICTURE_ACCEPT = '.jpg,.png,.gif';

/** The screen inputs (flow element names → camelCase). */
export interface CreatePropertyInputs {
  propertyName: string;
  propertyDescription: string;
  /** `property_broker.recordId` */
  brokerId: string;
  propertyPrice: number | string;
  /** `property_address` (flowruntime:address) */
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  numberOfBeds: number | string;
  numberOfBaths: number | string;
  propertyTags: string;
}

export const INITIAL_INPUTS: CreatePropertyInputs = {
  propertyName: '',
  propertyDescription: '',
  brokerId: '',
  propertyPrice: FLOW_DEFAULTS.property_price,
  address: { street: '', city: '', province: '', postalCode: '', country: '' },
  numberOfBeds: FLOW_DEFAULTS.number_of_beds,
  numberOfBaths: FLOW_DEFAULTS.number_of_baths,
  propertyTags: '',
};

function asNumber(value: number | string): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * `<isRequired>` checks of a screen, keyed by input; empty when the screen may advance.
 * `property_address` is one required component, so each of its lines is required.
 */
export function screenErrors(
  screen: CreatePropertyScreen,
  inputs: CreatePropertyInputs,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const require = (key: string, value: string | number | undefined) => {
    if (value === undefined || String(value).trim() === '') errors[key] = REQUIRED_FIELD_MESSAGE;
  };
  if (screen === 'new_property') {
    require('propertyName', inputs.propertyName);
    require('brokerId', inputs.brokerId);
    require('propertyPrice', asNumber(inputs.propertyPrice));
  }
  if (screen === 'address') {
    require('address.street', inputs.address.street);
    require('address.city', inputs.address.city);
    require('address.province', inputs.address.province);
    require('address.postalCode', inputs.address.postalCode);
    require('address.country', inputs.address.country);
  }
  return errors;
}

/**
 * The `create_property` Record Create as one `POST /properties` body: every `<inputAssignments>`
 * of the element except Status__c ('Available') and Date_Listed__c ($Flow.CurrentDate), which the
 * API defaults, and Location__c, which `geocode: true` (= the `geocode_address` action) computes
 * server-side from the address incl. country (tests/parity/fixtures/create-property-flow.ts).
 */
export function createPropertyBody(inputs: CreatePropertyInputs): CreatePropertyDto {
  const body: CreatePropertyDto = {
    name: inputs.propertyName.trim(),
    brokerId: inputs.brokerId,
    price: asNumber(inputs.propertyPrice),
    address: inputs.address.street.trim(),
    city: inputs.address.city.trim(),
    state: inputs.address.province.trim(),
    zip: inputs.address.postalCode.trim(),
    country: inputs.address.country.trim(),
    beds: asNumber(inputs.numberOfBeds),
    baths: asNumber(inputs.numberOfBaths),
    geocode: true,
  };
  const description = optionalText(inputs.propertyDescription);
  if (description !== undefined) body.description = description;
  const tags = optionalText(inputs.propertyTags);
  if (tags !== undefined) body.tags = tags;
  return body;
}

/** A fault connector: which element failed (→ fault screen) and the API's detail, if any. */
export class FlowFault extends Error {
  constructor(
    readonly element: FlowFaultElement,
    readonly details: string[] = [],
  ) {
    super(FLOW_FAULTS[element].message);
    this.name = 'FlowFault';
  }
}

function apiErrorDetails(error: ApiErrorDto | undefined): string[] {
  if (!error) return [];
  const fieldErrors = Object.values(error.output?.fieldErrors ?? {}).flat();
  const recordErrors = error.output?.errors ?? [];
  const details = [...recordErrors, ...fieldErrors].map((e) => e.message).filter(Boolean);
  return details.length ? details : [error.message];
}

function isGeocodingFault(status: number, error: ApiErrorDto | undefined): boolean {
  return (
    status === 502 || (error?.output?.errors ?? []).some((e) => e.errorCode === 'GEOCODING_FAULT')
  );
}

/** `geocode_address` + `create_property`: POST /properties with `geocode: true`. */
export async function createProperty(inputs: CreatePropertyInputs): Promise<PropertyDto> {
  const { data, error, response } = await api.POST('/properties', {
    body: createPropertyBody(inputs),
  });
  if (response.ok && data) return data;
  const apiError = error as ApiErrorDto | undefined;
  if (isGeocodingFault(response.status, apiError)) {
    throw new FlowFault('geocode_address', apiErrorDetails(apiError));
  }
  throw new FlowFault('create_property', apiErrorDetails(apiError));
}

/** `reader.result.split(',')[1]`: the base64 payload of the file for `CreateFileDto.base64Data`. */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * `upload_picture` (forceContent:fileUpload linked to the new record) + `get_main_content_document`:
 * POST /files per picture; the first one is the main picture.
 */
export async function uploadPictures(
  propertyId: string,
  files: readonly File[],
): Promise<FileCreatedDto[]> {
  const created: FileCreatedDto[] = [];
  for (const file of files) {
    let base64Data: string;
    try {
      base64Data = await fileToBase64(file);
    } catch (error) {
      throw new FlowFault('get_main_content_document', [
        error instanceof Error ? error.message : String(error),
      ]);
    }
    const { data, error, response } = await api.POST('/files', {
      body: { base64Data, filename: file.name, recordId: propertyId },
    });
    if (!response.ok || !data) {
      throw new FlowFault(
        'get_main_content_document',
        apiErrorDetails(error as ApiErrorDto | undefined),
      );
    }
    created.push(data);
  }
  return created;
}

/** `main_picture_url` formula: the URL that serves the main picture (`FileCreatedDto.url` made absolute). */
export function mainPictureUrl(file: FileCreatedDto): string {
  return `${resolveBaseUrl(API_BASE_URL)}${file.url}`;
}

/** `set_main_picture`: PATCH /properties/{id} with Picture__c and Thumbnail__c = main_picture_url. */
export async function setMainPicture(propertyId: string, file: FileCreatedDto): Promise<void> {
  const url = mainPictureUrl(file);
  const { error, response } = await api.PATCH('/properties/{id}', {
    params: { path: { id: propertyId } },
    body: { picture: url, thumbnail: url },
  });
  if (!response.ok) {
    throw new FlowFault('set_main_picture', apiErrorDetails(error as ApiErrorDto | undefined));
  }
}
