import { UserOperationStruct } from '@account-abstraction/contracts';
import { createSlice } from '@reduxjs/toolkit';
import { RootState } from '.';
import { ethers } from 'ethers';
import KeyringService from '../services/keyring';
import ProviderBridgeService, {
  EthersTransactionRequest,
} from '../services/provider-bridge';
import { createBackgroundAsyncThunk } from './utils';

export type TransactionState = {
  transactionRequest?: EthersTransactionRequest;
  transactionsRequest?: EthersTransactionRequest[];
  modifiedTransactionsRequest?: EthersTransactionRequest[];

  requestOrigin?: string;
  userOperationRequest?: Partial<UserOperationStruct>;
  unsignedUserOperation?: UserOperationStruct;
};

export const initialState: TransactionState = {
  transactionsRequest: undefined,
  transactionRequest: undefined,
  userOperationRequest: undefined,
  unsignedUserOperation: undefined,
};

type SigningReducers = {
  sendTransactionRequest: (
    state: TransactionState,
    {
      payload,
    }: {
      payload: {
        transactionRequest: EthersTransactionRequest;
        origin: string;
      };
    }
  ) => TransactionState;
  sendTransactionsRequest: (
    state: TransactionState,
    {
      payload,
    }: {
      payload: {
        transactionsRequest: EthersTransactionRequest[];
        origin: string;
      };
    }
  ) => TransactionState;
  setModifyTransactionsRequest: (
    state: TransactionState,
    {
      payload,
    }: {
      payload: EthersTransactionRequest[];
    }
  ) => TransactionState;
  sendUserOperationRquest: (
    state: TransactionState,
    { payload }: { payload: UserOperationStruct }
  ) => TransactionState;
  setUnsignedUserOperation: (
    state: TransactionState,
    { payload }: { payload: UserOperationStruct }
  ) => TransactionState;
  clearTransactionState: (state: TransactionState) => TransactionState;
};

const transactionsSlice = createSlice<
  TransactionState,
  SigningReducers,
  'signing'
>({
  name: 'signing',
  initialState,
  reducers: {
    sendTransactionRequest: (
      state,
      {
        payload: { transactionRequest, origin },
      }: {
        payload: {
          transactionRequest: EthersTransactionRequest;
          origin: string;
        };
      }
    ) => {
      return {
        ...state,
        transactionRequest: transactionRequest,
        requestOrigin: origin,
      };
    },
    sendTransactionsRequest: (
      state,
      {
        payload: { transactionsRequest, origin },
      }: {
        payload: {
          transactionsRequest: EthersTransactionRequest[];
          origin: string;
        };
      }
    ) => {
      return {
        ...state,
        transactionsRequest: transactionsRequest,
        requestOrigin: origin,
      };
    },
    setModifyTransactionsRequest: (
      state,
      {
        payload,
      }: {
        payload: EthersTransactionRequest[];
      }
    ) => ({
      ...state,
      modifiedTransactionsRequest: payload,
    }),
    sendUserOperationRquest: (
      state,
      { payload }: { payload: UserOperationStruct }
    ) => ({
      ...state,
      userOperationRequest: payload,
    }),
    setUnsignedUserOperation: (
      state,
      { payload }: { payload: UserOperationStruct }
    ) => ({
      ...state,
      unsignedUserOperation: payload,
    }),
    clearTransactionState: (state) => ({
      ...state,
      typedDataRequest: undefined,
      signDataRequest: undefined,
      transactionRequest: undefined,
      transactionsRequest: undefined,
      modifiedTransactionsRequest: undefined,
      requestOrigin: undefined,
      userOperationRequest: undefined,
      unsignedUserOperation: undefined,
    }),
  },
});

export const {
  sendTransactionRequest,
  sendTransactionsRequest,
  setModifyTransactionsRequest,
  sendUserOperationRquest,
  setUnsignedUserOperation,
  clearTransactionState,
} = transactionsSlice.actions;

export default transactionsSlice.reducer;

export const sendTransaction = createBackgroundAsyncThunk(
  'transactions/sendTransaction',
  async (
    { address, context }: { address: string; context?: any },
    { dispatch, extra: { mainServiceManager } }
  ) => {
    const keyringService = mainServiceManager.getService(
      KeyringService.name
    ) as KeyringService;

    const state = mainServiceManager.store.getState() as RootState;
    const oldUnsignedUserOp = state.transactions.unsignedUserOperation;

    // Define the data values
    const paymasterAddress = "0xCaaaDebF13BD0173eA21C2AC944AfA97dc461de6";
    const root = ethers.utils.randomBytes(32);
    const inputNullifiers = [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)];
    const outputCommitments = [ethers.utils.randomBytes(32), ethers.utils.randomBytes(32)];
    const recipient = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"; // Replace with the actual recipient address
    const extAmount = ethers.utils.parseEther("1").mul(-1);
    const proof = "0xabcdef0123456789";

    // Encode the arrays individually
    const encodedInputNullifiers = inputNullifiers.map((inputNullifier) =>
      ethers.utils.solidityPack(["bytes32"], [inputNullifier])
    );
    const encodedOutputCommitments = outputCommitments.map((outputCommitment) =>
      ethers.utils.solidityPack(["bytes32"], [outputCommitment])
    );

    // Encode the data
    const paymasterData = ethers.utils.solidityPack(
      ["address", "bytes32"],
      [paymasterAddress, root]
    ).concat(
      encodedInputNullifiers.join(""),
      encodedOutputCommitments.join(""),
      ethers.utils.solidityPack(["address", "int256", "bytes"], [recipient, extAmount, proof])
    );

    // update the unsignedUserOp
    const unsignedUserOp = {
      ...oldUnsignedUserOp,
      paymasterAndData: paymasterData,
      verificationGasLimit: 8_000_000,
    };

    console.log("New unsignedUserOp: ", unsignedUserOp);


    const origin = state.transactions.requestOrigin;

    if (unsignedUserOp) {
      const signedUserOp = await keyringService.signUserOpWithContext(
        address,
        unsignedUserOp,
        context
      );
      const txnHash = keyringService.sendUserOp(address, signedUserOp);

      dispatch(clearTransactionState());

      const providerBridgeService = mainServiceManager.getService(
        ProviderBridgeService.name
      ) as ProviderBridgeService;

      providerBridgeService.resolveRequest(origin || '', txnHash);
    }
  }
);

export const createUnsignedUserOp = createBackgroundAsyncThunk(
  'transactions/createUnsignedUserOp',
  async (address: string, { dispatch, extra: { mainServiceManager } }) => {
    const keyringService = mainServiceManager.getService(
      KeyringService.name
    ) as KeyringService;

    const state = mainServiceManager.store.getState() as RootState;
    const transactionRequest = state.transactions.transactionRequest;

    if (transactionRequest) {
      const userOp = await keyringService.createUnsignedUserOp(
        address,
        transactionRequest
      );
      dispatch(setUnsignedUserOperation(userOp));
    }
  }
);

export const rejectTransaction = createBackgroundAsyncThunk(
  'transactions/rejectTransaction',
  async (address: string, { dispatch, extra: { mainServiceManager } }) => {
    dispatch(clearTransactionState());

    const requestOrigin = (mainServiceManager.store.getState() as RootState)
      .transactions.requestOrigin;

    const providerBridgeService = mainServiceManager.getService(
      ProviderBridgeService.name
    ) as ProviderBridgeService;

    providerBridgeService.rejectRequest(requestOrigin || '', '');
  }
);
