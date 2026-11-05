-- Run this in Supabase SQL Editor after admin_policies.sql

-- Add membership tier tracking to organizations
alter table organizations
  add column if not exists membership_tier text
    check (membership_tier in ('participant', 'collaborator', 'strategic', 'anchor'))
    default 'participant',
  add column if not exists payment_status text
    check (payment_status in ('unpaid', 'paid', 'exempt'))
    default 'exempt';

-- Free tier and anchor are always exempt from payment
-- Paid tiers (collaborator, strategic) start as 'unpaid' on approval and become 'paid' after Stripe confirms

-- Index for admin queries filtering by tier/payment status
create index if not exists idx_orgs_membership_tier on organizations(membership_tier);
create index if not exists idx_orgs_payment_status  on organizations(payment_status);
