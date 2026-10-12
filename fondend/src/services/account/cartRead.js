import { getJson } from '../httpClient.js';
import { createSingleFlightRead } from '../singleFlightRead.js';
const reader = createSingleFlightRead(() => getJson('/cart'));
export const readCart = reader.get;
export const invalidateCartRead = reader.invalidate;
