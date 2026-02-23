/**
 * Encryption utilities for PII (PAN, bank account numbers).
 * Uses AES-256-CBC with a key from environment/Azure Key Vault.
 * In production, replace with Azure Key Vault managed keys.
 */

import crypto from 'crypto';
import { logger } from './logger';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

if (!process.env.ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ENCRYPTION_KEY is required in production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  logger.warn(
    'ENCRYPTION_KEY not set — encrypt/decrypt will throw when called. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

function requireKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(requireKey(), 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, encryptedHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(requireKey(), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
