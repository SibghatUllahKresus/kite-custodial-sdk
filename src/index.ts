/**
 * KITE Custodial SDK
 * Standalone client for the KITE Custody Orchestrator API (KITE custody solution).
 * Organization is derived from your API key; no org management on the client.
 */

import { request } from './client';
import type { RequestConfig } from './client';
import type {
  SdkConfiguration,
  ApiResponse,
  HealthResult,
  CreateWalletParams,
  CreateWalletResult,
  ListWalletsResult,
  Wallet,
  ListUsersResult,
  User,
  GetUserResult,
  GetNonceParams,
  GetNonceResult,
  GetGasPricesParams,
  GetGasPricesResult,
  GetGasPriceParams,
  GetGasPriceResult,
  CreateNativeTransferParams,
  CreateERC20TransferParams,
  CreateTransactionResult,
  SignTransactionParams,
  SignTransactionResult,
  BroadcastTransactionParams,
  BroadcastTransactionResult,
  LogLevel,
} from './types';
import { KiteApiError, KiteNetworkError } from './errors';

export type { SdkConfiguration, LogLevel };
export type {
  Wallet,
  CreateWalletParams,
  CreateWalletResult,
  ListWalletsResult,
  User,
  ListUsersResult,
  GetUserResult,
  GetNonceParams,
  GetNonceResult,
  GetGasPricesParams,
  GetGasPricesResult,
  GetGasPriceParams,
  GetGasPriceResult,
  CreateNativeTransferParams,
  CreateERC20TransferParams,
  CreateTransactionResult,
  SignTransactionParams,
  SignTransactionResult,
  BroadcastTransactionParams,
  BroadcastTransactionResult,
  HealthResult,
};
export { KiteApiError, KiteNetworkError };

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class KiteClient {
  private readonly config: RequestConfig;

  constructor(config: SdkConfiguration) {
    const baseUrl = config.baseUrl?.trim();
    const apiKey = config.apiKey?.trim();

    if (!baseUrl) {
      throw new Error('KiteClient: baseUrl is required');
    }
    if (!apiKey) {
      throw new Error('KiteClient: apiKey is required');
    }

    const logLevel = config.logLevel ?? 'info';
    const timeout = config.timeout ?? 30000;

    this.config = {
      baseUrl,
      apiKey,
      timeout,
      logLevel,
      log: (level: LogLevel, message: string) => {
        if (LOG_LEVELS[level] <= LOG_LEVELS[logLevel]) {
          const out = level === 'debug' ? 'log' : level;
          console[out](`[KiteSDK] ${message}`);
        }
      },
    };
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    return request<T>(this.config, method, path, body);
  }

  // --- Health ---

  /**
   * Health check for the KITE Custody Orchestrator.
   */
  async healthCheck(): Promise<HealthResult['data']> {
    const data = await this.req<HealthResult['data']>('GET', '/health');
    return data ?? { status: 'unknown', service: 'kite-custody-orchestrator' };
  }

  // --- Wallets ---

  /**
   * Create a user (if needed) and a wallet for that user.
   * One wallet per user per organization.
   */
  async createWallet(params: CreateWalletParams): Promise<CreateWalletResult> {
    const data = await this.req<CreateWalletResult>('POST', '/api/wallets', {
      userEmail: params.userEmail,
    });
    return data as CreateWalletResult;
  }

  /**
   * List all wallets for your organization.
   */
  async listWallets(): Promise<ListWalletsResult> {
    const data = await this.req<{ wallets?: Wallet[]; count?: number } | ListWalletsResult>('GET', '/api/wallets');
    if (Array.isArray((data as any).wallets)) {
      return { wallets: (data as any).wallets, count: (data as any).count };
    }
    if (Array.isArray((data as any).data?.wallets)) {
      return {
        wallets: (data as any).data.wallets,
        count: (data as any).data?.count,
      };
    }
    return { wallets: [], count: 0 };
  }

  /**
   * Get a single wallet by ID.
   */
  async getWallet(walletId: string): Promise<Wallet> {
    if (!walletId || typeof walletId !== 'string') {
      throw new KiteApiError({ statusCode: 400, message: 'walletId is required and must be a string' });
    }
    const data = await this.req<Wallet | { data?: Wallet }>('GET', `/api/wallets/${encodeURIComponent(walletId)}`);
    return (data as any).data ?? data;
  }

  /**
   * Get all wallets for a user by email.
   */
  async getWalletsByUser(email: string): Promise<{ user: User; wallets: Wallet[]; count: number }> {
    if (!email || typeof email !== 'string') {
      throw new KiteApiError({ statusCode: 400, message: 'email is required and must be a string' });
    }
    const data = await this.req<{ user: User; wallets: Wallet[]; count: number }>(
      'GET',
      `/api/wallets/users/${encodeURIComponent(email)}/wallets`
    );
    return data as { user: User; wallets: Wallet[]; count: number };
  }

  // --- Users ---

  /**
   * List all users in your organization.
   */
  async listUsers(): Promise<ListUsersResult> {
    const data = await this.req<{ users?: User[]; count?: number } | ListUsersResult>('GET', '/api/users');
    if (Array.isArray((data as any).users)) {
      return { users: (data as any).users, count: (data as any).count };
    }
    if (Array.isArray((data as any).data?.users)) {
      return {
        users: (data as any).data.users,
        count: (data as any).data?.count,
      };
    }
    return { users: [], count: 0 };
  }

  /**
   * Get a user by email.
   */
  async getUser(email: string): Promise<GetUserResult> {
    if (!email || typeof email !== 'string') {
      throw new KiteApiError({ statusCode: 400, message: 'email is required and must be a string' });
    }
    const data = await this.req<GetUserResult | { data?: GetUserResult }>(
      'GET',
      `/api/users/${encodeURIComponent(email)}`
    );
    return (data as any).data ?? data;
  }

  // --- Transactions: Nonce & Gas ---

  /**
   * Get the current nonce for a wallet on the given chain.
   */
  async getNonce(params: GetNonceParams): Promise<GetNonceResult> {
    if (!params.walletId || !params.rpcUrl) {
      throw new KiteApiError({ statusCode: 400, message: 'walletId and rpcUrl are required' });
    }
    return this.req<GetNonceResult>('POST', '/api/transactions/nonce', {
      walletId: params.walletId,
      rpcUrl: params.rpcUrl,
    });
  }

  /**
   * Get gas price estimates (3 tiers: low, average, high) for EIP-1559.
   */
  /**
   * Get gas price estimates with 3 tiers (low, average, high)
   * Automatically detects chain support and validates transaction type.
   * Gas estimates include a 30% safety buffer.
   * 
   * @param params - rpcUrl, transactionType (optional), transaction (optional for accurate gas limit)
   */
  async getGasPrices(params: GetGasPricesParams): Promise<GetGasPricesResult> {
    if (!params.rpcUrl) {
      throw new KiteApiError({ statusCode: 400, message: 'rpcUrl is required' });
    }
    return this.req<GetGasPricesResult>('POST', '/api/transactions/gas-prices', {
      rpcUrl: params.rpcUrl,
      transactionType: params.transactionType,
      transaction: params.transaction,
    });
  }

  /**
   * Get a single gas price (for legacy or EIP-1559).
   * Gas estimates include a 30% safety buffer.
   */
  async getGasPrice(params: GetGasPriceParams): Promise<GetGasPriceResult> {
    if (!params.rpcUrl) {
      throw new KiteApiError({ statusCode: 400, message: 'rpcUrl is required' });
    }
    return this.req<GetGasPriceResult>('POST', '/api/transactions/gas-price', {
      rpcUrl: params.rpcUrl,
      transactionType: params.transactionType,
      transaction: params.transaction,
    });
  }

  // --- Transactions: Create ---

  /**
   * Create an unsigned native (ETH) transfer transaction.
   * Returns unsignedRaw for use with signTransaction.
   * 
   * Transaction type and gas data are auto-detected/calculated if not provided:
   * - transactionType: Auto-detected based on chain support (Type 2 if EIP-1559 supported, Type 1 otherwise)
   * - gasData: Auto-calculated with 30% safety buffer for native transfers, 50% for ERC20
   * 
   * If tokenAddress is provided, the transaction will be treated as ERC20 for gas estimation.
   * 
   * @param params - Transaction parameters. transactionType and gasData are optional and will be auto-detected/calculated.
   */
  async createNativeTransfer(params: CreateNativeTransferParams): Promise<CreateTransactionResult> {
    if (!params.walletId || !params.rpcUrl || !params.to) {
      throw new KiteApiError({
        statusCode: 400,
        message: 'walletId, rpcUrl, and to are required',
      });
    }
    // transactionType is optional - will be auto-detected by backend
    if (params.transactionType !== undefined && ![0, 1, 2].includes(params.transactionType)) {
      throw new KiteApiError({
        statusCode: 400,
        message: 'transactionType must be 0, 1 (Legacy), or 2 (EIP-1559) if provided',
      });
    }
    return this.req<CreateTransactionResult>('POST', '/api/transactions/native', {
      walletId: params.walletId,
      rpcUrl: params.rpcUrl,
      to: params.to,
      value: params.value,
      tokenAddress: params.tokenAddress, // Optional: for ERC20 gas calculation
      transactionType: params.transactionType, // Optional: auto-detected if not provided
      gasData: params.gasData, // Optional: auto-calculated if not provided
      nonce: params.nonce,
    });
  }

  /**
   * Create an unsigned ERC20 transfer transaction.
   * Returns unsignedRaw for use with signTransaction.
   * 
   * Gas calculation includes a 30% safety buffer automatically for contract interactions.
   * 
   * @param params - ERC20 transfer parameters
   */
  /**
   * Create an unsigned ERC20 token transfer transaction.
   * Returns unsignedRaw for use with signTransaction.
   * 
   * Transaction type and gas data are auto-detected/calculated if not provided:
   * - transactionType: Auto-detected based on chain support (Type 2 if EIP-1559 supported, Type 1 otherwise)
   * - gasData: Auto-calculated with 50% safety buffer for ERC20 transfers
   * 
   * @param params - Transaction parameters. transactionType and gasData are optional and will be auto-detected/calculated.
   */
  async createERC20Transfer(params: CreateERC20TransferParams): Promise<CreateTransactionResult> {
    if (!params.walletId || !params.rpcUrl || !params.tokenAddress || !params.to || params.amount == null) {
      throw new KiteApiError({
        statusCode: 400,
        message: 'walletId, rpcUrl, tokenAddress, to, and amount are required',
      });
    }
    // transactionType is optional - will be auto-detected by backend
    if (params.transactionType !== undefined && ![0, 1, 2].includes(params.transactionType)) {
      throw new KiteApiError({
        statusCode: 400,
        message: 'transactionType must be 0, 1 (Legacy), or 2 (EIP-1559) if provided',
      });
    }
    return this.req<CreateTransactionResult>('POST', '/api/transactions/erc20', {
      walletId: params.walletId,
      rpcUrl: params.rpcUrl,
      tokenAddress: params.tokenAddress,
      to: params.to,
      amount: params.amount,
      transactionType: params.transactionType, // Optional: auto-detected if not provided
      gasData: params.gasData, // Optional: auto-calculated if not provided
      nonce: params.nonce,
    });
  }

  // --- Transactions: Sign & Broadcast ---

  /**
   * Sign an unsigned transaction (hex from createNativeTransfer or createERC20Transfer).
   */
  async signTransaction(params: SignTransactionParams): Promise<SignTransactionResult> {
    if (!params.walletId || typeof params.walletId !== 'string') {
      throw new KiteApiError({ statusCode: 400, message: 'walletId is required and must be a string' });
    }
    if (!params.unsignedRaw || typeof params.unsignedRaw !== 'string' || !params.unsignedRaw.startsWith('0x')) {
      throw new KiteApiError({
        statusCode: 400,
        message: 'unsignedRaw is required and must be a valid hex string starting with 0x',
      });
    }
    const data = await this.req<SignTransactionResult>('POST', '/api/transactions/sign', {
      walletId: params.walletId,
      unsignedRaw: params.unsignedRaw,
      transaction: params.transaction,
    });
    return data as SignTransactionResult;
  }

  /**
   * Broadcast a signed transaction to the chain.
   * Returns detailed error information if broadcast fails (errorCode, errorData, reason).
   * 
   * @param params - Broadcast parameters (signedHex, rpcUrl)
   * @returns Transaction hash and receipt details, or error details if broadcast failed
   */
  async broadcastTransaction(params: BroadcastTransactionParams): Promise<BroadcastTransactionResult> {
    if (!params.signedHex || typeof params.signedHex !== 'string') {
      throw new KiteApiError({ statusCode: 400, message: 'signedHex is required and must be a string' });
    }
    if (!params.rpcUrl || typeof params.rpcUrl !== 'string') {
      throw new KiteApiError({ statusCode: 400, message: 'rpcUrl is required and must be a string' });
    }
    return this.req<BroadcastTransactionResult>('POST', '/api/transactions/broadcast', {
      signedHex: params.signedHex,
      rpcUrl: params.rpcUrl,
    });
  }
}

export default KiteClient;
