import {
  ActionIcon,
  Alert,
  Button,
  Grid,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconAlertCircle, IconPencil } from '@tabler/icons-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { brokersQuery } from '@/api/queries';
import { isApiRequestError } from '@/api/errors';
import { ErrorPanel } from '@/components/ErrorPanel/ErrorPanel';
import {
  fieldKeys,
  isEditable,
  type FieldDef,
  type FieldMap,
  type LayoutSection,
} from '@/records/fields';
import { RecordFieldValue } from '@/components/RecordFieldValue/RecordFieldValue';
import {
  changedValues,
  draftsOf,
  missingRequired,
  type DraftValues,
  type RecordValues,
} from '@/records/values';

export type RecordFormMode = 'view' | 'edit';

export interface RecordFormProps {
  fields: FieldMap;
  /** Sections (label + columns of field names) in layout order. */
  sections: readonly LayoutSection[];
  /** The record (view / edit); omitted for a create form. */
  record?: RecordValues;
  /** `view` starts read-only with inline edit (lightning-record-form default), `edit` opens the inputs. */
  mode?: RecordFormMode;
  /** `createRecord` / `updateRecord`; rejects with an `ApiRequestError` whose field errors are shown inline. */
  onSubmit?: (changes: RecordValues) => Promise<unknown>;
  /** Called after a successful submit (the create form closes its modal). */
  onSubmitted?: () => void;
  /** Called by Cancel; in view mode the form just leaves edit mode. */
  onCancel?: () => void;
  /** Hide the inline edit pencils (read-only `lightning-record-view-form`). */
  readOnly?: boolean;
  /** `columns="2"` on lightning-record-form: a section with one column is still split like that. */
  density?: 'comfortable' | 'compact';
  'data-testid'?: string;
}

const REQUIRED_MESSAGE = 'Complete this field.';

function LookupInput({
  field,
  value,
  error,
  onChange,
  inputRef,
}: {
  field: FieldDef;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  inputRef?: (element: HTMLInputElement | null) => void;
}) {
  const brokers = useQuery(brokersQuery);
  return (
    <Select
      label={field.label}
      placeholder={brokers.isPending ? 'Loading…' : `Search ${field.lookup?.object ?? ''}…`}
      data={(brokers.data ?? []).map((broker) => ({ value: broker.id, label: broker.name }))}
      value={value === '' ? null : value}
      onChange={(next) => onChange(next ?? '')}
      searchable
      clearable
      nothingFoundMessage="No records"
      error={error}
      required={field.required}
      ref={inputRef}
      data-testid={`input-${field.name}`}
    />
  );
}

