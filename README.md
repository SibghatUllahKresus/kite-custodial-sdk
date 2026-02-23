# KITE Custodial SDK

TypeScript/Node client for the KITE Custody Orchestrator API.

This SDK covers wallet, user, gas/nonce, and transaction lifecycle operations (create unsigned tx, sign, broadcast). Organization/admin management is intentionally not exposed in the SDK.

## Installation

```bash
npm install @kite/custodial-sdk
```

## Requirements

- Node.js 18+ (uses global `fetch` and `AbortController`)

## Quick start

```ts
import { KiteClient } from '@kite/custodial-sdk';

const client = new KiteClient({
  baseUrl: 'https://your-orchestrator-url.com',
  apiKey: 'your-organization-api-key',
  logLevel: 'info', // optional: debug | info | warn | error
  timeout: 30000,   // optional, ms
});
```

## API reference

| Area | Method | Backend endpoint | Required inputs |
| --- | --- | --- | --- |
| Health | `healthCheck()` | `GET /health` | None |
| Wallets | `createWallet({ userEmail })` | `POST /api/wallets` | `userEmail` |
| Wallets | `listWallets()` | `GET /api/wallets` | None |
| Wallets | `getWallet(walletId)` | `GET /api/wallets/:walletId` | `walletId` |
| Wallets | `getWalletsByUser(email)` | `GET /api/wallets/users/:email/wallets` | `email` |
| Users | `listUsers()` | `GET /api/users` | None |
| Users | `getUser(email)` | `GET /api/users/:email` | `email` |
| Tx utility | `getNonce({ walletId, rpcUrl })` | `POST /api/transactions/nonce` | `walletId`, `rpcUrl` |
| Tx utility | `getGasPrices({ rpcUrl, transactionType?, transaction? })` | `POST /api/transactions/gas-prices` | `rpcUrl` |
| Tx utility | `getGasPrice({ rpcUrl, transactionType?, transaction? })` | `POST /api/transactions/gas-price` | `rpcUrl` |
| Tx create | `createNativeTransfer(params)` | `POST /api/transactions/native` | `walletId`, `rpcUrl`, `to` |
| Tx create | `createERC20Transfer(params)` | `POST /api/transactions/erc20` | `walletId`, `rpcUrl`, `tokenAddress`, `to`, `amount` |
| Tx sign | `signTransaction({ walletId, unsignedRaw, transaction? })` | `POST /api/transactions/sign` | `walletId`, `unsignedRaw` (`0x...`) |
| Tx broadcast | `broadcastTransaction({ signedHex, rpcUrl })` | `POST /api/transactions/broadcast` | `signedHex`, `rpcUrl` |

## Usage examples

### Health

```ts
const health = await client.healthCheck();
// { status, service, environment? }
```

### Wallets and users

```ts
const created = await client.createWallet({ userEmail: 'user@example.com' });
// { userId, userEmail, walletId, address }

const { wallets, count } = await client.listWallets();
const wallet = await client.getWallet(created.walletId);
const userWallets = await client.getWalletsByUser('user@example.com');

const { users } = await client.listUsers();
const user = await client.getUser('user@example.com');
```

### Nonce and gas

```ts
const nonce = await client.getNonce({
  walletId: 'wallet-id',
  rpcUrl: 'https://eth.llamarpc.com',
});

const gasTiers = await client.getGasPrices({
  rpcUrl: 'https://eth.llamarpc.com',
  transactionType: 2, // optional
});

const singleGas = await client.getGasPrice({
  rpcUrl: 'https://eth.llamarpc.com',
  transactionType: 2, // optional
});
```

### Native transfer flow (create -> sign -> broadcast)

```ts
const createdTx = await client.createNativeTransfer({
  walletId: 'wallet-id',
  rpcUrl: 'https://eth.llamarpc.com',
  to: '0x0000000000000000000000000000000000000001',
  value: '0',
  // optional:
  // transactionType: 1 | 2
  // gasData: { gasPrice?, maxFeePerGas?, maxPriorityFeePerGas?, gasLimit? }
  // nonce: number
  // tokenAddress: if provided, backend can use ERC20-style gas estimation
});

const signedTx = await client.signTransaction({
  walletId: 'wallet-id',
  unsignedRaw: createdTx.unsignedRaw,
});

const receipt = await client.broadcastTransaction({
  signedHex: signedTx.signedHex,
  rpcUrl: 'https://eth.llamarpc.com',
});
```

### ERC20 transfer flow

```ts
const createdTx = await client.createERC20Transfer({
  walletId: 'wallet-id',
  rpcUrl: 'https://eth.llamarpc.com',
  tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  to: '0x0000000000000000000000000000000000000001',
  amount: '1000000',
  // optional: transactionType, gasData, nonce
});

const signedTx = await client.signTransaction({
  walletId: 'wallet-id',
  unsignedRaw: createdTx.unsignedRaw,
});

await client.broadcastTransaction({
  signedHex: signedTx.signedHex,
  rpcUrl: 'https://eth.llamarpc.com',
});
```

## Errors

The SDK throws typed errors:

- `KiteApiError`: API responded with non-2xx or `success: false`
- `KiteNetworkError`: request failed before API response (timeout/network)

```ts
import { KiteApiError, KiteNetworkError } from '@kite/custodial-sdk';

try {
  await client.getWallet('wallet-id');
} catch (err) {
  if (err instanceof KiteApiError) {
    console.error(err.statusCode, err.message);
    if (err.isAuthError()) console.error('Invalid or missing API key');
  } else if (err instanceof KiteNetworkError) {
    console.error('Network issue:', err.message);
  }
}
```

### Broadcast failure details

`broadcastTransaction` resolves only on success. On failure, it throws `KiteApiError`; detailed RPC fields are available on `error.raw`.

```ts
try {
  await client.broadcastTransaction({ signedHex, rpcUrl });
} catch (err) {
  if (err instanceof KiteApiError) {
    console.error('Broadcast failed:', err.statusCode, err.message);
    console.error('Raw details:', err.raw); // may include errorCode, errorData, reason
  }
}
```

## Test script

After building:

```bash
npm run build

export KITE_BASE_URL=http://localhost:3000
export KITE_API_KEY=your-organization-api-key

npm run test:sdk
SKIP_BROADCAST=1 npm run test:sdk
```

Optional env vars: `LOG_LEVEL`, `RPC_URL`, `TEST_USER_EMAIL`.
