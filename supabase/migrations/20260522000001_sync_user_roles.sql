-- 1. public.users의 role이 변경될 때 auth.users 메타데이터 동기화 트리거
CREATE OR REPLACE FUNCTION public.on_public_user_changed()
RETURNS TRIGGER AS $$
BEGIN
  -- public.users 테이블의 role이 변경되었을 때, auth.users의 raw_user_meta_data->'role'을 업데이트합니다.
  UPDATE auth.users
  SET raw_user_meta_data =
    coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_public_user_changed ON public.users;
CREATE TRIGGER tr_public_user_changed
AFTER INSERT OR UPDATE OF role ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.on_public_user_changed();

-- 2. auth.users 메타데이터 업데이트 시 public.users.role로 강제 동기화 (클라이언트 변조 방지)
CREATE OR REPLACE FUNCTION public.on_auth_user_updated_sync()
RETURNS TRIGGER AS $$
DECLARE
  public_role TEXT;
BEGIN
  -- public.users 테이블의 role을 조회합니다.
  SELECT role INTO public_role FROM public.users WHERE id = NEW.id;

  -- 만약 public.users에 사용자 레코드가 이미 존재하고, 입력된 metadata의 role이 public_role과 다르면
  -- public_role 값으로 강제 동기화시킵니다. (클라이언트 단의 위조 방지)
  IF public_role IS NOT NULL AND (NEW.raw_user_meta_data->>'role' IS NULL OR NEW.raw_user_meta_data->>'role' <> public_role) THEN
    NEW.raw_user_meta_data = coalesce(NEW.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', public_role);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auth_user_updated_sync ON auth.users;
CREATE TRIGGER tr_auth_user_updated_sync
BEFORE UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.on_auth_user_updated_sync();