function FieldInput({
  field,
  drafts,
  errors,
  onChange,
  inputRef,
}: {
  field: FieldDef;
  drafts: DraftValues;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  inputRef?: (element: HTMLInputElement | HTMLTextAreaElement | null) => void;
}) {
  const value = drafts[field.name] ?? '';
  const error = errors[field.name];
  const common = {
    label: field.label,
    required: field.required,
    error,
    'data-testid': `input-${field.name}`,
  };
  switch (field.type) {
    case 'textarea':
      return (
        <Textarea
          {...common}
          autosize
          minRows={3}
          value={value}
          onChange={(event) => onChange(field.name, event.currentTarget.value)}
          ref={inputRef}
        />
      );
    case 'number':
    case 'currency':
      return (
        <NumberInput
          {...common}
          value={value === '' ? '' : Number(value)}
          onChange={(next) => onChange(field.name, next === '' ? '' : String(next))}
          prefix={field.type === 'currency' ? '$' : undefined}
          thousandSeparator={field.type === 'currency' ? ',' : undefined}
          decimalScale={field.maximumFractionDigits}
          hideControls
          ref={inputRef}
        />
      );
    case 'picklist':
      return (
        <Select
          {...common}
          data={[...(field.options ?? [])]}
          value={value === '' ? null : value}
          onChange={(next) => onChange(field.name, next ?? '')}
          placeholder="--None--"
          clearable
          ref={inputRef}
        />
      );
    case 'lookup':
      return (
        <LookupInput
          field={field}
          value={value}
          error={error}
          onChange={(next) => onChange(field.name, next)}
          inputRef={inputRef}
        />
      );
    case 'geolocation': {
      const parts = field.parts!;
      return (
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            {field.label}
          </Text>
          <Group grow align="flex-start">
            <NumberInput
              label="Latitude"
              size="xs"
              value={drafts[parts.latitude] === '' ? '' : Number(drafts[parts.latitude])}
              onChange={(next) => onChange(parts.latitude, next === '' ? '' : String(next))}
              error={errors[parts.latitude]}
              decimalScale={6}
              hideControls
              data-testid={`input-${parts.latitude}`}
              ref={inputRef}
            />
            <NumberInput
              label="Longitude"
              size="xs"
              value={drafts[parts.longitude] === '' ? '' : Number(drafts[parts.longitude])}
              onChange={(next) => onChange(parts.longitude, next === '' ? '' : String(next))}
              error={errors[parts.longitude]}
              decimalScale={6}
              hideControls
              data-testid={`input-${parts.longitude}`}
            />
          </Group>
        </Stack>
      );
    }
    case 'date':
      return (
        <TextInput
          {...common}
          type="date"
          value={value.slice(0, 10)}
          onChange={(event) => onChange(field.name, event.currentTarget.value)}
          ref={inputRef}
        />
      );
    default:
      return (
        <TextInput
          {...common}
          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
          value={value}
          onChange={(event) => onChange(field.name, event.currentTarget.value)}
          ref={inputRef}
        />
      );
  }
}

/**
 * Port of `lightning-record-form` / `lightning-record-edit-form` driven by the field mapping and a
 * page layout: sections and columns in layout order, read-only output fields with the inline-edit
 * pencil (view mode), inputs with Save / Cancel (edit mode). A rejected submit keeps the form in
 * edit mode and shows `output.fieldErrors` under the matching inputs and `output.errors` at the
 * top, as Lightning did.
 */
