import { useMediaQuery } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import type { PropertySummaryDto } from '@/api/types';
import { formatCurrency } from '@/lib/format';
import classes from './PropertyTile.module.css';

/** `@salesforce/client/formFactor === 'Small'`: phones get the record page instead of the summary panel. */
export const SMALL_FORM_FACTOR_QUERY = '(max-width: 48em)';

/**
 * Port of `c/propertyTile`: thumbnail tile with `City • Name`, beds/baths and the price. On the
 * small form factor it navigates to the record page, otherwise it emits `selected`.
 */
export function PropertyTile({
  property,
  onSelected,
}: {
  property: PropertySummaryDto;
  onSelected?: (propertyId: string) => void;
}) {
  const navigate = useNavigate();
  const isSmallFormFactor = useMediaQuery(SMALL_FORM_FACTOR_QUERY, false, {
    getInitialValueInEffect: false,
  });

  const handlePropertySelected = () => {
    if (isSmallFormFactor) {
      navigate(`/properties/${property.id}`);
    } else {
      onSelected?.(property.id);
    }
  };

  return (
    <a
      role="button"
      tabIndex={0}
      className={classes.link}
      title={property.name}
      onClick={handlePropertySelected}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handlePropertySelected();
        }
      }}
      data-testid="property-tile"
      data-property-id={property.id}
    >
      <div
        className={classes.tile}
        style={property.thumbnail ? { backgroundImage: `url(${property.thumbnail})` } : undefined}
        data-testid="property-tile-picture"
      >
        <div className={classes.lowerThird}>
          <h1 className={classes.truncate} data-testid="property-tile-title">
            <strong>{property.city} • </strong>
            {property.name}
          </h1>
          <p data-testid="property-tile-beds-baths">
            Beds: {property.beds} - Baths: {property.baths}
          </p>
          <p>
            <span data-testid="property-tile-price" data-value={property.price ?? ''}>
              {formatCurrency(property.price)}
            </span>
          </p>
        </div>
      </div>
    </a>
  );
}
