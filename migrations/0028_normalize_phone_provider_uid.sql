-- C3 data heal: bot contact login oqimi telefon identity'larni '+'
-- SIZ (digits-only) yozgan; qolgan barcha oqimlar E.164 ('+998...') ishlatadi.
-- Konfliktsiz qatorlarni normalize qilamiz (takroriy juftliklar qolsa — qo'lda merge).
UPDATE auth_identities a
SET provider_uid = '+' || a.provider_uid
WHERE a.provider = 'phone'
  AND a.provider_uid NOT LIKE '+%'
  AND NOT EXISTS (
    SELECT 1 FROM auth_identities b
    WHERE b.provider = 'phone'
      AND b.provider_uid = '+' || a.provider_uid
  );
