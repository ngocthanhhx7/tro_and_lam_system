import { createInterface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { bootstrapFirstAdmin } from '../services/identity/admin-bootstrap.service.js';

function databaseNameFromUri(uri) {
  try {
    const pathname = new URL(uri).pathname.replace(/^\/+/, '');
    return decodeURIComponent(pathname.split('/')[0] || '');
  } catch {
    return '';
  }
}

function askVisible(question) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => prompt.question(question, (answer) => {
    prompt.close();
    resolve(answer.trim());
  }));
}

function askHidden(question) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Secure password entry requires an interactive terminal.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const decoder = new StringDecoder('utf8');
    const restoreTerminal = () => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const character of decoder.write(chunk)) {
        if (character === '\u0003') {
          restoreTerminal();
          reject(Object.assign(new Error('Password entry cancelled.'), { code: 'BOOTSTRAP_CANCELLED' }));
          return;
        }
        if (character === '\r' || character === '\n') {
          restoreTerminal();
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('');
        } else if (character >= ' ') {
          value += character;
        }
      }
    };

    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

export async function runDevelopmentAdminBootstrap() {
  if (env.nodeEnv !== 'development') {
    throw Object.assign(new Error('Development admin bootstrap is restricted to NODE_ENV=development.'), { code: 'BOOTSTRAP_ENVIRONMENT_INVALID' });
  }

  const expectedDatabase = databaseNameFromUri(env.mongoUri);
  if (!expectedDatabase || !/test/iu.test(expectedDatabase)) {
    throw Object.assign(new Error('Development admin bootstrap is allowed only for a database with "test" in its name.'), { code: 'BOOTSTRAP_ENVIRONMENT_INVALID' });
  }

  console.log(`Development database: ${expectedDatabase}`);
  const confirmedDatabase = await askVisible('Type the exact database name to confirm: ');
  if (confirmedDatabase !== expectedDatabase) {
    throw Object.assign(new Error('Database confirmation did not match.'), { code: 'BOOTSTRAP_CONFIRMATION_REQUIRED' });
  }

  const name = await askVisible('Administrator display name: ');
  const email = await askVisible('Administrator email: ');
  const normalizedEmail = email.normalize('NFKC').trim().toLowerCase();
  const confirmedEmail = await askVisible('Re-enter the exact email to confirm control: ');
  if (confirmedEmail.normalize('NFKC').trim().toLowerCase() !== normalizedEmail) {
    throw Object.assign(new Error('Email confirmation did not match.'), { code: 'BOOTSTRAP_CONFIRMATION_REQUIRED' });
  }

  let password = '';
  let passwordConfirmation = '';
  try {
    password = await askHidden('Password (12–128 characters; input hidden): ');
    passwordConfirmation = await askHidden('Re-enter password (input hidden): ');
    if (password !== passwordConfirmation) {
      throw Object.assign(new Error('Password confirmation did not match.'), { code: 'BOOTSTRAP_INPUT_INVALID' });
    }

    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000, autoIndex: false });
    if (mongoose.connection.name !== expectedDatabase) {
      throw Object.assign(new Error('Connected database did not match the confirmed database.'), { code: 'BOOTSTRAP_CONFIRMATION_REQUIRED' });
    }

    const result = await bootstrapFirstAdmin({
      name,
      email,
      password,
      confirmedDatabaseName: confirmedDatabase,
      confirmedEmail: normalizedEmail,
    });
    return result;
  } finally {
    password = '';
    passwordConfirmation = '';
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runDevelopmentAdminBootstrap();
    console.log(`Initial development administrator created. User ID: ${result.userId}. No password was printed.`);
  } catch (error) {
    const publicMessage = error?.code === 'ADMIN_ALREADY_BOOTSTRAPPED'
      ? error.message
      : ['BOOTSTRAP_CONFIRMATION_REQUIRED', 'BOOTSTRAP_INPUT_INVALID', 'BOOTSTRAP_ENVIRONMENT_INVALID', 'BOOTSTRAP_CANCELLED'].includes(error?.code)
        ? error.message
        : 'Admin bootstrap failed. Check development configuration and database connectivity; sensitive values were not logged.';
    console.error(publicMessage);
    process.exitCode = error?.code === 'BOOTSTRAP_CANCELLED' ? 130 : 1;
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
  }
}
