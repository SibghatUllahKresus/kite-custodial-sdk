#!/usr/bin/env node
/**
 * KITE Custodial SDK test script.
 * Usage:
 *   KITE_BASE_URL=http://localhost:3000 KITE_API_KEY=your-key node scripts/test-sdk.js
 *   Or: npm run test:sdk (if script is set in package.json)
 *
 * Runs all SDK methods with graceful error handling. Set SKIP_BROADCAST=1 to avoid sending a real transaction.
 */

const path = require('path');
const { KiteClient, KiteApiError, KiteNetworkError } = require(path.join(__dirname, '../dist/index.js'));

const baseUrl = process.env.KITE_BASE_URL || 'http://localhost:3000';
const apiKey = process.env.KITE_API_KEY || '';
const skipBroadcast = process.env.SKIP_BROADCAST === '1' || process.env.SKIP_BROADCAST === 'true';
const testUserEmail = process.env.TEST_USER_EMAIL || `sdk-test-${Date.now()}@example.com`;

function log(level, msg) {
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  console.log(`${prefix} [${level}] ${msg}`);
}

function handleError(context, err) {
  if (err instanceof KiteApiError) {
    log('error', `${context}: API error ${err.statusCode} - ${err.message}`);
    if (err.isAuthError()) log('warn', 'Check KITE_API_KEY');
    if (err.isNotFound()) log('warn', 'Resource not found');
  } else if (err instanceof KiteNetworkError) {
    log('error', `${context}: Network error - ${err.message}`);
  } else {
    log('error', `${context}: ${err.message || err}`);
  }
}

async function main() {
  if (!apiKey) {
    console.error('KITE_API_KEY is required. Create an organization first (admin) and set the API key.');
    process.exit(1);
  }

  const client = new KiteClient({
    baseUrl,
    apiKey,
    logLevel: process.env.LOG_LEVEL || 'info',
    timeout: 30000,
  });

  let walletId, walletAddress, unsignedRaw, signedHex, rpcUrl;
  rpcUrl = process.env.RPC_URL || 'https://eth.llamarpc.com';

  // 1. Health
  try {
    const health = await client.healthCheck();
    log('info', `Health: ${health.status} (${health.service})`);
  } catch (err) {
    handleError('healthCheck', err);
    process.exit(1);
  }

  // 2. Create wallet
  try {
    const created = await client.createWallet({ userEmail: testUserEmail });
    walletId = created.walletId;
    walletAddress = created.address;
    log('info', `Created wallet ${walletId} for ${testUserEmail}, address ${walletAddress}`);
  } catch (err) {
    if (err instanceof KiteApiError && err.statusCode === 409) {
      log('warn', 'User already has a wallet; listing wallets to get walletId');
      try {
        const { wallets } = await client.listWallets();
        if (wallets && wallets.length) {
          walletId = wallets[0].walletId;
          walletAddress = wallets[0].address;
        }
      } catch (e) {
        handleError('listWallets (fallback)', e);
      }
    }
    if (!walletId) {
      handleError('createWallet', err);
      process.exit(1);
    }
  }

  // 3. List wallets
  try {
    const { wallets, count } = await client.listWallets();
    log('info', `List wallets: ${count ?? wallets?.length ?? 0} wallet(s)`);
  } catch (err) {
    handleError('listWallets', err);
  }

  // 4. Get wallet
  if (walletId) {
    try {
      const wallet = await client.getWallet(walletId);
      log('info', `Get wallet: ${wallet.walletId} -> ${wallet.address}`);
    } catch (err) {
      handleError('getWallet', err);
    }
  }

  // 5. Get wallets by user
  try {
    const { user, wallets, count } = await client.getWalletsByUser(testUserEmail);
    log('info', `Get wallets by user: ${user?.email} has ${count ?? 0} wallet(s)`);
  } catch (err) {
    handleError('getWalletsByUser', err);
  }

  // 6. List users
  try {
    const { users, count } = await client.listUsers();
    log('info', `List users: ${count ?? users?.length ?? 0} user(s)`);
  } catch (err) {
    handleError('listUsers', err);
  }

  // 7. Get user
  try {
    const user = await client.getUser(testUserEmail);
    log('info', `Get user: ${user.email} (${user.userId})`);
  } catch (err) {
    handleError('getUser', err);
  }

  // 8. Get nonce
  if (walletId) {
    try {
      const nonceResult = await client.getNonce({ walletId, rpcUrl });
      log('info', `Nonce for wallet: ${nonceResult.nonce}`);
    } catch (err) {
      handleError('getNonce', err);
    }
  }

  // 9. Get gas prices
  try {
    const gas = await client.getGasPrices({ rpcUrl, transactionType: 2 });
    log('info', `Gas prices (EIP-1559): average maxFeePerGas=${gas.average?.maxFeePerGas ?? 'n/a'}`);
  } catch (err) {
    handleError('getGasPrices', err);
  }

  // 10. Get single gas price
  try {
    const single = await client.getGasPrice({ rpcUrl, transactionType: 2 });
    log('info', `Single gas price: maxFeePerGas=${single.maxFeePerGas ?? 'n/a'}`);
  } catch (err) {
    handleError('getGasPrice', err);
  }

  // 11. Create native transfer (unsigned)
  if (walletId) {
    try {
      const gasData = await client.getGasPrice({ rpcUrl, transactionType: 2 }).catch(() => ({}));
      const nonceResult = await client.getNonce({ walletId, rpcUrl }).catch(() => ({ nonce: 0 }));
      const created = await client.createNativeTransfer({
        walletId,
        rpcUrl,
        to: '0x0000000000000000000000000000000000000001',
        value: '0',
        transactionType: 2,
        gasData: gasData.maxFeePerGas ? {
          maxFeePerGas: gasData.maxFeePerGas,
          maxPriorityFeePerGas: gasData.maxPriorityFeePerGas || gasData.maxFeePerGas,
          gasLimit: gasData.gasLimit || '21000',
        } : undefined,
        nonce: nonceResult.nonce,
      });
      unsignedRaw = created.unsignedRaw;
      log('info', `Created native tx: unsignedRaw length ${created.unsignedRaw?.length ?? 0}`);
    } catch (err) {
      handleError('createNativeTransfer', err);
    }
  }

  // 12. Sign transaction
  if (walletId && unsignedRaw) {
    try {
      const signed = await client.signTransaction({ walletId, unsignedRaw });
      signedHex = signed.signedHex;
      log('info', `Signed tx: hash=${signed.transactionHash ?? 'n/a'}`);
    } catch (err) {
      handleError('signTransaction', err);
    }
  }

  // 13. Broadcast (optional, skip by default to avoid sending real tx)
  if (signedHex && !skipBroadcast) {
    try {
      const receipt = await client.broadcastTransaction({ signedHex, rpcUrl });
      log('info', `Broadcast: txHash=${receipt.transactionHash}, status=${receipt.status}`);
    } catch (err) {
      handleError('broadcastTransaction', err);
    }
  } else if (signedHex && skipBroadcast) {
    log('info', 'Skipping broadcast (SKIP_BROADCAST=1). Set SKIP_BROADCAST=0 to broadcast.');
  }

  log('info', 'SDK test run finished.');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
