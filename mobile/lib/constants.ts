// theft/damage exposure cap for a single listing — enforced again server-side
// in insert_item(), this is just for immediate client feedback
export const MAX_ITEM_PRICE = 100000;

export const PLATFORM_FEE_RATE = 0.2;

// assumptions used only for the client-side fuel cost estimate; Kakao Navi
// gives us the toll fare directly, but not fuel cost
export const FUEL_EFFICIENCY_KM_PER_L = 14;
export const FUEL_PRICE_PER_L = 1700;

export const DROPOFF_INSTRUCTION_PRESETS = [
  '대문 앞에 두고 초인종 누르고 가기',
  '경비실에 보관',
  '초인종 누르고 당사자 또는 동거가족에게 직접 전달',
];
