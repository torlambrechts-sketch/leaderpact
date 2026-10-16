-- 0030_trial_thirty_days.sql — the Team plan's trial lasts 30 days (owner, 16 October 2026; D-64).
--
-- The owner: "introduce a 30 day trial to the full system". The trial's length is the fixed setting row
-- `trial_days` (0013, owner D2a: 14 days); every reader takes it from there: start_trial, the trial's grace, the
-- Plan and billing page, Home and the fixture. A trial already running keeps the end it was given when it
-- started; the hosted project had none when this was written. Still once per group, still with no billing details.

update app.setting set default_value = '30' where key = 'trial_days';
