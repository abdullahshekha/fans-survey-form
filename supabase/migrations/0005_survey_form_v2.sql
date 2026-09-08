-- Survey Form v2: "Other" brand option + Quotation photo kind.

-- 1. Allow 'Other' in every brand CHECK (constraints are auto-named
--    surveys_<col>_check from 0001).
alter table public.surveys
  drop constraint surveys_most_selling_fan_check,
  add  constraint surveys_most_selling_fan_check check (most_selling_fan in (
    'Tamoor','Khurshid','SK','GFC','Royal','Pak Fans','Lahore Fans','Other'));
alter table public.surveys
  drop constraint surveys_rec_30w_1_check,
  add  constraint surveys_rec_30w_1_check check (rec_30w_1 in (
    'Tamoor','Khurshid','SK','GFC','Royal','Pak Fans','Lahore Fans','Other'));
alter table public.surveys
  drop constraint surveys_rec_30w_2_check,
  add  constraint surveys_rec_30w_2_check check (rec_30w_2 in (
    'Tamoor','Khurshid','SK','GFC','Royal','Pak Fans','Lahore Fans','Other'));
alter table public.surveys
  drop constraint surveys_rec_50w_1_check,
  add  constraint surveys_rec_50w_1_check check (rec_50w_1 in (
    'Tamoor','Khurshid','SK','GFC','Royal','Pak Fans','Lahore Fans','Other'));
alter table public.surveys
  drop constraint surveys_rec_50w_2_check,
  add  constraint surveys_rec_50w_2_check check (rec_50w_2 in (
    'Tamoor','Khurshid','SK','GFC','Royal','Pak Fans','Lahore Fans','Other'));

-- 2. Companion columns for the typed brand name (only meaningful when the
--    matching brand column = 'Other').
alter table public.surveys
  add column most_selling_fan_other text,
  add column rec_30w_1_other        text,
  add column rec_30w_2_other        text,
  add column rec_50w_1_other        text,
  add column rec_50w_2_other        text;

alter table public.surveys
  add constraint surveys_most_selling_fan_other_ck check (
    (most_selling_fan is distinct from 'Other' and most_selling_fan_other is null)
    or (most_selling_fan = 'Other' and most_selling_fan_other is not null
        and char_length(btrim(most_selling_fan_other)) between 1 and 40)),
  add constraint surveys_rec_30w_1_other_ck check (
    (rec_30w_1 is distinct from 'Other' and rec_30w_1_other is null)
    or (rec_30w_1 = 'Other' and rec_30w_1_other is not null
        and char_length(btrim(rec_30w_1_other)) between 1 and 40)),
  add constraint surveys_rec_30w_2_other_ck check (
    (rec_30w_2 is distinct from 'Other' and rec_30w_2_other is null)
    or (rec_30w_2 = 'Other' and rec_30w_2_other is not null
        and char_length(btrim(rec_30w_2_other)) between 1 and 40)),
  add constraint surveys_rec_50w_1_other_ck check (
    (rec_50w_1 is distinct from 'Other' and rec_50w_1_other is null)
    or (rec_50w_1 = 'Other' and rec_50w_1_other is not null
        and char_length(btrim(rec_50w_1_other)) between 1 and 40)),
  add constraint surveys_rec_50w_2_other_ck check (
    (rec_50w_2 is distinct from 'Other' and rec_50w_2_other is null)
    or (rec_50w_2 = 'Other' and rec_50w_2_other is not null
        and char_length(btrim(rec_50w_2_other)) between 1 and 40));

-- 3. Allow the 'quotation' photo kind.
alter table public.survey_photos
  drop constraint survey_photos_kind_check,
  add  constraint survey_photos_kind_check check (kind in ('front','inner','quotation'));

-- 4. Replace create_survey: write the 5 *_other values, count quotation photos
--    (0-2), and reject an 'Other' brand with no typed name.
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
  v_quotation int := 0;
begin
  if v_id is null then
    raise exception 'payload.id is required';
  end if;

  -- Every brand field set to 'Other' must carry a typed name.
  perform 1 from (values
    (payload->>'most_selling_fan', payload->>'most_selling_fan_other'),
    (payload->>'rec_30w_1',        payload->>'rec_30w_1_other'),
    (payload->>'rec_30w_2',        payload->>'rec_30w_2_other'),
    (payload->>'rec_50w_1',        payload->>'rec_50w_1_other'),
    (payload->>'rec_50w_2',        payload->>'rec_50w_2_other')
  ) as t(brand, other)
  where t.brand = 'Other' and coalesce(btrim(t.other), '') = '';
  if found then
    raise exception 'a brand was set to "Other" without a typed name';
  end if;

  insert into public.surveys (
    id, rep_id, shop_name, market, shop_size, customer_name, customer_number,
    gps_lat, gps_lng, gps_accuracy, most_selling_fan,
    rec_30w_1, rec_30w_2, rec_50w_1, rec_50w_2, audio_path,
    most_selling_fan_other, rec_30w_1_other, rec_30w_2_other, rec_50w_1_other, rec_50w_2_other
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
    nullif(payload->>'audio_path', ''),
    nullif(btrim(payload->>'most_selling_fan_other'), ''),
    nullif(btrim(payload->>'rec_30w_1_other'), ''),
    nullif(btrim(payload->>'rec_30w_2_other'), ''),
    nullif(btrim(payload->>'rec_50w_1_other'), ''),
    nullif(btrim(payload->>'rec_50w_2_other'), '')
  );

  for v_photo in select * from jsonb_array_elements(coalesce(payload->'photos', '[]'::jsonb))
  loop
    if (v_photo->>'storage_path') not like auth.uid()::text || '/%' then
      raise exception 'photo storage_path must be under the caller prefix';
    end if;
    insert into public.survey_photos (survey_id, kind, storage_path, sort_order)
    values (v_id, v_photo->>'kind', v_photo->>'storage_path',
            coalesce((v_photo->>'sort_order')::int, 0));
    if v_photo->>'kind' = 'front' then v_front := v_front + 1;
    elsif v_photo->>'kind' = 'inner' then v_inner := v_inner + 1;
    elsif v_photo->>'kind' = 'quotation' then v_quotation := v_quotation + 1;
    end if;
  end loop;

  if v_front <> 1 then
    raise exception 'exactly one front photo required (got %)', v_front;
  end if;
  if v_inner < 1 or v_inner > 10 then
    raise exception 'between 1 and 10 inner photos required (got %)', v_inner;
  end if;
  if v_quotation > 2 then
    raise exception 'at most 2 quotation photos (got %)', v_quotation;
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_survey(jsonb) from public, anon;
grant execute on function public.create_survey(jsonb) to authenticated;
