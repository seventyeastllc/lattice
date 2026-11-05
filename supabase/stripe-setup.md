# Stripe Setup for Lattice

Follow these steps once. Takes about 15 minutes.

---

## 1. Create a Stripe account

Go to https://stripe.com and sign up. Use your business email.
Complete identity verification before going live.

---

## 2. Create two products

In Stripe dashboard → **Product catalog** → **+ Add product**

### Network Collaborator
- Name: `Network Collaborator`
- Description: `Priority Routing — structured referral pathway integration`
- Pricing: **Recurring** · $49.00 · per month
- Save → copy the **Price ID** (looks like `price_1AbcXyz...`)

### Strategic Partner
- Name: `Strategic Partner`
- Description: `Escalation & Alignment — full strategic coordination access`
- Pricing: **Recurring** · $149.00 · per month
- Save → copy the **Price ID**

---

## 3. Create Payment Links

In Stripe dashboard → **Payment Links** → **+ New**

For each product:
1. Select the product
2. Set quantity: 1, allow customers to adjust: off
3. Add a confirmation message: "Thank you — TSE will activate your account within one business day."
4. Click **Create link**
5. Copy the full URL (looks like `https://buy.stripe.com/...`)

---

## 4. Add env vars to your project

Create or edit `/Users/workplace/lattice/.env.local`:

```
VITE_STRIPE_LINK_COLLABORATOR=https://buy.stripe.com/YOUR_COLLABORATOR_LINK
VITE_STRIPE_LINK_STRATEGIC=https://buy.stripe.com/YOUR_STRATEGIC_LINK
```

Replace the placeholder URLs with the actual links from step 3.
Restart `npm run dev` after saving.

---

## 5. Verify it works

1. Sign in as admin → go to Admin Panel
2. Find an approved Collaborator or Strategic Partner application
3. Expand the card — you should see a yellow "Payment pending" banner
4. Click **Copy Payment Link** — the Stripe checkout URL copies to your clipboard
5. Email or text the link to the applicant
6. After they pay, click **Mark as Paid** (or set up a webhook to do it automatically — see below)

---

## Optional: Webhook for automatic payment confirmation

This lets Stripe automatically mark an org as paid when checkout completes.
Requires a Supabase Edge Function. Save this for a later phase when you're ready.

Summary of what's needed:
- Supabase Edge Function: `/supabase/functions/stripe-webhook/index.ts`
- Listens for `checkout.session.completed` event
- Looks up org by Stripe customer email, sets `payment_status = 'paid'`
- Add the webhook signing secret as a Supabase secret

Ask Ravonda when ready to implement this step.

---

## Test mode vs. live mode

Stripe starts in **test mode**. Use test mode during development — payments won't charge real cards.
Switch to **live mode** in the Stripe dashboard toggle (top left) when ready to accept real payments.
You'll need to create separate Payment Links in live mode.
