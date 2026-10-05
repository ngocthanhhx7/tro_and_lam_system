import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { validateEnv } from '../validators/env.validator.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
export const env = validateEnv(process.env);
