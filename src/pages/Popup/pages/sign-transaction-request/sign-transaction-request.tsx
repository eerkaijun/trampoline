import { UserOperationStruct } from '@account-abstraction/contracts';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import React, { useCallback, useState } from 'react';
import {
  AccountImplementations,
  ActiveAccountImplementation,
} from '../../../App/constants';
import {
  useBackgroundDispatch,
  useBackgroundSelector,
} from '../../../App/hooks';
import {
  getAccountInfo,
  getActiveAccount,
} from '../../../Background/redux-slices/selectors/accountSelectors';
import { selectCurrentOriginPermission } from '../../../Background/redux-slices/selectors/dappPermissionSelectors';
import { getActiveNetwork } from '../../../Background/redux-slices/selectors/networkSelectors';
import {
  selectCurrentPendingSendTransactionRequest,
  selectCurrentPendingSendTransactionUserOp,
} from '../../../Background/redux-slices/selectors/transactionsSelectors';
import {
  createUnsignedUserOp,
  rejectTransaction,
  sendTransaction,
  setUnsignedUserOperation,
} from '../../../Background/redux-slices/transactions';
import { EthersTransactionRequest } from '../../../Background/services/types';
import AccountInfo from '../../components/account-info';
import OriginInfo from '../../components/origin-info';
import Config from '../../../../exconfig';

const SignTransactionComponent =
  AccountImplementations[ActiveAccountImplementation].Transaction;

