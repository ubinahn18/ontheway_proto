import { FUEL_EFFICIENCY_KM_PER_L, FUEL_PRICE_PER_L } from './constants';

// rough client-side fuel cost estimate for an extra detour distance — see
// the assumptions noted alongside FUEL_EFFICIENCY_KM_PER_L/FUEL_PRICE_PER_L
export function calcFuelCost(extraDistanceMeters: number): number {
  return Math.max(0, Math.round((extraDistanceMeters / 1000 / FUEL_EFFICIENCY_KM_PER_L) * FUEL_PRICE_PER_L));
}
