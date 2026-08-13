mod common;

use anchor_spl::token_2022::spl_token_2022::state::AccountState;
use solana_keypair::Keypair;
use solana_signer::Signer;

use common::*;
use ticketing_system::ResalePolicy;

const USDC_DECIMALS: u8 = 6;

struct World {
    svm: litesvm::LiteSVM,
    payer: Keypair,
    organizer: Keypair,
    payment_mint: Keypair,
    jurisdiction_registry: anchor_lang::prelude::Pubkey,
}

fn setup_world(legal_cap_bps: u16) -> World {
    let (mut svm, payer) = setup();

    let organizer = Keypair::new();
    fund(&mut svm, &organizer.pubkey());

    let payment_mint = Keypair::new();
    create_payment_mint(&mut svm, &payer, &payment_mint, &payer.pubkey(), USDC_DECIMALS);

    let ix = ix_create_jurisdiction_registry(&payer.pubkey(), "KR", legal_cap_bps);
    send(&mut svm, &payer, &[ix], &[]).expect("create jurisdiction registry");
    let (jurisdiction_registry, _) = jurisdiction_pda("KR");

    World {
        svm,
        payer,
        organizer,
        payment_mint,
        jurisdiction_registry,
    }
}

fn fund_usdc(world: &mut World, owner: &anchor_lang::prelude::Pubkey, amount: u64) -> anchor_lang::prelude::Pubkey {
    let mint_pubkey = world.payment_mint.pubkey();
    let ata = create_ata(&mut world.svm, &world.payer, owner, &mint_pubkey);
    mint_payment_to(&mut world.svm, &world.payer, &mint_pubkey, &world.payer, &ata, amount);
    ata
}

#[test]
fn test_create_jurisdiction_and_event() {
    let mut world = setup_world(2000);

    let ix = ix_create_event(
        &world.organizer.pubkey(),
        1,
        world.jurisdiction_registry,
        1_900_000_000,
        10_000,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer])
        .expect("create event");

    let (event_addr, _) = event_pda(&world.organizer.pubkey(), 1);
    let account = world.svm.get_account(&event_addr).expect("event account exists");
    assert!(!account.data.is_empty());
}

/// Covers create_seat_tier's core policy logic: resale_policy is
/// min(organizer_policy, jurisdiction_legal_cap) via more_restrictive(), computed at
/// create_seat_tier time.
#[test]
fn test_seat_tier_resale_policy_more_restrictive() {
    // Case A: organizer is looser (Unrestricted) than the legal cap (2000 bps) ->
    // the legal cap wins.
    let mut world = setup_world(2000);
    let ix = ix_create_event(&world.organizer.pubkey(), 1, world.jurisdiction_registry, 1_900_000_000, 10_000);
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer]).unwrap();
    let (event_addr, _) = event_pda(&world.organizer.pubkey(), 1);

    let payment_mint_pubkey = world.payment_mint.pubkey();
    let (ix, addrs) = ix_create_seat_tier(
        &world.organizer.pubkey(),
        &event_addr,
        &world.jurisdiction_registry,
        &payment_mint_pubkey,
        "VIP",
        100_000_000,
        ResalePolicy::Unrestricted,
        10,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer])
        .expect("create seat tier A");

    let raw = world.svm.get_account(&addrs.seat_tier).unwrap();
    let seat_tier: ticketing_system::SeatTier =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(seat_tier.resale_policy, ResalePolicy::Capped { max_bps: 2000 });

    // Case B: organizer is stricter (Capped 500 bps) than the legal cap (2000 bps) ->
    // the organizer's policy wins.
    let mut world2 = setup_world(2000);
    let ix = ix_create_event(&world2.organizer.pubkey(), 1, world2.jurisdiction_registry, 1_900_000_000, 10_000);
    send(&mut world2.svm, &world2.payer, &[ix], &[&world2.organizer]).unwrap();
    let (event_addr2, _) = event_pda(&world2.organizer.pubkey(), 1);
    let payment_mint_pubkey2 = world2.payment_mint.pubkey();
    let (ix, addrs2) = ix_create_seat_tier(
        &world2.organizer.pubkey(),
        &event_addr2,
        &world2.jurisdiction_registry,
        &payment_mint_pubkey2,
        "VIP",
        100_000_000,
        ResalePolicy::Capped { max_bps: 500 },
        10,
    );
    send(&mut world2.svm, &world2.payer, &[ix], &[&world2.organizer])
        .expect("create seat tier B");

    let raw2 = world2.svm.get_account(&addrs2.seat_tier).unwrap();
    let seat_tier2: ticketing_system::SeatTier =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw2.data.as_slice()).unwrap();
    assert_eq!(seat_tier2.resale_policy, ResalePolicy::Capped { max_bps: 500 });
}

