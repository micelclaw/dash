export type CategoryFieldType = 'text' | 'number' | 'date' | 'select';

export interface CategoryFieldDescriptor {
  key: string;
  label: string;
  type: CategoryFieldType;
  options?: string[];
}

const FIELD_SETS: Record<string, CategoryFieldDescriptor[]> = {
  vehicle: [
    { key: 'matricula', label: 'Registration', type: 'text' },
    { key: 'km', label: 'Mileage', type: 'number' },
    { key: 'itv_until', label: 'Inspection until', type: 'date' },
    { key: 'combustible', label: 'Fuel', type: 'select', options: ['petrol', 'diesel', 'electric', 'hybrid', 'other'] },
  ],
  electronics: [
    { key: 'imei', label: 'IMEI', type: 'text' },
    { key: 'mac_address', label: 'MAC address', type: 'text' },
    { key: 'os', label: 'Operating system', type: 'text' },
  ],
  appliance: [
    { key: 'consumo_energetico', label: 'Energy consumption', type: 'number' },
    { key: 'capacidad', label: 'Capacity', type: 'text' },
  ],
  insurance: [
    { key: 'insurer', label: 'Insurer', type: 'text' },
    { key: 'policy_number', label: 'Policy number', type: 'text' },
    { key: 'premium', label: 'Premium', type: 'number' },
    { key: 'charge_period', label: 'Charge period', type: 'select', options: ['monthly', 'quarterly', 'yearly'] },
    { key: 'charge_date', label: 'Charge date', type: 'date' },
    { key: 'renewal_date', label: 'Renewal date', type: 'date' },
    { key: 'coverage', label: 'Coverage', type: 'text' },
  ],
  tool: [
    { key: 'voltaje', label: 'Voltage', type: 'number' },
    { key: 'bateria', label: 'Battery', type: 'text' },
  ],
  sport: [
    { key: 'talla', label: 'Size', type: 'text' },
    { key: 'temporada', label: 'Season', type: 'text' },
  ],
};

const ALIASES: Record<string, string> = {
  vehiculo: 'vehicle', vehículo: 'vehicle', coche: 'vehicle',
  electronica: 'electronics', electrónica: 'electronics',
  electrodomestico: 'appliance', electrodoméstico: 'appliance',
  seguro: 'insurance', herramienta: 'tool', deporte: 'sport',
};

export function descriptorsForCategory(category?: string | null): CategoryFieldDescriptor[] {
  const raw = category?.trim().toLowerCase() ?? '';
  return FIELD_SETS[ALIASES[raw] ?? raw] ?? [];
}

export function descriptorKeys(category?: string | null): string[] {
  return descriptorsForCategory(category).map(field => field.key);
}

export function sanitizeCustomFields(value: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (typeof fieldValue === 'string') {
      const trimmed = fieldValue.trim();
      if (trimmed) clean[key] = trimmed;
    } else if (fieldValue !== null && fieldValue !== undefined) clean[key] = fieldValue;
  }
  return clean;
}
