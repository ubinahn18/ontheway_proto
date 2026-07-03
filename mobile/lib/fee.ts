import { PLATFORM_FEE_RATE } from './constants';

// rounded down to the nearest 10 won
export function calcPlatformFee(price: number): number {
  return Math.floor((price * PLATFORM_FEE_RATE) / 10) * 10;
}