/// Sets up event -> seat_tier (2000 bps cap) -> one seat, ready for buy_seat tests.
fn setup_seat_tier_and_seat(
    world: &mut World,
    face_value: u64,
) -> (anchor_lang::prelude::Pubkey, SeatTierAddrs, anchor_lang::prelude::Pubkey) {
    let ix = ix_create_event(&world.organizer.pubkey(), 1, world.jurisdiction_registry, 1_900_000_000, 10_000);
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer]).unwrap();
    let (event_addr, _) = event_pda(&world.organizer.pubkey(), 1);

    let payment_mint_pubkey = world.payment_mint.pubkey();
    let (ix, tier_addrs) = ix_create_seat_tier(
        &world.organizer.pubkey(),
        &event_addr,
        &world.jurisdiction_registry,
        &payment_mint_pubkey,
        "VIP",
        face_value,
        ResalePolicy::Capped { max_bps: 2000 },
        10,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer])
        .expect("create seat tier");

    let (ix, seat_addr) = ix_create_seat(
        &world.organizer.pubkey(),
        &event_addr,
        &tier_addrs.seat_tier,
        "3A15",
        "Section 3, Row A, Seat 15",
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer])
        .expect("create seat");

    (event_addr, tier_addrs, seat_addr)
}

#[test]
fn test_create_seat_defaults_to_available() {
    let mut world = setup_world(2000);
    let (_, _, seat_addr) = setup_seat_tier_and_seat(&mut world, 100_000_000);

    let raw = world.svm.get_account(&seat_addr).unwrap();
    let seat: ticketing_system::Seat =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(seat.status, ticketing_system::SeatStatus::Available);
}

#[test]
fn test_buy_seat_transfers_payment_and_mints_frozen_ticket() {
    let face_value = 100_000_000u64; // 100 USDC
    let mut world = setup_world(2000);
    let (event_addr, tier_addrs, seat_addr) = setup_seat_tier_and_seat(&mut world, face_value);

    let customer = Keypair::new();
    fund(&mut world.svm, &customer.pubkey());
    let customer_payment_ata = fund_usdc(&mut world, &customer.pubkey(), 500_000_000);

    let (ix, buy_addrs) = ix_buy_seat(
        &customer.pubkey(),
        &event_addr,
        &world.organizer.pubkey(),
        &tier_addrs.seat_tier,
        &seat_addr,
        &tier_addrs.ticket_mint,
        &world.payment_mint.pubkey(),
        &customer_payment_ata,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&customer])
        .expect("buy seat");

    // Payment moved from customer to organizer.
    let customer_payment = read_token_account(&world.svm, &customer_payment_ata);
    assert_eq!(customer_payment.amount, 500_000_000 - face_value);
    let organizer_payment = read_token_account(&world.svm, &buy_addrs.organizer_payment_ata);
    assert_eq!(organizer_payment.amount, face_value);

    // Ticket minted with amount=1 and rests Frozen.
    let ticket = read_token_account(&world.svm, &buy_addrs.customer_ticket_ata);
    assert_eq!(ticket.amount, 1);
    assert_eq!(ticket.state, AccountState::Frozen);

    // Seat updated.
    let raw = world.svm.get_account(&seat_addr).unwrap();
    let seat: ticketing_system::Seat =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(seat.status, ticketing_system::SeatStatus::Sold);
    assert_eq!(seat.owner, customer.pubkey());
    assert_eq!(seat.token_account, buy_addrs.customer_ticket_ata);
}

