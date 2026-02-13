/**
 * KITE Custodial SDK – configuration and API types.
 * No organization management: organization is derived from API key on the backend.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SdkConfiguration {
  /** KITE Custody Orchestrator base URL (e.g. https://kite.example.com) */
  baseUrl: string;
  /** API key for your organization (provided with the URL) */
  apiKey: string;
  /** Log level for SDK messages. Default: 'info' */
  logLevel?: LogLevel;
  /** Request timeout in milliseconds. Default: 30000 */
  timeout?: number;
}

/** Standard API response envelope from KITE */
export interface ApiResponse<T = unknown> {
  success: boolean;
  status: number;
  data?: T;
  error?: string;
}

// --- Wallets ---

export interface Wallet {
  walletId: string;
  address: string;
  userId?: string;
  userEmail?: string;
  organizationId?: string;
  createdAt?: string;
}

export interface CreateWalletParams {
  /** User email; user is created if doesn't exist. One wallet per user per organization. */
  userEmail: string;
}

export interface CreateWalletResult {
  userId: string;
  userEmail: string;
  walletId: string;
  address: string;
}

export interface ListWalletsResult {
  wallets: Wallet[];
  count?: number;
}

// --- Users ---

export interface User {
  userId: string;
  email: string;
  organizationId: string;
  walletCount?: number;
  hasWallet?: boolean;
}

export interface ListUsersResult {
  users: User[];
  count?: number;
}

export interface GetUserResult extends User {
  wallets?: Wallet[];
}

// --- Transactions: Nonce & Gas ---

export interface GetNonceParams {
  walletId: string;
  rpcUrl: string;
}

export interface GetNonceResult {
  walletId: string;
  walletAddress: string;
  nonce: number;
  rpcUrl: string;
}

export interface GasDataTier {
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
  gasLimit?: string;
}

export interface GetGasPricesParams {
  rpcUrl: string;
  transactionType?: number;
  transaction?: Record<string, unknown>;
}

export interface ChainSupportInfo {
  supportsEIP1559: boolean;
  chainId?: number;
  message?: string;
}

export interface GetGasPricesResult {
  rpcUrl: string;
  low?: GasDataTier;
  average?: GasDataTier;
  high?: GasDataTier;
  chainSupport?: ChainSupportInfo;
  message?: string;
}

export interface GetGasPriceParams {
  rpcUrl: string;
  transactionType?: number;
  transaction?: Record<string, unknown>;
}

export interface GetGasPriceResult {
  rpcUrl: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
  gasLimit?: string;
  chainSupport?: ChainSupportInfo;
  message?: string;
}

// --- Transactions: Create ---

export interface GasData {
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasLimit?: string;
}

export interface CreateNativeTransferParams {
  walletId: string;
  rpcUrl: string;
  to: string;
  value?: string;
  tokenAddress?: string; // Optional: if provided, treat as ERC20 transfer (for gas calculation)
  transactionType?: 0 | 1 | 2; // Optional: auto-detected based on chain support if not provided
  gasData?: GasData; // Optional: auto-calculated if not provided
  nonce?: number;
}

export interface CreateERC20TransferParams {
  walletId: string;
  rpcUrl: string;
  tokenAddress: string;
  to: string;
  amount: string;
  transactionType?: 0 | 1 | 2; // Optional: auto-detected based on chain support if not provided
  gasData?: GasData; // Optional: auto-calculated if not provided
  nonce?: number;
}

export interface CreateTransactionResult {
  walletId: string;
  transaction: Record<string, unknown>;
  unsignedRaw: string;
  chainId: number;
  rpcUrl: string;
  transactionType: number;
  gasLimit?: string;
  nonce?: number;
  tokenAddress?: string;
  chainWarning?: string;
}

// --- Transactions: Sign & Broadcast ---

export interface SignTransactionParams {
  walletId: string;
  unsignedRaw: string;
  transaction?: Record<string, unknown>;
}

export interface SignTransactionResult {
  walletId: string;
  unsignedRaw: string;
  signedHex: string;
  transactionHash: string;
  signature: {
    r: string;
    s: string;
    v: number;
  };
}

export interface BroadcastTransactionParams {
  signedHex: string;
  rpcUrl: string;
}

export interface BroadcastTransactionResult {
  transactionHash?: string;
  blockNumber?: number;
  blockHash?: string;
  status?: number;
  gasUsed?: string;
  // Error details (if broadcast failed)
  errorCode?: string;
  errorData?: any;
  reason?: string;
}

// --- Health ---

export interface HealthResult {
  success: boolean;
  status: number;
  data: {
    status: string;
    service: string;
    environment?: string;
  };
}
