-- 0027_service_pre_request.sql — PostgREST's pre-request runs for every role it serves, the service role included
-- (0021; D-56).
--
-- PostgREST calls `app.pre_request()` before every request, as the request's role. 0021 granted it to anon and
-- authenticated only, so every request the service role made through the Data API failed with 42501 before it
-- reached its function: the dispatcher's `dispatch_authorised` and claims (0022, 0025) among them. It was found
-- when the dispatcher was first deployed; the local flows drive the dispatcher's loop over psql, not the API.
-- The function returns at once for any role but authenticated, so the service role is counted against nothing.
grant execute on function app.pre_request() to service_role;