const SignTransactionConfirmation = ({
  activeNetwork,
  activeAccount,
  accountInfo,
  originPermission,
  transactions,
  userOp,
  onReject,
  onSend,
}: {
  activeNetwork: any;
  activeAccount: any;
  accountInfo: any;
  originPermission: any;
  transactions: EthersTransactionRequest[];
  userOp: UserOperationStruct;
  onReject: any;
  onSend: any;
}) => {
  const [showAddPaymasterUI, setShowAddPaymasterUI] = useState<boolean>(false);
  const [addPaymasterLoader, setAddPaymasterLoader] = useState<boolean>(false);
  const [paymasterError, setPaymasterError] = useState<string>('');
  const [paymasterAndData, setPaymasterAndData] = useState<string>('0x');
  const backgroundDispatch = useBackgroundDispatch();

  const addPaymaster = useCallback(async () => {
    console.log(paymasterAndData);
    setAddPaymasterLoader(true);
    if (paymasterAndData) {
      let vgl: BigNumberish = await userOp.verificationGasLimit;
      console.log(vgl);
      console.log(typeof vgl);
      const bnValue = BigNumber.from(vgl);
      vgl = bnValue.mul(5);
      backgroundDispatch(
        setUnsignedUserOperation({
          ...userOp,
          paymasterAndData: paymasterAndData,
          verificationGasLimit: vgl.toString(),
        })
      );
    }
    setAddPaymasterLoader(false);
    setShowAddPaymasterUI(false);
  }, [activeNetwork.chainID, backgroundDispatch, paymasterAndData, userOp]);

  return (
    <Container>
      <Box sx={{ p: 2 }}>
        <Typography textAlign="center" variant="h6">
          Send transaction request
        </Typography>
      </Box>
      {activeAccount && (
        <AccountInfo activeAccount={activeAccount} accountInfo={accountInfo} />
      )}
      <Stack spacing={2} sx={{ position: 'relative', pt: 2, mb: 4 }}>
        <OriginInfo permission={originPermission} />
        <Typography variant="h6" sx-={{ p: 2 }}>
          Paymaster Info
        </Typography>
        {!showAddPaymasterUI && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2">
              {userOp.paymasterAndData === '0x'
                ? 'No paymaster has been used'
                : ';'}
            </Typography>
            <Button onClick={() => setShowAddPaymasterUI(true)} variant="text">
              Add custom
            </Button>
          </Paper>
        )}
        {showAddPaymasterUI && (
          <Paper sx={{ p: 2 }}>
            <TextField
              value={paymasterAndData}
              onChange={(e) => setPaymasterAndData(e.target.value)}
              sx={{ width: '100%' }}
              label="Paymaster and data"
              variant="standard"
            />
            {paymasterError}
            <Box
              justifyContent="space-around"
              alignItems="center"
              display="flex"
              sx={{ p: '16px 0px' }}
            >
              <Button
                sx={{ width: 150 }}
                variant="outlined"
                onClick={() => {
                  setShowAddPaymasterUI(false);
                  setAddPaymasterLoader(false);
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={addPaymasterLoader}
                sx={{ width: 150, position: 'relative' }}
                variant="contained"
                onClick={addPaymaster}
              >
                Add
                {addPaymasterLoader && (
                  <CircularProgress
                    size={24}
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      marginTop: '-12px',
                      marginLeft: '-12px',
                    }}
                  />
                )}
              </Button>
            </Box>
          </Paper>
        )}
        <Typography variant="h6" sx-={{ p: 2 }}>
          {transactions.length > 1 ? ' Transactions data' : 'Transaction data'}
        </Typography>
        <Stack spacing={2}>
          {transactions.map((transaction: EthersTransactionRequest, index) => (
            <Paper key={index} sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                To:{' '}
                <Typography component="span" variant="body2">
                  {transaction.to}
                </Typography>
              </Typography>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Data:{' '}
                <Typography component="span" variant="body2">
                  {transaction.data?.toString()}
                </Typography>
              </Typography>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Value:{' '}
                <Typography component="span" variant="body2">
                  {transaction.value
                    ? ethers.utils.formatEther(transaction.value)
                    : 0}{' '}
                  {activeNetwork.baseAsset.symbol}
                </Typography>
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Stack>
      {!showAddPaymasterUI && (
        <Paper
          elevation={3}
          sx={{
            position: 'sticky',
            bottom: 0,
            left: 0,
            width: '100%',
          }}
        >
          <Box
            justifyContent="space-around"
            alignItems="center"
            display="flex"
            sx={{ p: 2 }}
          >
            <Button sx={{ width: 150 }} variant="outlined" onClick={onReject}>
              Reject
            </Button>
            <Button
              sx={{ width: 150 }}
              variant="contained"
              onClick={() => onSend()}
            >
              Send
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  );
};

const SignTransactionRequest = () => {
  const [stage, setStage] = useState<
    'custom-account-screen' | 'sign-transaction-confirmation'
  >('custom-account-screen');

  const [context, setContext] = useState(null);

  const backgroundDispatch = useBackgroundDispatch();
  const activeAccount = useBackgroundSelector(getActiveAccount);
  const activeNetwork = useBackgroundSelector(getActiveNetwork);
  const accountInfo = useBackgroundSelector((state) =>
    getAccountInfo(state, activeAccount)
  );

  const sendTransactionRequest = useBackgroundSelector(
    selectCurrentPendingSendTransactionRequest
  );

  const pendingUserOp = useBackgroundSelector(
    selectCurrentPendingSendTransactionUserOp
  );

  const originPermission = useBackgroundSelector((state) =>
    selectCurrentOriginPermission(state, {
      origin: sendTransactionRequest?.origin || '',
      address: activeAccount || '',
    })
  );

  const onSend = useCallback(
    async (_context?: any) => {
      if (activeAccount)
        await backgroundDispatch(
          sendTransaction({
            address: activeAccount,
            context: _context || context,
          })
        );
      window.close();
    },
    [activeAccount, backgroundDispatch, context]
  );

  const onComplete = useCallback(
    async (modifiedTransaction: EthersTransactionRequest, context?: any) => {
      if (activeAccount) {
        backgroundDispatch(createUnsignedUserOp(activeAccount));
        setContext(context);
        if (Config.showTransactionConfirmationScreen === false) {
          onSend(context);
        }
        setStage('sign-transaction-confirmation');
      }
    },
    [setContext, setStage, activeAccount, backgroundDispatch, onSend]
  );

  const onReject = useCallback(async () => {
    if (activeAccount)
      await backgroundDispatch(rejectTransaction(activeAccount));
    window.close();
  }, [backgroundDispatch, activeAccount]);

  if (
    stage === 'sign-transaction-confirmation' &&
    pendingUserOp &&
    sendTransactionRequest.transactionRequest
  )
    return (
      <SignTransactionConfirmation
        activeNetwork={activeNetwork}
        activeAccount={activeAccount}
        accountInfo={accountInfo}
        originPermission={originPermission}
        onReject={onReject}
        onSend={onSend}
        transactions={[sendTransactionRequest.transactionRequest]}
        userOp={pendingUserOp}
      />
    );

  return SignTransactionComponent &&
    sendTransactionRequest.transactionRequest ? (
    <SignTransactionComponent
      onReject={onReject}
      transaction={sendTransactionRequest.transactionRequest}
      onComplete={onComplete}
    />
  ) : null;
};

export default SignTransactionRequest;