#[test]
fn test_buy_seat_fails_when_seat_already_sold() {
    let face_value = 100_000_000u64;
    let mut world = setup_world(2000);
    let (event_addr, tier_addrs, seat_addr) = setup_seat_tier_and_seat(&mut world, face_value);

    let customer1 = Keypair::new();
    fund(&mut world.svm, &customer1.pubkey());
    let ata1 = fund_usdc(&mut world, &customer1.pubkey(), 500_000_000);
    let (ix, _) = ix_buy_seat(
        &customer1.pubkey(),
        &event_addr,
        &world.organizer.pubkey(),
        &tier_addrs.seat_tier,
        &seat_addr,
        &tier_addrs.ticket_mint,
        &world.payment_mint.pubkey(),
        &ata1,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&customer1]).unwrap();

    let customer2 = Keypair::new();
    fund(&mut world.svm, &customer2.pubkey());
    let ata2 = fund_usdc(&mut world, &customer2.pubkey(), 500_000_000);
    let (ix, _) = ix_buy_seat(
        &customer2.pubkey(),
        &event_addr,
        &world.organizer.pubkey(),
        &tier_addrs.seat_tier,
        &seat_addr,
        &tier_addrs.ticket_mint,
        &world.payment_mint.pubkey(),
        &ata2,
    );
    let result = send(&mut world.svm, &world.payer, &[ix], &[&customer2]);
    assert!(result.is_err(), "buying an already-sold seat must fail");
}

/// Buys the seat for `customer` and returns their ticket ATA.
fn buy_seat_for(
    world: &mut World,
    event_addr: &anchor_lang::prelude::Pubkey,
    tier_addrs: &SeatTierAddrs,
    seat_addr: &anchor_lang::prelude::Pubkey,
    customer: &Keypair,
    face_value: u64,
) -> anchor_lang::prelude::Pubkey {
    fund(&mut world.svm, &customer.pubkey());
    let customer_payment_ata = fund_usdc(world, &customer.pubkey(), face_value * 3);
    let (ix, buy_addrs) = ix_buy_seat(
        &customer.pubkey(),
        event_addr,
        &world.organizer.pubkey(),
        &tier_addrs.seat_tier,
        seat_addr,
        &tier_addrs.ticket_mint,
        &world.payment_mint.pubkey(),
        &customer_payment_ata,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&customer])
        .expect("buy seat");
    buy_addrs.customer_ticket_ata
}

#[test]
fn test_join_queue_escrows_funds_within_cap() {
    let face_value = 100_000_000u64; // cap @ 2000 bps markup = 120_000_000
    let mut world = setup_world(2000);
    let (_, tier_addrs, _) = setup_seat_tier_and_seat(&mut world, face_value);

    let buyer = Keypair::new();
    fund(&mut world.svm, &buyer.pubkey());
    let buyer_ata = fund_usdc(&mut world, &buyer.pubkey(), 200_000_000);

    let bid_amount = 120_000_000u64; // exactly at cap (face_value + 20%)
    let ix = ix_join_queue(
        &buyer.pubkey(),
        &tier_addrs.seat_tier,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &world.payment_mint.pubkey(),
        &buyer_ata,
        bid_amount,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&buyer])
        .expect("join queue within cap");

    let vault = read_token_account(&world.svm, &tier_addrs.bid_queue_vault);
    assert_eq!(vault.amount, bid_amount);
    let buyer_after = read_token_account(&world.svm, &buyer_ata);
    assert_eq!(buyer_after.amount, 200_000_000 - bid_amount);

    let raw = world.svm.get_account(&tier_addrs.bid_queue).unwrap();
    let bid_queue: ticketing_system::BidQueue =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(bid_queue.count, 1);
    assert_eq!(bid_queue.bids[0].buyer, buyer.pubkey());
    assert_eq!(bid_queue.bids[0].amount, bid_amount);
}

