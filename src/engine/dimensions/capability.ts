import type { ComparisonDimension, DimensionScore, DimensionFactor } from '../../types';
import type { CanonicalVehicle, VehicleUserData } from '../../types';

// Off-road / rough-road capability scoring.
// Decomposed into transparent sub-factors.
function scoreCapability(canonical: CanonicalVehicle, _user: VehicleUserData): DimensionScore {
  const factors: DimensionFactor[] = [];
  let total = 0;

  // Drivetrain (0-3 points)
  if (canonical.drivetrain === '4wd') {
    factors.push({ name: 'Drivetrain', impact: 3, note: '4WD with low range capability' });
    total += 3;
  } else if (canonical.drivetrain === 'awd') {
    factors.push({ name: 'Drivetrain', impact: 2, note: 'AWD provides traction in most conditions' });
    total += 2;
  } else if (canonical.drivetrain === 'rwd') {
    factors.push({ name: 'Drivetrain', impact: 0.5, note: 'RWD offers limited off-road traction' });
    total += 0.5;
  } else {
    factors.push({ name: 'Drivetrain', impact: 0, note: 'FWD is not suited for off-road use' });
  }

  // Body style / ground clearance proxy (0-3 points)
  const bodyStyle = canonical.bodyStyle;
  const vehicleClass = canonical.vehicleClass;

  if (vehicleClass === 'body_on_frame_suv') {
    factors.push({ name: 'Platform', impact: 3, note: 'Body-on-frame construction for durability' });
    total += 3;
  } else if (vehicleClass === 'compact_truck' || vehicleClass === 'fullsize_truck') {
    factors.push({ name: 'Platform', impact: 2.5, note: 'Truck platform with good clearance' });
    total += 2.5;
  } else if (bodyStyle === 'suv' || bodyStyle === 'crossover') {
    factors.push({ name: 'Platform', impact: 1.5, note: 'Unibody SUV/crossover with moderate clearance' });
    total += 1.5;
  } else if (bodyStyle === 'wagon') {
    factors.push({ name: 'Platform', impact: 1, note: 'Wagon with some ground clearance' });
    total += 1;
  } else {
    factors.push({ name: 'Platform', impact: 0, note: 'Low-clearance platform' });
  }

  // Durability reputation (0-2 points) based on make/model
  const model = canonical.model.toLowerCase();
  const make = canonical.make.toLowerCase();
  const highDurability = ['4runner', 'tacoma', 'wrangler', 'frontier', 'tundra', 'land cruiser'];
  const medDurability = ['forester', 'outback', 'pilot', 'highlander', 'rav4', 'cr-v', 'sorento'];

  if (highDurability.includes(model)) {
    factors.push({ name: 'Durability reputation', impact: 2, note: `${canonical.make} ${canonical.model} is known for rugged reliability` });
    total += 2;
  } else if (medDurability.includes(model) || make === 'toyota' || make === 'honda') {
    factors.push({ name: 'Durability reputation', impact: 1, note: 'Solid reliability reputation' });
    total += 1;
  } else {
    factors.push({ name: 'Durability reputation', impact: 0.5 });
    total += 0.5;
  }

  // Transmission bonus for manual in trucks/SUVs (0-1 point)
  if (canonical.transmissionType === 'manual' && (vehicleClass === 'compact_truck' || vehicleClass === 'body_on_frame_suv')) {
    factors.push({ name: 'Manual transmission', impact: 1, note: 'Manual gearbox preferred for off-road control' });
    total += 1;
  }

  // Weather confidence bonus for AWD/4WD (0-1 point)
  if (canonical.drivetrain === '4wd' || canonical.drivetrain === 'awd') {
    factors.push({ name: 'Weather capability', impact: 1, note: 'Confident in snow and wet conditions' });
    total += 1;
  }

  // Normalize to 0-10
  const value = Math.min(10, Math.round(total * 10) / 10);
  const confidence = canonical.drivetrain && canonical.bodyStyle ? 'high' as const : 'medium' as const;

  let label: string;
  if (value >= 8) label = 'Excellent';
  else if (value >= 6) label = 'Strong';
  else if (value >= 4) label = 'Moderate';
  else if (value >= 2) label = 'Limited';
  else label = 'Minimal';

  return { value, confidence, label, factors };
}

export const capabilityDimension: ComparisonDimension = {
  id: 'capability',
  label: 'Off-Road / Rough-Road Capability',
  shortLabel: 'Capability',
  description: 'Rates suitability for off-road, rough roads, and adverse weather based on drivetrain, platform, clearance, and durability.',
  score: scoreCapability,
};