export function RecordForm({
  fields,
  sections,
  record,
  mode: initialMode = record ? 'view' : 'edit',
  onSubmit,
  onSubmitted,
  onCancel,
  readOnly = false,
  density = 'comfortable',
  'data-testid': testId = 'record-form',
}: RecordFormProps) {
  const fieldList = sections
    .flatMap((section) => section.columns.flat())
    .map((name) => fields[name]);
  const editableFields = fieldList.filter(isEditable);

  const [mode, setMode] = useState<RecordFormMode>(initialMode);
  const [drafts, setDrafts] = useState<DraftValues>(() => draftsOf(fieldList, record));
  const [original, setOriginal] = useState<DraftValues | undefined>(() =>
    record ? draftsOf(fieldList, record) : undefined,
  );
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const focusField = useRef<string | null>(null);

  // A fresh record from the server (after another save, or a refetch) resets the view values.
  useEffect(() => {
    if (record && mode === 'view') {
      const next = draftsOf(fieldList, record);
      setDrafts(next);
      setOriginal(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, mode]);

  const serverErrors = isApiRequestError(submitError) ? submitError.fieldMessages : {};
  const errors = { ...serverErrors, ...clientErrors };
  const recordMessages = isApiRequestError(submitError)
    ? submitError.recordMessages
    : submitError instanceof Error
      ? [submitError.message]
      : [];

  const startEdit = (fieldName: string) => {
    focusField.current = fieldName;
    setMode('edit');
  };

  const cancel = () => {
    setDrafts(original ?? draftsOf(fieldList, undefined));
    setClientErrors({});
    setSubmitError(null);
    if (record) setMode('view');
    onCancel?.();
  };

  const save = async () => {
    const missing = missingRequired(fieldList, drafts);
    if (missing.length > 0) {
      setClientErrors(Object.fromEntries(missing.map((name) => [name, REQUIRED_MESSAGE])));
      return;
    }
    setClientErrors({});
    setSubmitError(null);
    const changes = changedValues(editableFields, drafts, original);
    if (!onSubmit || (original && Object.keys(changes).length === 0)) {
      if (record) setMode('view');
      onSubmitted?.();
      return;
    }
    setSaving(true);
    try {
      await onSubmit(changes);
      if (record) setMode('view');
      onSubmitted?.();
    } catch (error) {
      setSubmitError(error);
    } finally {
      setSaving(false);
    }
  };

  const onChange = (key: string, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
    setClientErrors((current) => (key in current ? { ...current, [key]: '' } : current));
  };

  const renderViewField = (field: FieldDef) => (
    <Stack gap={2} key={field.name} data-testid={`field-${field.name}`} data-field={field.source}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="xs" c="dimmed" component="label">
          {field.label}
        </Text>
        {!readOnly && onSubmit && isEditable(field) && (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label={`Edit ${field.label}`}
            onClick={() => startEdit(field.name)}
            data-testid={`edit-${field.name}`}
          >
            <IconPencil size={14} />
          </ActionIcon>
        )}
      </Group>
      {record ? <RecordFieldValue field={field} record={record} /> : null}
    </Stack>
  );

  const renderEditField = (field: FieldDef) => {
    if (!isEditable(field)) {
      return renderViewField(field);
    }
    const keys = fieldKeys(field);
    return (
      <div key={field.name} data-testid={`field-${field.name}`} data-field={field.source}>
        <FieldInput
          field={field}
          drafts={drafts}
          errors={errors}
          onChange={onChange}
          inputRef={(element) => {
            if (element && focusField.current && keys.includes(focusField.current)) {
              element.focus();
              focusField.current = null;
            }
          }}
        />
      </div>
    );
  };

  const renderSection = (section: LayoutSection, index: number): ReactNode => (
    <Stack gap="xs" key={`${section.label}-${index}`} data-testid="record-form-section">
      {section.label && (
        <Title
          order={4}
          size="sm"
          c="dimmed"
          tt="uppercase"
          fw={600}
          pb={4}
          style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
        >
          {section.label}
        </Title>
      )}
      <Grid gutter={density === 'compact' ? 'xs' : 'md'}>
        {section.columns.map((column, columnIndex) => (
          <Grid.Col span={{ base: 12, sm: 12 / section.columns.length }} key={columnIndex}>
            <Stack gap={density === 'compact' ? 'xs' : 'sm'}>
              {column.map((name) =>
                mode === 'edit' ? renderEditField(fields[name]) : renderViewField(fields[name]),
              )}
            </Stack>
          </Grid.Col>
        ))}
      </Grid>
    </Stack>
  );

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      data-testid={testId}
      data-mode={mode}
    >
      <Stack gap="lg">
        {recordMessages.length > 0 && (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            title="We hit a snag."
            data-testid="record-form-error"
          >
            <Stack gap={2}>
              {recordMessages.map((message) => (
                <Text size="sm" key={message}>
                  {message}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}
        {recordMessages.length === 0 && Object.keys(serverErrors).length > 0 && (
          <Alert color="red" icon={<IconAlertCircle size={16} />} data-testid="record-form-error">
            Review the errors on this page.
          </Alert>
        )}
        {submitError && !isApiRequestError(submitError) && !(submitError instanceof Error) ? (
          <ErrorPanel type="inlineMessage" errors={submitError} />
        ) : null}
        {sections.map(renderSection)}
        {mode === 'edit' && (
          <Group justify="flex-end" data-testid="record-form-actions">
            <Button variant="default" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              leftSection={saving ? <Loader size="xs" color="white" /> : null}
            >
              Save
            </Button>
          </Group>
        )}
      </Stack>
    </form>
  );
}
