# Cashu Keyset Rotation Lab

An offline lesson for wallet developers and Cashu learners. Compare two public keyset snapshots from one mint, then change the number of proofs in a hypothetical swap to see its fee. Download the source and open [index.html](index.html) in a current browser. The sample works offline, with no setup. There are no dependencies.

## Try a rotation

1. Start with the two example snapshots. The original sat keyset ends in `01`. After rotation it is inactive, and a new active sat keyset ends in `02`. The USD row stays the same. The IDs are invented for the exercise.
2. Look at the fee estimate for two proofs from the old keyset and one from the new keyset. Their rates are 100 and 500 ppk. The total is 700 ppk, so the mint charges **1 sat**. Rounding each group separately would give the wrong answer.
3. Change the old proof count to 6 while keeping one new proof. The total becomes 1,100 ppk and the fee becomes **2 sats**. Select USD for a separate, zero-fee exercise in cents.
4. To try your own snapshots, paste two public `GET /v1/keysets` responses from the **same mint**, taken at different times. Select **Compare snapshots**. Both snapshots stay in this browser tab. The lab reads keyset IDs, units, active flags, fee rates and final expiry timestamps. Only public metadata belongs in these fields.

## Read the result

- **Active** describes whether the mint accepts new outputs for a keyset when it accepts the request. A keyset can stop accepting new outputs while old proofs can still serve as inputs. After a keyset's final expiry the mint is no longer obliged to redeem its proofs. An already accepted request keeps its original output keyset.
- **No longer listed** records an observation in a later snapshot. Neither snapshot contains the spending state of a particular proof. The fee calculator offers the keysets listed in the later snapshot and models counts supplied by the reader.
- The fee is the ceiling of the sum of each input proof's rate divided by 1,000. Missing or null fee rates count as zero. Each estimate uses a single unit. USD and EUR amounts are denominated in cents. Estimates cover the Cashu input fee only.
- Keysets are matched by exact unit and ID. The lab also handles multiple active keysets, an empty list and unknown currency units. It does not contact a mint, check its reserves, authenticate keyset IDs from public keys or execute a swap.

## Verify the arithmetic

Run `node test.cjs` in this directory. The tests cover fees around rounding boundaries, mixed rates, separate units, earlier and later snapshot membership, malformed input and integer overflow. The browser and Node use the same calculation.

Protocol sources: [NUT-01 currency units](https://github.com/cashubtc/nuts/blob/main/01.md), [NUT-02 keysets and fees](https://github.com/cashubtc/nuts/blob/8f83a974503643d47fef12614039dca0e17e8ab1/02.md) and [NUT-03 swaps](https://github.com/cashubtc/nuts/blob/main/03.md).

Built in November 2026 for Nut November. Released under the [MIT License](LICENSE).
