export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  company_size: string | null;
  owner_user_id: string;
  role_name: string | null;
  role_slug: string | null;
  is_owner: boolean;
  is_active: boolean;
};

