/**
 * Baseline for the `Create_property` screen flow
 * (salesforce/force-app/main/default/flows/Create_property.flow-meta.xml).
 *
 * `inputs` are the values a user types on the three screens; `expectedRecord` is the
 * Property__c the flow's `create_property` Record Create element inserts for them
 * (one entry per `<inputAssignments>`), with the geocode_address output substituted by
 * `nominatim`. Fields the flow never assigns stay null (`untouchedFields`).
 */
export const createPropertyFlowBaseline = {
  /** Screen `new_property` (property_name, property_description, property_broker, property_price). */
  newProperty: {
    name: 'Stunning Victorian',
    description: 'Lorem ipsum dolor sit amet',
    price: 975000, // screen default 100000 overridden by the user
  },
  /** Screen `address` (property_address: street, city, province, postalCode, country). */
  address: {
    street: '18 Henry St',
    city: 'Cambridge',
    province: 'MA',
    postalCode: '01742',
    country: 'USA',
  },
  /** Screen `property_details` (number_of_beds default 4, number_of_baths default 2, property_tags). */
  propertyDetails: {
    beds: 4,
    baths: 3,
    tags: 'victorian',
  },
  /** What the `geocode_address` action (Apex GeocodingService → Nominatim) answered for that address. */
  nominatim: { lat: 42.35663, lon: -71.11095 },

  /** `create_property` inputAssignments, API field names (Date_Listed__c = $Flow.CurrentDate is computed). */
  expectedRecord: {
    name: 'Stunning Victorian', // Name ← property_name
    description: 'Lorem ipsum dolor sit amet', // Description__c ← property_description
    price: 975000, // Price__c ← property_price
    address: '18 Henry St', // Address__c ← property_address.street
    city: 'Cambridge', // City__c ← property_address.city
    state: 'MA', // State__c ← property_address.province
    zip: '01742', // Zip__c ← property_address.postalCode
    beds: 4, // Beds__c ← number_of_beds
    baths: 3, // Baths__c ← number_of_baths
    tags: 'victorian', // Tags__c ← property_tags
    latitude: 42.35663, // Location__Latitude__s ← geocode_address.lat
    longitude: -71.11095, // Location__Longitude__s ← geocode_address.lon
    status: 'Available', // Status__c ← 'Available'
  },
  untouchedFields: [
    'priceSold',
    'assessedValue',
    'datePreMarket',
    'dateContracted',
    'dateAgreement',
    'dateClosed',
    'picture',
    'thumbnail',
    'sfId',
  ] as const,
} as const;

/** The POST /properties body the React wizard sends for the same screens (`geocode` = the geocode_address step). */
export function flowRequestBody(brokerId: string, geocode = true) {
  const { newProperty, address, propertyDetails } = createPropertyFlowBaseline;
  return {
    name: newProperty.name,
    description: newProperty.description,
    brokerId,
    price: newProperty.price,
    address: address.street,
    city: address.city,
    state: address.province,
    zip: address.postalCode,
    country: address.country,
    beds: propertyDetails.beds,
    baths: propertyDetails.baths,
    tags: propertyDetails.tags,
    geocode,
  };
}

/** `$Flow.CurrentDate` as the API renders Date_Listed__c (UTC calendar date). */
export function flowCurrentDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