#[test]
fn test_join_queue_fails_when_bid_exceeds_cap() {
    let face_value = 100_000_000u64; // cap @ 2000 bps markup = 120_000_000
    let mut world = setup_world(2000);
    let (_, tier_addrs, _) = setup_seat_tier_and_seat(&mut world, face_value);

    let buyer = Keypair::new();
    fund(&mut world.svm, &buyer.pubkey());
    let buyer_ata = fund_usdc(&mut world, &buyer.pubkey(), 200_000_000);

    let ix = ix_join_queue(
        &buyer.pubkey(),
        &tier_addrs.seat_tier,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &world.payment_mint.pubkey(),
        &buyer_ata,
        120_000_001, // one base unit over the cap
    );
    let result = send(&mut world.svm, &world.payer, &[ix], &[&buyer]);
    assert!(result.is_err(), "bid above the resale cap must be rejected");
}

#[test]
fn test_join_queue_fails_when_bid_below_face_value() {
    let face_value = 100_000_000u64;
    let mut world = setup_world(2000);
    let (_, tier_addrs, _) = setup_seat_tier_and_seat(&mut world, face_value);

    let buyer = Keypair::new();
    fund(&mut world.svm, &buyer.pubkey());
    let buyer_ata = fund_usdc(&mut world, &buyer.pubkey(), 200_000_000);

    let ix = ix_join_queue(
        &buyer.pubkey(),
        &tier_addrs.seat_tier,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &world.payment_mint.pubkey(),
        &buyer_ata,
        face_value - 1, // one base unit under face value
    );
    let result = send(&mut world.svm, &world.payer, &[ix], &[&buyer]);
    assert!(result.is_err(), "bid below face value must be rejected");
}

/// Verifies cap = face_value * (10_000 + max_bps) / 10_000 (a markup over face
/// value) rather than face_value * max_bps / 10_000 (a fraction of it), using
/// a different bps than the other tests to pin down the formula itself.
#[test]
fn test_join_queue_cap_is_face_value_plus_markup_percentage() {
    let face_value = 100_000_000u64;
    // setup_seat_tier_and_seat always requests an organizer policy of Capped
    // 2000 bps; a 500 bps legal cap here makes more_restrictive() pick the
    // (stricter) 500 bps, giving cap = 100_000_000 * 10_500 / 10_000 = 105_000_000.
    let mut world = setup_world(500);
    let (_, tier_addrs, _) = setup_seat_tier_and_seat(&mut world, face_value);

    let within = Keypair::new();
    fund(&mut world.svm, &within.pubkey());
    let within_ata = fund_usdc(&mut world, &within.pubkey(), 200_000_000);
    let ix = ix_join_queue(
        &within.pubkey(),
        &tier_addrs.seat_tier,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &world.payment_mint.pubkey(),
        &within_ata,
        105_000_000, // face_value + 5%, exactly at cap
    );
    send(&mut world.svm, &world.payer, &[ix], &[&within])
        .expect("bid exactly at the markup cap must succeed");

    let over = Keypair::new();
    fund(&mut world.svm, &over.pubkey());
    let over_ata = fund_usdc(&mut world, &over.pubkey(), 200_000_000);
    let ix = ix_join_queue(
        &over.pubkey(),
        &tier_addrs.seat_tier,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &world.payment_mint.pubkey(),
        &over_ata,
        105_000_001, // one base unit over the markup cap
    );
    let result = send(&mut world.svm, &world.payer, &[ix], &[&over]);
    assert!(result.is_err(), "bid one unit over the markup cap must be rejected");
}

