-- Spam → Lead Gen Pipeline. Run once in Supabase dashboard → SQL editor.

create table if not exists emails (
  gmail_id text primary key,
  thread_id text,
  from_name text,
  from_email text,
  from_domain text,
  subject text,
  snippet text,
  body_text text,
  auth_results jsonb,       -- parsed Authentication-Results: {raw, spf, dkim, dmarc}
  classification jsonb,     -- Jev output: segment/business_type/legit + probabilities
  received_at timestamptz,
  ingested_at timestamptz default now()
);

create table if not exists senders (
  domain text primary key,
  company_name text,
  segment text,
  business_type text,
  business_type_prob numeric,
  legit_prob numeric,
  qualified boolean default false,
  evidence_gmail_id text references emails(gmail_id),
  email_count int,
  audit jsonb,              -- DNS/auth findings for the free-audit pitch
  enrichment jsonb,         -- GetLeads decision-maker + firmographics
  updated_at timestamptz default now()
);

create table if not exists drafts (
  id bigint generated always as identity primary key,
  domain text references senders(domain),
  contact_email text,
  contact_name text,
  subject text,
  body text,
  status text not null default 'draft',  -- draft / approved / sent
  created_at timestamptz default now()
);
