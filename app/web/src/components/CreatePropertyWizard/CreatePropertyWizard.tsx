import {
  Alert,
  Button,
  Card,
  FileInput,
  Group,
  List,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconPhoto } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { brokersQuery, queryKeys } from '@/api/queries';
import {
  CREATE_PROPERTY_SCREENS,
  FLOW_FAULTS,
  FlowFault,
  INITIAL_INPUTS,
  PICTURE_ACCEPT,
  createProperty,
  screenErrors,
  setMainPicture,
  uploadPictures,
  type CreatePropertyInputs,
  type FlowFaultElement,
} from './createPropertyFlow';

/** Where `Finish` on a fault screen returns to: the page that hosted the flow interview. */
export const FLOW_HOST_ROUTE = '/property-explorer';

interface FaultState {
  element: FlowFaultElement;
  details: string[];
  /** Screen index `Previous` returns to (the screen before the failed element). */
  backTo: number;
}

/**
 * Port of the `Create_property` screen flow (flowruntime:interview on Property_Explorer): the
 * same screens, labels, defaults and fault texts (`createPropertyFlow.ts`). `Next` on Property
 * Details is the `geocode_address` + `create_property` elements as one `POST /properties` with
 * `geocode: true`; the Upload Picture screen (optional here: the flow's `If_content_document_found`
 * default outcome) is `POST /files` and `set_main_picture`, then `navigate_to_record_detail`.
 */