/// Verifies bids are inserted in price-time priority order: higher amount
/// ranks first, and among equal amounts the earlier registrant stays ahead.
#[test]
fn test_join_queue_orders_by_price_then_time_priority() {
    let face_value = 100_000_000u64; // cap @ 2000 bps markup = 120_000_000
    let mut world = setup_world(2000);
    let (_, tier_addrs, _) = setup_seat_tier_and_seat(&mut world, face_value);

    let join = |world: &mut World, amount: u64| -> anchor_lang::prelude::Pubkey {
        let buyer = Keypair::new();
        fund(&mut world.svm, &buyer.pubkey());
        let buyer_ata = fund_usdc(world, &buyer.pubkey(), 200_000_000);
        let ix = ix_join_queue(
            &buyer.pubkey(),
            &tier_addrs.seat_tier,
            &tier_addrs.bid_queue,
            &tier_addrs.bid_queue_vault,
            &world.payment_mint.pubkey(),
            &buyer_ata,
            amount,
        );
        send(&mut world.svm, &world.payer, &[ix], &[&buyer]).expect("join queue");
        buyer.pubkey()
    };

    // Join order: A(110) -> B(100) -> C(115) -> D(110, ties A).
    let buyer_a = join(&mut world, 110_000_000);
    let buyer_b = join(&mut world, 100_000_000);
    let buyer_c = join(&mut world, 115_000_000);
    let buyer_d = join(&mut world, 110_000_000);

    let raw = world.svm.get_account(&tier_addrs.bid_queue).unwrap();
    let bid_queue: ticketing_system::BidQueue =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(bid_queue.count, 4);

    // Expected: C(115) first (highest amount); then A(110) before D(110)
    // (same amount, A registered earlier); B(100) last.
    let ordered = [
        (buyer_c, 115_000_000u64),
        (buyer_a, 110_000_000u64),
        (buyer_d, 110_000_000u64),
        (buyer_b, 100_000_000u64),
    ];
    for (i, (expected_buyer, expected_amount)) in ordered.iter().enumerate() {
        assert_eq!(bid_queue.bids[i].buyer, *expected_buyer, "position {i} buyer");
        assert_eq!(bid_queue.bids[i].amount, *expected_amount, "position {i} amount");
    }
}

#[test]
fn test_join_queue_fails_when_queue_full() {
    let face_value = 100_000_000u64; // cap @ 2000 bps markup = 120_000_000
    let mut world = setup_world(10_000);
    let (_, tier_addrs, _) = setup_seat_tier_and_seat(&mut world, face_value);

    // MAX_QUEUE_LEN is 20; fill it up, each bidding exactly face_value (the
    // lower bound) so every join is unambiguously within [face_value, cap].
    for _ in 0..20 {
        let buyer = Keypair::new();
        fund(&mut world.svm, &buyer.pubkey());
        let buyer_ata = fund_usdc(&mut world, &buyer.pubkey(), 150_000_000);
        let ix = ix_join_queue(
            &buyer.pubkey(),
            &tier_addrs.seat_tier,
            &tier_addrs.bid_queue,
            &tier_addrs.bid_queue_vault,
            &world.payment_mint.pubkey(),
            &buyer_ata,
            face_value,
        );
        send(&mut world.svm, &world.payer, &[ix], &[&buyer])
            .expect("join queue slot should succeed while queue has room");
    }

    let one_too_many = Keypair::new();
    fund(&mut world.svm, &one_too_many.pubkey());
    let ata_extra = fund_usdc(&mut world, &one_too_many.pubkey(), 150_000_000);
    let ix = ix_join_queue(
        &one_too_many.pubkey(),
        &tier_addrs.seat_tier,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &world.payment_mint.pubkey(),
        &ata_extra,
        face_value,
    );
    let result = send(&mut world.svm, &world.payer, &[ix], &[&one_too_many]);
    assert!(result.is_err(), "joining a full queue must fail");
}

