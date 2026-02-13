# KITE Custodial SDK

Standalone client for the **KITE Custody Orchestrator** API (KITE custody solution). Use it to create wallets, list users, and build/sign/broadcast transactions. Your organization is derived from your API key; there is no org management in the SDK.

## Installation

```bash
npm install @kite/custodial-sdk
```

Or from the monorepo:

```bash
cd packages/sdk && npm run build
# Then from your app: require('./packages/sdk/dist') or link the package
```

## Configuration

```ts
import { KiteClient } from '@kite/custodial-sdk';

const config = {
  baseUrl: 'https://your-kite-url.com',  // KITE Custody Orchestrator URL
  apiKey: 'your-api-key-here',            // API key from your organization
  logLevel: 'info',                       // 'debug' | 'info' | 'warn' | 'error'
  timeout: 30000,                         // Request timeout in ms
};

const client = new KiteClient(config);
```

## Usage

### Health

```ts
const health = await client.healthCheck();
// { status: 'ok', service: 'kite-custody-orchestrator', environment?: string }
```

### Wallets

```ts
// Create wallet (user is created if needed)
const created = await client.createWallet({ userEmail: 'user@example.com' });
// { userId, userEmail, walletId, address }

// List wallets
const { wallets, count } = await client.listWallets();

// Get one wallet
const wallet = await client.getWallet(walletId);

// Get wallets by user email
const { user, wallets, count } = await client.getWalletsByUser('user@example.com');
```

### Users

```ts
const { users, count } = await client.listUsers();
const user = await client.getUser('user@example.com');
```

### Transactions – Nonce & Gas

```ts
const nonceResult = await client.getNonce({ walletId, rpcUrl: 'https://eth.llamarpc.com' });
// { walletId, walletAddress, nonce, rpcUrl }

const gasTiers = await client.getGasPrices({ rpcUrl, transactionType: 2 });
// { rpcUrl, low, average, high, chainSupport?, message? }
// Gas estimates include a 30% safety buffer automatically

const singleGas = await client.getGasPrice({ rpcUrl, transactionType: 2 });
// Gas estimates include a 30% safety buffer automatically
```

### Transactions – Create, Sign, Broadcast

```ts
// 1. Create unsigned native transfer (EIP-1559)
// Gas calculation includes a 30% safety buffer automatically
// Optional: pass tokenAddress to treat as ERC20 for gas estimation
const created = await client.createNativeTransfer({
  walletId,
  rpcUrl: 'https://eth.llamarpc.com',
  to: '0x...',
  value: '1000000000000000000',
  transactionType: 2,
  tokenAddress: undefined, // Optional: if provided, gas calculation treats as ERC20
  gasData: { maxFeePerGas: '...', maxPriorityFeePerGas: '...', gasLimit: '21000' },
  nonce: 0,
});
// created.unsignedRaw → use in signTransaction
// created.chainWarning? → warning if transaction type doesn't match chain support

// 2. Sign
const signed = await client.signTransaction({
  walletId,
  unsignedRaw: created.unsignedRaw,
});
// signed.signedHex → use in broadcastTransaction

// 3. Broadcast
const receipt = await client.broadcastTransaction({
  signedHex: signed.signedHex,
  rpcUrl: 'https://eth.llamarpc.com',
});
// On success: receipt.transactionHash, blockNumber, status, gasUsed, etc.
// On error: receipt.errorCode, receipt.errorData, receipt.reason (detailed error info)
```

### ERC20 transfer

```ts
// Gas calculation includes a 30% safety buffer automatically for contract interactions
const created = await client.createERC20Transfer({
  walletId,
  rpcUrl,
  tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  to: '0x...',
  amount: '1000000',
  transactionType: 2,
  gasData: { ... },
  nonce: 0,
});
// Then signTransaction(created.unsignedRaw) and broadcastTransaction(signed.signedHex)
// created.chainWarning? → warning if transaction type doesn't match chain support
```

