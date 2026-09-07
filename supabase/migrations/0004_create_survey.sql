create or replace function public.create_survey(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := (payload->>'id')::uuid;
  v_photo jsonb;
  v_front int := 0;
  v_inner int := 0;
begin
  if v_id is null then
    raise exception 'payload.id is required';
  end if;

  insert into public.surveys (
    id, rep_id, shop_name, market, shop_size, customer_name, customer_number,
    gps_lat, gps_lng, gps_accuracy, most_selling_fan,
    rec_30w_1, rec_30w_2, rec_50w_1, rec_50w_2, audio_path
  ) values (
    v_id, auth.uid(),
    payload->>'shop_name', payload->>'market', payload->>'shop_size',
    payload->>'customer_name', payload->>'customer_number',
    (payload->>'gps_lat')::double precision,
    (payload->>'gps_lng')::double precision,
    nullif(payload->>'gps_accuracy', '')::double precision,
    payload->>'most_selling_fan',
    payload->>'rec_30w_1', nullif(payload->>'rec_30w_2', ''),
    payload->>'rec_50w_1', nullif(payload->>'rec_50w_2', ''),
    nullif(payload->>'audio_path', '')
  );

  for v_photo in select * from jsonb_array_elements(coalesce(payload->'photos', '[]'::jsonb))
  loop
    insert into public.survey_photos (survey_id, kind, storage_path, sort_order)
    values (v_id, v_photo->>'kind', v_photo->>'storage_path',
            coalesce((v_photo->>'sort_order')::int, 0));
    if v_photo->>'kind' = 'front' then v_front := v_front + 1;
    elsif v_photo->>'kind' = 'inner' then v_inner := v_inner + 1;
    end if;
  end loop;

  if v_front <> 1 then
    raise exception 'exactly one front photo required (got %)', v_front;
  end if;
  if v_inner < 1 or v_inner > 10 then
    raise exception 'between 1 and 10 inner photos required (got %)', v_inner;
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_survey(jsonb) from public, anon;
grant execute on function public.create_survey(jsonb) to authenticated;
