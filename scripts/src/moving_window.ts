import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import keyPairJson from "../keypair.json" with { type: "json" };
import { Transaction } from '@mysten/sui/transactions';

const PACKAGE_ID = "0xd56e5075ba297f9e37085a37bb0abba69fabdf9987f8f4a6086a3693d88efbfd";
const CLOCK_ID = "0x6";

const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const suiAddress = keypair.getPublicKey().toSuiAddress();

const suiClient = new SuiGrpcClient({
	network: 'testnet',
	baseUrl: 'https://fullnode.testnet.sui.io:443',
});

(async () => {
  try {
    console.log("Sui address:", suiAddress);

    const tx = new Transaction();
    tx.setSender(suiAddress);
    tx.setGasBudget(10_000_000);

    const flag = tx.moveCall({
      target: `${PACKAGE_ID}::moving_window::extract_flag`,
      arguments: [tx.object(CLOCK_ID)],
    });

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