#[test]
fn test_execute_resale_matches_front_of_queue_and_refreezes_both_accounts() {
    let face_value = 100_000_000u64; // cap @ 2000 bps markup = 120_000_000
    let mut world = setup_world(2000);
    let (event_addr, tier_addrs, seat_addr) = setup_seat_tier_and_seat(&mut world, face_value);

    let seller = Keypair::new();
    let seller_ticket_ata =
        buy_seat_for(&mut world, &event_addr, &tier_addrs, &seat_addr, &seller, face_value);

    // buyer1 joins first with the lower bid; buyer2 joins second with a
    // higher bid. Price-time priority means buyer2 outranks buyer1 despite
    // joining later, so buyer2 sits at the front of the queue.
    let buyer1 = Keypair::new();
    fund(&mut world.svm, &buyer1.pubkey());
    let buyer1_ata = fund_usdc(&mut world, &buyer1.pubkey(), 200_000_000);
    let ix = ix_join_queue(
        &buyer1.pubkey(),
        &tier_addrs.seat_tier,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &world.payment_mint.pubkey(),
        &buyer1_ata,
        105_000_000,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&buyer1]).unwrap();

    let buyer2 = Keypair::new();
    fund(&mut world.svm, &buyer2.pubkey());
    let buyer2_ata = fund_usdc(&mut world, &buyer2.pubkey(), 200_000_000);
    let ix = ix_join_queue(
        &buyer2.pubkey(),
        &tier_addrs.seat_tier,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &world.payment_mint.pubkey(),
        &buyer2_ata,
        115_000_000,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&buyer2]).unwrap();

    let raw = world.svm.get_account(&tier_addrs.bid_queue).unwrap();
    let bid_queue_before: ticketing_system::BidQueue =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(bid_queue_before.count, 2);
    assert_eq!(bid_queue_before.bids[0].buyer, buyer2.pubkey());
    assert_eq!(bid_queue_before.bids[0].amount, 115_000_000);
    assert_eq!(bid_queue_before.bids[1].buyer, buyer1.pubkey());
    assert_eq!(bid_queue_before.bids[1].amount, 105_000_000);

    let (ix, resale_addrs) = ix_execute_resale(
        &seller.pubkey(),
        &buyer2.pubkey(),
        &tier_addrs.seat_tier,
        &seat_addr,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &tier_addrs.ticket_mint,
        &world.payment_mint.pubkey(),
        &seller_ticket_ata,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&seller])
        .expect("execute resale against queue front");

    // Seller got paid 115_000_000 (buyer2's higher, front-of-queue bid), not
    // buyer1's, on top of the face_value*3 - face_value leftover from
    // buy_seat_for's own initial purchase.
    let seller_payment = read_token_account(&world.svm, &resale_addrs.seller_payment_ata);
    assert_eq!(seller_payment.amount, (face_value * 3 - face_value) + 115_000_000);

    // Ticket moved to buyer2 and both accounts are frozen again.
    let seller_ticket = read_token_account(&world.svm, &seller_ticket_ata);
    assert_eq!(seller_ticket.amount, 0);
    assert_eq!(seller_ticket.state, AccountState::Frozen);
    let buyer2_ticket = read_token_account(&world.svm, &resale_addrs.buyer_ticket_ata);
    assert_eq!(buyer2_ticket.amount, 1);
    assert_eq!(buyer2_ticket.state, AccountState::Frozen);

    // Seat ownership transferred.
    let raw = world.svm.get_account(&seat_addr).unwrap();
    let seat: ticketing_system::Seat =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(seat.owner, buyer2.pubkey());
    assert_eq!(seat.token_account, resale_addrs.buyer_ticket_ata);

    // Queue advanced: buyer1 is now the sole entry at the front.
    let raw = world.svm.get_account(&tier_addrs.bid_queue).unwrap();
    let bid_queue: ticketing_system::BidQueue =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(bid_queue.count, 1);
    assert_eq!(bid_queue.bids[0].buyer, buyer1.pubkey());
    assert_eq!(bid_queue.bids[0].amount, 105_000_000);
}

#[test]
fn test_execute_resale_fails_when_queue_empty() {
    let face_value = 100_000_000u64;
    let mut world = setup_world(2000);
    let (event_addr, tier_addrs, seat_addr) = setup_seat_tier_and_seat(&mut world, face_value);

    let seller = Keypair::new();
    let seller_ticket_ata =
        buy_seat_for(&mut world, &event_addr, &tier_addrs, &seat_addr, &seller, face_value);

    let phantom_buyer = Keypair::new();
    let (ix, _) = ix_execute_resale(
        &seller.pubkey(),
        &phantom_buyer.pubkey(),
        &tier_addrs.seat_tier,
        &seat_addr,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &tier_addrs.ticket_mint,
        &world.payment_mint.pubkey(),
        &seller_ticket_ata,
    );
    let result = send(&mut world.svm, &world.payer, &[ix], &[&seller]);
    assert!(result.is_err(), "executing a resale against an empty queue must fail");
}

