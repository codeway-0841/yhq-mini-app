-- P2 backfill: eski jsonb massivlardan progress_questions jadvalini to'ldirish.
-- idempotent (ON CONFLICT DO NOTHING) — qayta yugurtirish xavfsiz.

-- 1) Barcha yechilgan savollar (solved_questions): correct = correct_questions'da bo'lsa true
INSERT INTO progress_questions (user_id, subject_id, question_id, correct)
SELECT p.user_id,
       split_part(s.k, ':', 1)          AS subject_id,
       split_part(s.k, ':', 2)::integer AS question_id,
       COALESCE(p.correct_questions, '[]'::jsonb) ? s.k AS correct
FROM progress p
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.solved_questions, '[]'::jsonb)) AS s(k)
WHERE position(':' IN s.k) > 0
ON CONFLICT (user_id, subject_id, question_id) DO NOTHING;
--> statement-breakpoint

-- 2) correct_questions'da bor, lekin solved_questions'da YO'Q qoldiq kalitlar (himoya)
INSERT INTO progress_questions (user_id, subject_id, question_id, correct)
SELECT p.user_id,
       split_part(c.k, ':', 1)          AS subject_id,
       split_part(c.k, ':', 2)::integer AS question_id,
       true
FROM progress p
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.correct_questions, '[]'::jsonb)) AS c(k)
WHERE position(':' IN c.k) > 0
ON CONFLICT (user_id, subject_id, question_id) DO UPDATE SET correct = true;