### Native transfer with token address (for ERC20 gas calculation)

```ts
// You can also use createNativeTransfer with tokenAddress for ERC20 gas estimation
const created = await client.createNativeTransfer({
  walletId,
  rpcUrl,
  to: '0x...',
  value: '1000000',
  tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Optional: for ERC20 gas calculation
  transactionType: 2,
  gasData: { ... },
  nonce: 0,
});
// The system will detect tokenAddress and calculate gas accordingly (ERC20 vs native)
```

## Error handling

All API and network errors are thrown as typed errors so you can handle them cleanly.

- **`KiteApiError`** – API returned an error (4xx/5xx or `success: false`).
  - `statusCode` – HTTP status
  - `message` – error message from the API
  - `isClientError()`, `isServerError()`, `isAuthError()`, `isNotFound()` helpers
- **`KiteNetworkError`** – Request failed before reaching the API (timeout, network, etc.).
  - `cause` – original error if available

Example:

```ts
import { KiteClient, KiteApiError, KiteNetworkError } from '@kite/custodial-sdk';

try {
  const wallet = await client.getWallet(walletId);
  console.log(wallet.address);
} catch (err) {
  if (err instanceof KiteApiError) {
    if (err.isNotFound()) console.error('Wallet not found');
    else if (err.isAuthError()) console.error('Invalid or missing API key');
    else console.error('API error:', err.statusCode, err.message);
  } else if (err instanceof KiteNetworkError) {
    console.error('Network error:', err.message);
  } else {
    throw err;
  }
}
```

### Broadcast Error Details

When broadcasting fails, the response includes detailed error information:

```ts
try {
  const result = await client.broadcastTransaction({ signedHex, rpcUrl });
  // Success: result.transactionHash, result.blockNumber, status, gasUsed, etc.
} catch (error) {
  if (error instanceof KiteApiError) {
    // Check error.raw for detailed error information
    const errorDetails = error.raw;
    if (errorDetails?.errorCode) {
      console.error('Error code:', errorDetails.errorCode);
    }
    if (errorDetails?.errorData) {
      console.error('Error data:', errorDetails.errorData);
    }
    if (errorDetails?.reason) {
      console.error('Reason:', errorDetails.reason);
    }
  }
}
```

The broadcast endpoint returns detailed error information including:
- `errorCode` – RPC error code
- `errorData` – Additional error data from RPC
- `reason` – Error reason
- Specific messages for: out of gas, transaction reverts, invalid signatures, nonce errors, insufficient funds

## Requirements

- **Node.js 18+** (uses global `fetch` and `AbortController`).
- For older Node, provide a `fetch` polyfill or use a different environment (e.g. browser).

## API coverage

| Area        | Methods |
|------------|---------|
| Health     | `healthCheck()` |
| Wallets    | `createWallet`, `listWallets`, `getWallet`, `getWalletsByUser` |
| Users      | `listUsers`, `getUser` |
| Nonce/Gas  | `getNonce`, `getGasPrices`, `getGasPrice` |
| Transactions | `createNativeTransfer`, `createERC20Transfer`, `signTransaction`, `broadcastTransaction` |

No organization or admin endpoints are exposed; the backend derives organization from your API key. **KITE** is a wallet infrastructure provider; this SDK is for their custody solution (Orchestrator + Vault).

## Testing script

From the package directory, after `npm run build`:

```bash
# Required: create an organization first (admin API), then set the API key
export KITE_BASE_URL=http://98.93.62.99:8000
export KITE_API_KEY=your-organization-api-key

# Run all SDK flows (create wallet, list, get nonce, gas, create tx, sign; optionally broadcast)
npm run test:sdk

# Skip broadcasting the signed tx (avoids sending a real transaction)
SKIP_BROADCAST=1 npm run test:sdk
```

Optional env: `LOG_LEVEL=debug`, `RPC_URL`, `TEST_USER_EMAIL`.
