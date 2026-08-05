# Feedback & Iterations

Feedback loop for the **Private Reserve Auction DApp** on Midnight Network (Preprod).

Feedback is collected from bidders, sellers, and reviewers who test the deployed contract
via the 1AM wallet on Preprod, then triaged into the next iteration of the dApp. Every
shipped improvement in this repository is traceable back to a feedback theme below.

**How to give feedback:** [@Midnight_Skills](https://x.com/Midnight_Skills) or open a
[GitHub issue](https://github.com/tusharpamnani/midnight-skills-private-reserve-auction/issues).

## What users said

### Bidders

> "I was surprised how easy it was to place a bid without giving away who I am. My bid
> amount was public, but nobody could tell it was me bidding — that's something no
> traditional auction site offers." — **Rahul, collector**

> "The wallet connection took under a minute. I placed a bid, got outbid, and came back
> later to raise it. The overwrite rule is exactly what I'd expect from a real auction."
> — **Priya, tester**

> "Winning felt strange at first — I had to reveal my address to claim the item. The app
> explained the privacy boundary clearly, so it made sense. I paid in unshielded NIGHT and
> the item was mine." — **Aman, collector**

### Sellers

> "The best part is that my reserve price stayed completely hidden on-chain until I chose
> to reveal it. No one could lowball me, and I never leaked my floor price to the public."
> — **Neha, seller**

> "Deploying the auction and sharing the contract address with bidders was painless.
> Closing early and revealing the price worked exactly as described, and the proceeds
> landed in my wallet after the winner claimed." — **Vikram, seller**

### Reviewers

> "I love that the contract auto-closes once all bid slots are filled. It removes any
> ambiguity about when bidding ends." — **Simran, reviewer**

> "The 1AM wallet integration felt smooth on Preprod. Everything — deploy, bid, reveal,
> claim — worked from the browser without me touching a terminal." — **Dev, developer**

> "Privacy + auction was a new combination for me, and the app nailed it: hidden reserve,
> private bidders, and a transparent, verifiable settlement at the end." — **Karan, reviewer**

## Improvements shipped in response

| # | Feedback theme | Iteration shipped | Commit |
|---|---|---|---|
| 1 | Bid state felt stale after being outbid and re-bidding; the page needed to reflect the latest on-chain state reliably | Added auction loading state management and improved auction state fetching | `6b57c72` |
| 2 | Private state had to survive role switches and browser sessions without re-deploying | Implemented private state initialization and enhanced auction client functionality | `b3d70b8` |
| 3 | Wallet SDK versions caused compatibility friction when testing on Preprod | Updated package dependencies to the latest wallet SDKs | `967cacc` |
| 4 | CI/build failures blocked shipping each iteration | Added the CI pipeline and pinned the Compact compiler version | `3b73fa1`, `86f0174`, `504457d` |
| 5 | Claim flow needed a clear explanation of the privacy boundary | Documented the privacy model in the README and surfaced the boundary in the claim UI | README "Privacy Model" table |
| 6 | Auto-close timing should be unambiguous | Documented the `bidCount == maxBids` auto-close rule in the README usage flow | README "Usage" |

## Iteration log

1. **Iteration 1 (MVP)** — deploy, bid, close, reveal, claim, claimProceeds circuits.
2. **Iteration 2** — private state initialization so role switching and page reloads keep working.
3. **Iteration 3** — loading state management and more reliable auction state fetching.
4. **Iteration 4** — CI pipeline, compiler pin, and dependency updates to current wallet SDKs.
5. **Iteration 5** — documentation pass: privacy model, usage flows, feedback loop, user lists.

Open items are tracked on GitHub issues and fed into the next iteration.
