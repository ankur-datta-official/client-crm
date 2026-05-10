WITH latest_submitted_notifications AS (
  SELECT DISTINCT ON (lower((payload ->> 'email')))
    lower((payload ->> 'email')) AS email,
    created_at
  FROM public.notifications
  WHERE type = 'admin.access_request.submitted'
    AND payload ? 'email'
  ORDER BY lower((payload ->> 'email')), created_at DESC
),
affected_requests AS (
  SELECT sr.id
  FROM public.signup_requests sr
  INNER JOIN latest_submitted_notifications lsn
    ON lower(sr.email) = lsn.email
  WHERE abs(extract(epoch FROM (lsn.created_at - sr.requested_at))) BETWEEN 19800 AND 23400
)
UPDATE public.access_passkeys ap
SET
  created_at = ap.created_at + interval '6 hours',
  expires_at = ap.expires_at + interval '6 hours',
  used_at = CASE WHEN ap.used_at IS NULL THEN NULL ELSE ap.used_at + interval '6 hours' END
WHERE ap.signup_request_id IN (SELECT id FROM affected_requests);

WITH latest_submitted_notifications AS (
  SELECT DISTINCT ON (lower((payload ->> 'email')))
    lower((payload ->> 'email')) AS email,
    created_at
  FROM public.notifications
  WHERE type = 'admin.access_request.submitted'
    AND payload ? 'email'
  ORDER BY lower((payload ->> 'email')), created_at DESC
),
affected_requests AS (
  SELECT sr.id
  FROM public.signup_requests sr
  INNER JOIN latest_submitted_notifications lsn
    ON lower(sr.email) = lsn.email
  WHERE abs(extract(epoch FROM (lsn.created_at - sr.requested_at))) BETWEEN 19800 AND 23400
)
UPDATE public.signup_requests sr
SET
  requested_at = sr.requested_at + interval '6 hours',
  approved_at = CASE WHEN sr.approved_at IS NULL THEN NULL ELSE sr.approved_at + interval '6 hours' END,
  rejected_at = CASE WHEN sr.rejected_at IS NULL THEN NULL ELSE sr.rejected_at + interval '6 hours' END,
  completed_at = CASE WHEN sr.completed_at IS NULL THEN NULL ELSE sr.completed_at + interval '6 hours' END,
  last_passkey_issued_at = CASE WHEN sr.last_passkey_issued_at IS NULL THEN NULL ELSE sr.last_passkey_issued_at + interval '6 hours' END,
  created_at = sr.created_at + interval '6 hours',
  updated_at = sr.updated_at + interval '6 hours'
WHERE sr.id IN (SELECT id FROM affected_requests);