#[test]
fn test_leave_queue_refunds_and_removes_entry() {
    let face_value = 100_000_000u64;
    let mut world = setup_world(2000);
    let (_, tier_addrs, _) = setup_seat_tier_and_seat(&mut world, face_value);

    let buyer = Keypair::new();
    fund(&mut world.svm, &buyer.pubkey());
    let buyer_ata = fund_usdc(&mut world, &buyer.pubkey(), 200_000_000);
    let ix = ix_join_queue(
        &buyer.pubkey(),
        &tier_addrs.seat_tier,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &world.payment_mint.pubkey(),
        &buyer_ata,
        110_000_000,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&buyer]).unwrap();

    let ix = ix_leave_queue(
        &buyer.pubkey(),
        &tier_addrs.seat_tier,
        &tier_addrs.bid_queue,
        &tier_addrs.bid_queue_vault,
        &world.payment_mint.pubkey(),
        &buyer_ata,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&buyer])
        .expect("leave queue");

    let buyer_after = read_token_account(&world.svm, &buyer_ata);
    assert_eq!(buyer_after.amount, 200_000_000);

    let raw = world.svm.get_account(&tier_addrs.bid_queue).unwrap();
    let bid_queue: ticketing_system::BidQueue =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(bid_queue.count, 0);
}

#[test]
fn test_refund_ticket_before_deadline_succeeds_and_after_deadline_fails() {
    let face_value = 100_000_000u64;
    let mut world = setup_world(2000);

    let ix = ix_create_event(
        &world.organizer.pubkey(),
        1,
        world.jurisdiction_registry,
        1_900_000_000, // far future deadline
        10_000,        // 100% refund
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer]).unwrap();
    let (event_addr, _) = event_pda(&world.organizer.pubkey(), 1);

    let payment_mint_pubkey = world.payment_mint.pubkey();
    let (ix, tier_addrs) = ix_create_seat_tier(
        &world.organizer.pubkey(),
        &event_addr,
        &world.jurisdiction_registry,
        &payment_mint_pubkey,
        "VIP",
        face_value,
        ResalePolicy::Capped { max_bps: 2000 },
        10,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer]).unwrap();

    let (ix, seat_addr) = ix_create_seat(
        &world.organizer.pubkey(),
        &event_addr,
        &tier_addrs.seat_tier,
        "3A15",
        "Section 3, Row A, Seat 15",
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer]).unwrap();

    let customer = Keypair::new();
    let customer_ticket_ata =
        buy_seat_for(&mut world, &event_addr, &tier_addrs, &seat_addr, &customer, face_value);
    let _ = customer_ticket_ata;

    let customer_payment_ata = ata(&customer.pubkey(), &payment_mint_pubkey);
    let organizer_payment_ata = ata(&world.organizer.pubkey(), &payment_mint_pubkey);

    let ix = ix_refund_ticket(
        &world.organizer.pubkey(),
        &event_addr,
        &tier_addrs.seat_tier,
        &seat_addr,
        &payment_mint_pubkey,
        &customer.pubkey(),
        &organizer_payment_ata,
        &customer_payment_ata,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer])
        .expect("refund before deadline should succeed");

    let customer_payment = read_token_account(&world.svm, &customer_payment_ata);
    assert_eq!(customer_payment.amount, face_value * 3); // started with 3x face_value, got 100% refund back on top

    let raw = world.svm.get_account(&seat_addr).unwrap();
    let seat: ticketing_system::Seat =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(seat.status, ticketing_system::SeatStatus::Refunded);

    // Refunding again (now InvalidSeatStatus since it's no longer Sold) must fail.
    let ix = ix_refund_ticket(
        &world.organizer.pubkey(),
        &event_addr,
        &tier_addrs.seat_tier,
        &seat_addr,
        &payment_mint_pubkey,
        &customer.pubkey(),
        &organizer_payment_ata,
        &customer_payment_ata,
    );
    let result = send(&mut world.svm, &world.payer, &[ix], &[&world.organizer]);
    assert!(result.is_err(), "refunding a non-Sold seat must fail");
}

