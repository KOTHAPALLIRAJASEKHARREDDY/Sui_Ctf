import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import keyPairJson from "../keypair.json" with { type: "json" };

const PACKAGE_ID =
  "0xd56e5075ba297f9e37085a37bb0abba69fabdf9987f8f4a6086a3693d88efbfd";

const STAKING_POOL_ID =
  "0x58ff08fb7e6d2568784abee3021c6dcbad1cd6840d448efe843462d0f5d75ba8";

const CLOCK_ID = "0x6";

const RECEIPT_TYPE =
  `${PACKAGE_ID}::staking::StakeReceipt`;

const keypair = Ed25519Keypair.fromSecretKey(keyPairJson.privateKey);
const suiAddress = keypair.getPublicKey().toSuiAddress();

const client = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl("testnet"),
  network: "testnet",
});

async function getAllStakeReceipts(owner: string): Promise<string[]> {
  let cursor: string | null | undefined = null;
  const ids: string[] = [];

  while (true) {
    const resp = await client.getOwnedObjects({
      owner,
      filter: {
        StructType: RECEIPT_TYPE,
      },
      options: {
        showType: true,
      },
      cursor,
    });

    for (const item of resp.data) {
      const id = item.data?.objectId;
      const type = item.data?.type;

      if (id && type === RECEIPT_TYPE) {
        ids.push(id);
      }
    }

    if (!resp.hasNextPage) break;
    cursor = resp.nextCursor;
  }

  return ids;
}

(async () => {
  console.log("Using address:", suiAddress);

  // Wait a little over 1 hour before running this.
  const receiptIds = await getAllStakeReceipts(suiAddress);

  console.log(`Found ${receiptIds.length} stake receipts`);

  if (receiptIds.length === 0) {
    throw new Error("No StakeReceipt objects found in this wallet.");
  }

  const tx = new Transaction();
  tx.setSender(suiAddress);
  tx.setGasBudget(400_000_000);

  // 1) Update every receipt so each gets credited with elapsed whole hours.
  let receipts: any[] = receiptIds.map((id) =>
    tx.moveCall({
      target: `${PACKAGE_ID}::staking::update_receipt`,
      arguments: [tx.object(id), tx.object(CLOCK_ID)],
    })
  );

  // 2) Merge receipts pairwise until one final receipt remains.
  while (receipts.length > 1) {
    const nextRound: any[] = [];

    for (let i = 0; i < receipts.length; i += 2) {
      if (i + 1 < receipts.length) {
        const merged = tx.moveCall({
          target: `${PACKAGE_ID}::staking::merge_receipts`,
          arguments: [receipts[i], receipts[i + 1], tx.object(CLOCK_ID)],
        });
        nextRound.push(merged);
      } else {
        nextRound.push(receipts[i]);
      }
    }

    receipts = nextRound;
  }

  const finalReceipt = receipts[0];

  // 3) Claim flag + unstaked SUI back.
  const [flag, returnedCoin] = tx.moveCall({
    target: `${PACKAGE_ID}::staking::claim_flag`,
    arguments: [
      tx.object(STAKING_POOL_ID),
      finalReceipt,
      tx.object(CLOCK_ID),
    ],
  });

  // 4) Transfer both returned objects to yourself.
  tx.transferObjects([flag, returnedCoin], tx.pure.address(suiAddress));

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showBalanceChanges: true,
    },
  });

  console.log(JSON.stringify(result, null, 2));
})();