export function CreatePropertyWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const brokers = useQuery(brokersQuery);

  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<CreatePropertyInputs>(INITIAL_INPUTS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pictures, setPictures] = useState<File[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fault, setFault] = useState<FaultState | null>(null);

  const screen = CREATE_PROPERTY_SCREENS[step];
  const update = <K extends keyof CreatePropertyInputs>(key: K, value: CreatePropertyInputs[K]) => {
    setInputs((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };
  const updateAddress = (key: keyof CreatePropertyInputs['address'], value: string) => {
    setInputs((current) => ({ ...current, address: { ...current.address, [key]: value } }));
    setErrors((current) => {
      const field = `address.${key}`;
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const fail = (error: unknown, backTo: number) => {
    const flowFault =
      error instanceof FlowFault
        ? error
        : new FlowFault('create_property', [
            error instanceof Error ? error.message : String(error),
          ]);
    setFault({ element: flowFault.element, details: flowFault.details, backTo });
  };

  const handleNext = async () => {
    const validation = screenErrors(screen.name, inputs);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    if (screen.name === 'property_details') {
      setBusy(true);
      try {
        const property = await createProperty(inputs);
        setCreatedId(property.id);
        await queryClient.invalidateQueries({ queryKey: ['properties'] });
        setStep(step + 1);
      } catch (error) {
        // geocode_address faults return to the Address screen, create_property cannot go back
        fail(error, error instanceof FlowFault && error.element === 'geocode_address' ? 1 : step);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (screen.name === 'upload_picture') {
      if (!createdId) return;
      setBusy(true);
      try {
        const files = await uploadPictures(createdId, pictures);
        if (files.length > 0) await setMainPicture(createdId, files[0]);
        await queryClient.invalidateQueries({ queryKey: queryKeys.property(createdId) });
        navigate(`/properties/${createdId}`);
      } catch (error) {
        fail(error, step);
      } finally {
        setBusy(false);
      }
      return;
    }

    setStep(step + 1);
  };

  if (fault) {
    const faultScreen = FLOW_FAULTS[fault.element];
    return (
      <Card withBorder padding="lg" data-testid="create-property-fault">
        <Stack gap="md">
          <Title order={3}>Error</Title>
          <Alert color="red" icon={<IconAlertCircle size={18} />} role="alert">
            <Text fw={500}>{faultScreen.message}</Text>
            {fault.details.length > 0 && (
              <List size="sm" mt="xs">
                {fault.details.map((detail) => (
                  <List.Item key={detail}>{detail}</List.Item>
                ))}
              </List>
            )}
          </Alert>
          <Group justify="space-between">
            {faultScreen.allowBack ? (
              <Button
                variant="default"
                onClick={() => {
                  setFault(null);
                  setStep(fault.backTo);
                }}
              >
                Previous
              </Button>
            ) : (
              <span />
            )}
            <Button
              onClick={() => navigate(createdId ? `/properties/${createdId}` : FLOW_HOST_ROUTE)}
            >
              Finish
            </Button>
          </Group>
        </Stack>
      </Card>
    );
  }

  const brokerOptions = (brokers.data ?? []).map((broker) => ({
    value: broker.id,
    label: broker.name,
  }));
  const isLast = step === CREATE_PROPERTY_SCREENS.length - 1;

  return (
    <Card withBorder padding="lg" data-testid="create-property-wizard">
      <Stepper active={step} mb="lg" allowNextStepsSelect={false}>
        {CREATE_PROPERTY_SCREENS.map((s) => (
          <Stepper.Step key={s.name} label={s.label} />
        ))}
      </Stepper>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleNext();
        }}
        aria-label={screen.label}
      >
        <Stack gap="md">
          <Title order={3}>{screen.label}</Title>

          {screen.name === 'new_property' && (
            <>
              <TextInput
                label="Property Name"
                required
                maxLength={80}
                value={inputs.propertyName}
                error={errors.propertyName}
                onChange={(event) => update('propertyName', event.currentTarget.value)}
              />
              <Textarea
                label="Description"
                autosize
                minRows={2}
                value={inputs.propertyDescription}
                onChange={(event) => update('propertyDescription', event.currentTarget.value)}
              />
              <Select
                label="Broker"
                required
                searchable
                placeholder={brokers.isPending ? 'Loading brokers…' : 'Search Brokers…'}
                data={brokerOptions}
                value={inputs.brokerId || null}
                error={
                  errors.brokerId ??
                  (brokers.isError ? 'Brokers could not be loaded. Try again.' : undefined)
                }
                onChange={(value) => update('brokerId', value ?? '')}
                nothingFoundMessage="No brokers found"
              />
              <NumberInput
                label="Price"
                required
                prefix="$"
                thousandSeparator=","
                decimalScale={0}
                min={0}
                value={inputs.propertyPrice}
                error={errors.propertyPrice}
                onChange={(value) => update('propertyPrice', value)}
              />
            </>
          )}

          {screen.name === 'address' && (
            <>
              <Textarea
                label="Street"
                required
                autosize
                minRows={1}
                maxLength={100}
                value={inputs.address.street}
                error={errors['address.street']}
                onChange={(event) => updateAddress('street', event.currentTarget.value)}
              />
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="City"
                  required
                  maxLength={50}
                  value={inputs.address.city}
                  error={errors['address.city']}
                  onChange={(event) => updateAddress('city', event.currentTarget.value)}
                />
                <TextInput
                  label="State/Province"
                  required
                  maxLength={20}
                  value={inputs.address.province}
                  error={errors['address.province']}
                  onChange={(event) => updateAddress('province', event.currentTarget.value)}
                />
                <TextInput
                  label="Zip/Postal Code"
                  required
                  maxLength={10}
                  value={inputs.address.postalCode}
                  error={errors['address.postalCode']}
                  onChange={(event) => updateAddress('postalCode', event.currentTarget.value)}
                />
                <TextInput
                  label="Country"
                  required
                  value={inputs.address.country}
                  error={errors['address.country']}
                  onChange={(event) => updateAddress('country', event.currentTarget.value)}
                />
              </SimpleGrid>
            </>
          )}

          {screen.name === 'property_details' && (
            <>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <NumberInput
                  label="Number of Bedrooms"
                  decimalScale={0}
                  min={0}
                  max={99}
                  value={inputs.numberOfBeds}
                  onChange={(value) => update('numberOfBeds', value)}
                />
                <NumberInput
                  label="Number of Bathrooms"
                  decimalScale={0}
                  min={0}
                  max={99}
                  value={inputs.numberOfBaths}
                  onChange={(value) => update('numberOfBaths', value)}
                />
              </SimpleGrid>
              <TextInput
                label="Tags"
                maxLength={255}
                value={inputs.propertyTags}
                onChange={(event) => update('propertyTags', event.currentTarget.value)}
              />
            </>
          )}

          {screen.name === 'upload_picture' && (
            <>
              <Text size="sm" c="dimmed">
                The property was created. Add one or more pictures; the first one becomes the main
                picture and thumbnail. Finish without a file to open the record as it is.
              </Text>
              <FileInput
                label="Upload Picture"
                placeholder="Choose .jpg, .png or .gif pictures"
                accept={PICTURE_ACCEPT}
                multiple
                clearable
                leftSection={<IconPhoto size={16} />}
                value={pictures}
                onChange={setPictures}
              />
            </>
          )}

          <Group justify="space-between" mt="sm">
            {screen.allowBack && step > 0 ? (
              <Button variant="default" onClick={() => setStep(step - 1)} disabled={busy}>
                Previous
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" loading={busy}>
              {isLast ? 'Finish' : 'Next'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