#[test]
fn test_refund_ticket_fails_after_deadline() {
    let face_value = 100_000_000u64;
    let mut world = setup_world(2000);

    let ix = ix_create_event(
        &world.organizer.pubkey(),
        1,
        world.jurisdiction_registry,
        1_000, // deadline
        10_000,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer]).unwrap();
    let (event_addr, _) = event_pda(&world.organizer.pubkey(), 1);

    let payment_mint_pubkey = world.payment_mint.pubkey();
    let (ix, tier_addrs) = ix_create_seat_tier(
        &world.organizer.pubkey(),
        &event_addr,
        &world.jurisdiction_registry,
        &payment_mint_pubkey,
        "VIP",
        face_value,
        ResalePolicy::Capped { max_bps: 2000 },
        10,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer]).unwrap();

    let (ix, seat_addr) = ix_create_seat(
        &world.organizer.pubkey(),
        &event_addr,
        &tier_addrs.seat_tier,
        "3A15",
        "Section 3, Row A, Seat 15",
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer]).unwrap();

    let customer = Keypair::new();
    buy_seat_for(&mut world, &event_addr, &tier_addrs, &seat_addr, &customer, face_value);

    // Advance the VM clock past the refund deadline (LiteSVM's default clock starts at
    // unix_timestamp 0, which is always before any deadline we'd set).
    let mut clock = world.svm.get_sysvar::<anchor_lang::prelude::Clock>();
    clock.unix_timestamp = 2_000;
    world.svm.set_sysvar(&clock);

    let customer_payment_ata = ata(&customer.pubkey(), &payment_mint_pubkey);
    let organizer_payment_ata = ata(&world.organizer.pubkey(), &payment_mint_pubkey);

    let ix = ix_refund_ticket(
        &world.organizer.pubkey(),
        &event_addr,
        &tier_addrs.seat_tier,
        &seat_addr,
        &payment_mint_pubkey,
        &customer.pubkey(),
        &organizer_payment_ata,
        &customer_payment_ata,
    );
    let result = send(&mut world.svm, &world.payer, &[ix], &[&world.organizer]);
    assert!(result.is_err(), "refund after the deadline must fail");
}

#[test]
fn test_check_in_succeeds_once_and_rejects_duplicate() {
    let face_value = 100_000_000u64;
    let mut world = setup_world(2000);
    let (event_addr, tier_addrs, seat_addr) = setup_seat_tier_and_seat(&mut world, face_value);

    let customer = Keypair::new();
    let customer_ticket_ata =
        buy_seat_for(&mut world, &event_addr, &tier_addrs, &seat_addr, &customer, face_value);

    let ix = ix_check_in(
        &world.organizer.pubkey(),
        &event_addr,
        &tier_addrs.seat_tier,
        &seat_addr,
        &customer_ticket_ata,
    );
    send(&mut world.svm, &world.payer, &[ix], &[&world.organizer])
        .expect("first check-in should succeed");

    let raw = world.svm.get_account(&seat_addr).unwrap();
    let seat: ticketing_system::Seat =
        anchor_lang::AccountDeserialize::try_deserialize(&mut raw.data.as_slice()).unwrap();
    assert_eq!(seat.status, ticketing_system::SeatStatus::CheckedIn);

    let ix = ix_check_in(
        &world.organizer.pubkey(),
        &event_addr,
        &tier_addrs.seat_tier,
        &seat_addr,
        &customer_ticket_ata,
    );
    let result = send(&mut world.svm, &world.payer, &[ix], &[&world.organizer]);
    assert!(result.is_err(), "checking in twice must fail");
}
