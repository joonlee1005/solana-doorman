# DOORMAN

**On-chain anti-scalping ticketing protocol on Solana.**

Anti-scalping laws exist in many jurisdictions, but they lack enforcement mechanisms — resale price caps are written into law, yet nothing stops a seller from listing a ticket above that cap on a resale marketplace. DOORMAN makes that violation *structurally impossible* rather than merely illegal, by enforcing the resale price cap at the protocol level using Solana's Token-2022 Freeze/Thaw mechanism.

Built for [Solana Summer School](https://luma.com/g8b5fy9s) (Solana Foundation) Cohort 1, Demo Day — August 17, 2026.

---

## Core idea

Most resale protection relies on a marketplace's terms of service or after-the-fact legal enforcement. DOORMAN instead uses Token-2022's **Default Account State (Freeze/Thaw)** extension: every ticket token account rests in a `Frozen` state and can only move through a single atomic program instruction (`execute_resale`) that thaws the account, verifies the price against the on-chain cap, transfers payment, transfers the ticket, and re-freezes both accounts — all in one transaction. If the price check fails, the whole transaction reverts. There is no intermediate state where a ticket can be transferred at any price and *then* checked.

We chose Freeze/Thaw over Transfer Hook because a Transfer Hook only receives the token *quantity* being moved (`amount: u64`) — it has no visibility into the USDC payment happening alongside it, and therefore cannot enforce a price cap. Freeze/Thaw sidesteps this entirely by making the transfer itself only possible through a price-checked program instruction.

## Architecture

Four-level PDA hierarchy:

```
JurisdictionRegistry (per legal jurisdiction, e.g. "KR")
  └── Event (per event, holds jurisdiction reference)
        └── SeatTier (per price tier — VIP/R/S — holds its own
             |          Token-2022 mint, face_value, and resale_policy)
             └── Seat (individual seat, seat_code + display_name)
                   └── TokenAccount (Token-2022, Frozen at rest)
```

Resale policy is snapshotted at `create_seat_tier` time via a `more_restrictive()` check against the jurisdiction's cap — a seat tier can never be configured more permissively than the law allows.

### On-chain program (`programs/ticketing-system`)

Nine instructions:

| Instruction | Purpose |
|---|---|
| `create_jurisdiction_registry` | Register a jurisdiction and its resale price cap |
| `create_event` | Register an event under a jurisdiction |
| `create_seat_tier` | Create a price tier (VIP/R/S) with its own Token-2022 mint |
| `create_seat` | Register an individual seat as `Available` |
| `buy_seat` | Primary sale: pay face value, mint the ticket to the buyer, freeze it |
| `join_queue` | Deposit USDC into a price-time-priority bid queue for a seat tier |
| `leave_queue` | Cancel a queue registration, refund the deposit |
| `execute_resale` | Atomic resale: thaw → price-check against cap → pay seller → transfer ticket → re-freeze |
| `refund_ticket` | Organizer-initiated refund before the event's refund deadline |
| `check_in` | Mark a ticket as checked in at the event |

**Resale mechanics:** a seller does not set a resale price. Calling `execute_resale` matches the seat against the *front of the bid queue* (`bid_queue.bids[0]`) and pays out exactly that buyer's deposited amount, provided it's within the tier's cap. The cap is computed as `face_value * (10_000 + max_bps) / 10_000` — face value plus a markup, not a fraction of face value. The bid queue itself is ordered by **price-time priority**: highest deposit first, ties broken by earliest registration. If the queue is empty, `execute_resale` fails outright — there is no "listed and waiting" intermediate state on-chain.

### Frontend (`app/`)

React + Vite + Tailwind v4, using `@solana/web3.js` and an Anchor-generated IDL/client.

- **Identity system**: for demo purposes, the app uses locally-generated test keypairs (organizer + customer1/2/3) persisted in `localStorage`, switchable via a dropdown in the header — no wallet extension required.
- **Screens**: Home (event grid with a hero carousel), Event Detail (seat map + waitlist registration), My Tickets (held tickets + queue registrations), Resale (register/queue), Admin (event creation, seat/refund/resale management).
- **RPC**: configured via `VITE_DEVNET_RPC` (defaults to the public devnet RPC, which is rate-limited — a dedicated provider like Helius is recommended for real use).

## Known limitations

- **One seat per tier per wallet, for the wallet's lifetime.** The ticket token account is keyed on `(customer, tier)`, and `buy_seat` creates it with `init` rather than `init_if_needed`. A wallet that has ever held a ticket in a given tier — even after reselling it away — cannot buy into that tier again. Fixing this requires either per-seat mints or a different ATA initialization strategy, both larger changes deferred past this capstone.
- **Adjacent-seat (연석) matching is not implemented.** The bid queue has no concept of seat quantity or adjacency; buying or reselling multiple seats is done as N individual instruction calls, with no atomic guarantee they land on adjacent seats.
- **Off-chain side payments are a known, out-of-scope limitation.** A buyer and seller can always agree to a price above the cap and settle off-chain. We consider this out of scope because it doesn't scale to commercial scalping operations — every transaction requires individual negotiation, which is exactly the structural limit that makes real-world anti-scalping law hard to enforce at scale in the first place. DOORMAN's claim is narrower and more defensible: it makes *on-platform, automated* scalping structurally impossible.
- **Refunds are one-directional.** `refund_ticket` moves a seat from `Sold` to `Refunded`; there's no path back to `Available`. Demo/rehearsal environments that need a clean slate should mint a fresh jurisdiction/event/seat set rather than trying to "undo" a sale.

## Local development

### Prerequisites

- Rust (see `rust-toolchain.toml` for the pinned version) + Solana CLI
- Anchor CLI
- Node.js + npm

### Program

```bash
# from the repo root
anchor build
cargo test              # run the LiteSVM test suite
```

To deploy (or upgrade) the program to devnet:

```bash
solana program deploy target/deploy/ticketing_system.so \
  --url devnet \
  --keypair ~/.config/solana/id.json \
  --program-id target/deploy/ticketing_system-keypair.json
```

Note: if the new binary is larger than the currently-allocated program data account, you may need to extend it first:

```bash
solana program extend <PROGRAM_ID> <EXTRA_BYTES> --url devnet
```

After any program change, sync the IDL into the frontend:

```bash
cp target/idl/ticketing_system.json app/src/idl/
cp target/types/ticketing_system.ts app/src/idl/
```

### Frontend

```bash
cd app
npm install
cp .env.local.example .env.local   # fill in a devnet RPC URL (see below)
npm run dev
```

The dev server runs on a fixed port (`5183`, set via `strictPort: true` in `vite.config.ts`) — this matters because the test identities are derived from `localStorage`, which is scoped per-origin (host **and** port). If the port drifts, the app will look like it's generated brand-new, empty identities.

#### RPC configuration

The public devnet RPC (`api.devnet.solana.com`) is heavily rate-limited and will 429 under normal frontend usage (balance polling, blockhash fetches, confirm polling all add up quickly). Set `VITE_DEVNET_RPC` in `app/.env.local` to a dedicated provider's devnet endpoint (Helius, QuickNode, Alchemy, Syndica all have free tiers):

```
VITE_DEVNET_RPC=https://devnet.helius-rpc.com/?api-key=YOUR_KEY_HERE
```

`.env.local` is gitignored; never commit an API key.

#### Seeding demo data

The Event Detail page includes a "Seed demo data on-chain" panel (visible once an organizer-role identity is active) that idempotently creates a jurisdiction, event, three seat tiers, and their seats in a single flow (~12 transactions). Re-running it after a partial success skips whatever already exists on-chain.

#### Getting devnet SOL

The public devnet faucet is capped at 1 SOL per project per day and gets exhausted quickly across a team doing repeated rehearsals. If the in-app "get SOL" button is rate-limited, transfer SOL directly from a funded local CLI wallet instead:

```bash
solana transfer <RECIPIENT_PUBKEY> 0.3 \
  --from ~/.config/solana/id.json \
  --allow-unfunded-recipient \
  --url devnet
```

#### Resetting local test identities

Since on-chain seat/price state can't be reverted (see [Known limitations](#known-limitations)), the only real "reset" is generating fresh identities, which in turn derive a fresh event PDA:

```js
// run in the browser console
Object.keys(localStorage)
  .filter(k => k.startsWith("doorman:"))
  .forEach(k => localStorage.removeItem(k));
location.reload();
```

This zeroes out SOL/USDC balances for all four identities — refund them before rehearsing further.

## Project structure

```
programs/ticketing-system/   Anchor program (Rust)
  src/instructions/          One file per instruction
  src/state.rs                Account structs
  src/error.rs                 Custom errors
  tests/                       LiteSVM integration tests

app/                           Frontend (React + Vite + Tailwind)
  src/pages/                   Top-level screens
  src/components/              Shared UI (Header, modals, toasts)
  src/context/                 Identity + on-chain data providers
  src/lib/                     Program client, instruction wrappers, PDA derivation
  src/idl/                     Anchor-generated IDL (synced from target/idl)
  src/mock/                    Placeholder catalog data for screens not yet wired
```

## License

TBD.
