-- There is exactly one admin member; logging in with ADMIN_CODE always resolves to it.
CREATE UNIQUE INDEX members_single_admin_idx ON members (is_admin) WHERE is_admin;
