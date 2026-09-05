-- webhook_events: allow JVZoo as a processor.
--
-- The CHECK on processor only admitted fastspring/clickbank, so every JVZoo
-- IPN's event row was rejected (silently — the insert error was not read).
-- Effects until this runs: the JVZoo duplicate guard never matches (an IPN
-- retry re-runs provisioning), and bump/OTO/refund events are not recorded.
-- Found on the first JVZoo test purchase, 2026-09-05.
alter table public.webhook_events
  drop constraint if exists webhook_events_processor_check;
alter table public.webhook_events
  add constraint webhook_events_processor_check
  check (processor in ('fastspring', 'clickbank', 'jvzoo'));
