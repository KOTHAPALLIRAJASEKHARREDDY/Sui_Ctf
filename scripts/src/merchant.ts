import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import keyPairJson from "../keypair.json" with { type: "json" };
import { Transaction } from '@mysten/sui/transactions';

/**
 *
 * Global variables
 *
 * These variables can be used throughout the exercise below.
 *
 */
const PACKAGE_ID = "0xd56e5075ba297f9e37085a37bb0abba69fabdf9987f8f4a6086a3693d88efbfd";
const COST_PER_FLAG = 5849000;

const USDC_COIN_ID = "0xbda219fdf509c206eff222814b7492b64108b32019e9586e860c75e6a643fe94";

const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const suiAddress = keypair.getPublicKey().toSuiAddress();

const suiClient = new SuiGrpcClient({
	network: 'testnet',
	baseUrl: 'https://fullnode.testnet.sui.io:443',
});

(async () => {
  try {
    const tx = new Transaction();
    tx.setSender(suiAddress);
    tx.setGasBudget(10_000_000);

    // Split exactly 5,849,000 units from your USDC coin
    const [paymentCoin] = tx.splitCoins(tx.object(USDC_COIN_ID), [COST_PER_FLAG]);

    // Buy the flag with the exact USDC amount
    const flag = tx.moveCall({
      target: `${PACKAGE_ID}::merchant::buy_flag`,
      arguments: [paymentCoin],
    });

    // Send the returned flag to your wallet
    tx.transferObjects([flag], tx.pure.address(suiAddress));

    const result = await suiClient.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showBalanceChanges: true,
      },
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error);
  }
})();