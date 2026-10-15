-- ID lokal yang stabil mencegah sesi dengan waktu mulai sama tertukar saat sinkronisasi.
alter table workouts add column if not exists source_session_id text;

create index if not exists workouts_source_session_id_idx
  on workouts (source_session_id);
