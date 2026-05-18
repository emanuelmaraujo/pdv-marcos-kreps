SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict GuoYXxPUpCq3Bdg0f3MuttnnNCKGqDqT8y3ePAU92OJHkvorowW2S5PUw9QjeR7

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '93359a93-2128-4b8f-b3c2-279e4712360d', 'authenticated', 'authenticated', 'emmanuellyagatha@gmail.com', '$2a$10$1bbrdaVpdITEl0jEGpeclOWyiGB3gn2l8TVICMD8p3/QeToz5S3cS', '2026-05-09 21:57:32.360085+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-05-09 21:59:35.491077+00', '{"provider": "email", "providers": ["email"]}', '{"name": "Emmanuely", "email_verified": true}', NULL, '2026-05-09 21:57:32.33829+00', '2026-05-11 02:08:51.245208+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', 'authenticated', 'authenticated', 'admin@marcoskreps.test', '$2a$06$J6DDy9Qy9Yh0d49PNgln2eZFRGlXVdOCNFtSvBiUMw6Y6rzrjoI32', '2026-05-04 16:39:16.545111+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-05-11 13:44:13.934724+00', '{"provider": "email", "providers": ["email"]}', '{}', NULL, '2026-05-04 16:39:16.545111+00', '2026-05-11 13:44:13.964643+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'c02c3824-379f-42b1-ac82-0b418478b4d6', 'authenticated', 'authenticated', 'ledamoura@yahoo.com.br', '$2a$10$4Sdaq1bGF4zLGyH3XmIPE.8GEc6D01D6AgTtBhFT5z4RtK1c5fIUC', '2026-05-09 01:00:16.884752+00', NULL, '', NULL, '', '2026-05-10 20:09:15.100795+00', '', '', NULL, '2026-05-10 20:09:15.346949+00', '{"provider": "email", "providers": ["email"]}', '{"name": "Leda Moura", "email_verified": true}', NULL, '2026-05-09 01:00:16.871233+00', '2026-05-13 05:09:07.657074+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'authenticated', 'authenticated', 'emanuel-morais@outlook.com', '$2a$10$WVsB5iMX/BLVgLTUjmI3Euf64lsvYxA7cdHZvnNLkpvmCmkjMYh4u', '2026-05-09 00:40:24.731081+00', NULL, '', NULL, '', '2026-05-16 01:07:17.452949+00', '', '', NULL, '2026-05-16 01:07:17.64385+00', '{"provider": "email", "providers": ["email"]}', '{"full_name": "Emanuel Morais", "email_verified": true}', NULL, '2026-05-09 00:40:24.715838+00', '2026-05-16 01:07:17.675733+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'c3ec7692-8947-419a-adff-78b187124575', 'authenticated', 'authenticated', 'melissamr.alves@gmail.com', '$2a$10$T5osHV9D3fXyewdIAmpNEOPc7mCx.BI1x/pFCkEI6e3UqMKpg580G', '2026-05-09 18:13:46.436746+00', NULL, '', NULL, '', '2026-05-10 20:02:57.123734+00', '', '', NULL, '2026-05-10 20:02:57.36101+00', '{"provider": "email", "providers": ["email"]}', '{"name": "Melissa Alves", "email_verified": true}', NULL, '2026-05-09 18:13:46.402765+00', '2026-05-15 23:52:15.753486+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', 'authenticated', 'authenticated', 'davimralves22092009@gmail.com', '$2a$10$TLCrwAWbqbJvzSCS98u9ueCbTiRt2WVIku52atY.09VvpcWgUz2kG', '2026-05-10 20:17:46.497243+00', NULL, '', NULL, '', '2026-05-10 20:22:34.550785+00', '', '', NULL, '2026-05-15 23:53:39.742559+00', '{"provider": "email", "providers": ["email"]}', '{"name": "Davi Moura", "email_verified": true}', NULL, '2026-05-10 20:17:46.474347+00', '2026-05-15 23:53:39.777646+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('b8b07c11-3b79-4f84-99d4-307db6d9b373', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '{"sub": "b8b07c11-3b79-4f84-99d4-307db6d9b373", "email": "admin@marcoskreps.test"}', 'email', '2026-05-04 16:39:16.545111+00', '2026-05-04 16:39:16.545111+00', '2026-05-04 16:39:16.545111+00', 'ed06c735-46a5-4862-9a94-3cb12ec9fbac'),
	('aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', '{"sub": "aa374e0e-f4a9-45b0-a18f-dce09d07ed47", "email": "emanuel-morais@outlook.com", "email_verified": false, "phone_verified": false}', 'email', '2026-05-09 00:40:24.725502+00', '2026-05-09 00:40:24.725556+00', '2026-05-09 00:40:24.725556+00', 'fa7bfbaa-deed-44cf-a728-a0b80ed6c817'),
	('c02c3824-379f-42b1-ac82-0b418478b4d6', 'c02c3824-379f-42b1-ac82-0b418478b4d6', '{"sub": "c02c3824-379f-42b1-ac82-0b418478b4d6", "email": "ledamoura@yahoo.com.br", "email_verified": false, "phone_verified": false}', 'email', '2026-05-09 01:00:16.880362+00', '2026-05-09 01:00:16.88042+00', '2026-05-09 01:00:16.88042+00', 'd1b5d63e-2472-4581-a2eb-c1376a5d23b9'),
	('c3ec7692-8947-419a-adff-78b187124575', 'c3ec7692-8947-419a-adff-78b187124575', '{"sub": "c3ec7692-8947-419a-adff-78b187124575", "email": "melissamr.alves@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-05-09 18:13:46.424917+00', '2026-05-09 18:13:46.42498+00', '2026-05-09 18:13:46.42498+00', '291e8ece-edda-4838-a8e3-8537d5540996'),
	('93359a93-2128-4b8f-b3c2-279e4712360d', '93359a93-2128-4b8f-b3c2-279e4712360d', '{"sub": "93359a93-2128-4b8f-b3c2-279e4712360d", "email": "emmanuellyagatha@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-05-09 21:57:32.354138+00', '2026-05-09 21:57:32.354212+00', '2026-05-09 21:57:32.354212+00', '87a68389-d960-4cfa-be53-f9bf564a81a6'),
	('6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', '{"sub": "6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e", "email": "davimralves22092009@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-05-10 20:17:46.488075+00', '2026-05-10 20:17:46.488133+00', '2026-05-10 20:17:46.488133+00', '7467810e-8361-4eae-a7bb-453e2399c0a2');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('f49c283d-30d1-44b0-bb09-03c79d6b959b', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-04 17:08:38.551751+00', '2026-05-04 17:08:38.551751+00', NULL, 'aal1', NULL, NULL, 'node', '201.57.45.210', NULL, NULL, NULL, NULL, NULL),
	('13e36a8b-9987-491c-ab8d-9b00e42c170d', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-04 17:10:00.373388+00', '2026-05-04 17:10:00.373388+00', NULL, 'aal1', NULL, NULL, 'node', '201.57.45.210', NULL, NULL, NULL, NULL, NULL),
	('5ced8aee-9a91-4ba3-93ee-dd7b1a2c271a', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-08 15:06:39.327737+00', '2026-05-11 12:15:43.339412+00', NULL, 'aal1', NULL, '2026-05-11 12:15:43.339299', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', '201.57.45.210', NULL, NULL, NULL, NULL, NULL),
	('dea83c21-9c08-4fc1-8173-f28f9a7ced1d', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-04 16:44:10.331549+00', '2026-05-05 16:14:31.112112+00', NULL, 'aal1', NULL, '2026-05-05 16:14:31.111974', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', '201.57.45.210', NULL, NULL, NULL, NULL, NULL),
	('24fea285-01f5-4ed2-bc59-74bc5d08a4b2', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-04 17:32:18.198804+00', '2026-05-05 17:43:19.22802+00', NULL, 'aal1', NULL, '2026-05-05 17:43:19.227893', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', '201.57.45.210', NULL, NULL, NULL, NULL, NULL),
	('9ad76977-cc6e-4afd-bebe-3b19f5dda5ea', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-05 17:43:41.740443+00', '2026-05-06 13:49:36.386099+00', NULL, 'aal1', NULL, '2026-05-06 13:49:36.385963', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', '201.57.45.210', NULL, NULL, NULL, NULL, NULL),
	('407b904a-39a8-4714-81b9-b11a14226458', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-11 13:44:13.935832+00', '2026-05-11 13:44:13.935832+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', '201.57.45.210', NULL, NULL, NULL, NULL, NULL),
	('ca15b9c5-c42d-479b-834f-e12dbe012aac', 'c02c3824-379f-42b1-ac82-0b418478b4d6', '2026-05-10 20:09:15.349491+00', '2026-05-13 05:09:07.67139+00', NULL, 'aal1', NULL, '2026-05-13 05:09:07.671285', 'node', '56.125.71.210', NULL, NULL, NULL, NULL, NULL),
	('045aabb5-7927-403b-abde-8830ba85a116', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-06 13:49:36.644998+00', '2026-05-07 13:03:05.178312+00', NULL, 'aal1', NULL, '2026-05-07 13:03:05.178156', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', '201.57.45.210', NULL, NULL, NULL, NULL, NULL),
	('3bf28bf1-77cf-4238-b448-d3dc118bb4ab', 'c3ec7692-8947-419a-adff-78b187124575', '2026-05-10 20:02:57.362181+00', '2026-05-15 23:52:15.764694+00', NULL, 'aal1', NULL, '2026-05-15 23:52:15.764582', 'node', '18.231.80.48', NULL, NULL, NULL, NULL, NULL),
	('1b8eec65-15de-47c0-9b29-485895ea8a2c', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', '2026-05-15 23:53:39.743756+00', '2026-05-15 23:53:39.743756+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1', '179.249.68.242', NULL, NULL, NULL, NULL, NULL),
	('73da371a-20e3-45eb-983d-c9f7e361129e', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', '2026-05-16 00:26:57.805458+00', '2026-05-16 00:26:57.805458+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36', '179.249.71.121', NULL, NULL, NULL, NULL, NULL),
	('7716ef5c-fdc3-427a-aa0f-bb4dee6a93db', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-07 13:03:05.261159+00', '2026-05-08 13:15:07.974568+00', NULL, 'aal1', NULL, '2026-05-08 13:15:07.974432', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', '201.57.45.210', NULL, NULL, NULL, NULL, NULL),
	('f6d3fbca-b131-45d9-ba0f-05c28c428b42', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-05 16:17:03.348678+00', '2026-05-08 13:15:25.22601+00', NULL, 'aal1', NULL, '2026-05-08 13:15:25.225924', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', '201.57.45.210', NULL, NULL, NULL, NULL, NULL),
	('db84289c-be7c-42f4-a54c-c058b8cb2acf', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-08 13:55:29.692201+00', '2026-05-08 15:06:38.977246+00', NULL, 'aal1', NULL, '2026-05-08 15:06:38.977139', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', '201.57.45.210', NULL, NULL, NULL, NULL, NULL),
	('a4987126-9313-4248-a5d9-13b2a2fa6e4d', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', '2026-05-16 01:07:17.644997+00', '2026-05-16 01:07:17.644997+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36', '179.249.71.121', NULL, NULL, NULL, NULL, NULL),
	('3f973b13-c17d-45da-b0b5-f05e5b75a68b', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', '2026-05-10 20:22:34.743719+00', '2026-05-10 20:22:34.743719+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1', '186.235.83.150', NULL, NULL, NULL, NULL, NULL),
	('492cc024-6661-47f0-87bd-82c2a53734ba', '93359a93-2128-4b8f-b3c2-279e4712360d', '2026-05-09 21:59:35.492333+00', '2026-05-11 02:08:51.262142+00', NULL, 'aal1', NULL, '2026-05-11 02:08:51.261983', 'node', '15.229.48.139', NULL, NULL, NULL, NULL, NULL),
	('d3f9b0de-4e37-43e0-87c4-111b648fe720', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', '2026-05-06 21:35:37.880605+00', '2026-05-11 04:57:05.744222+00', NULL, 'aal1', NULL, '2026-05-11 04:57:05.744118', 'node', '179.54.196.118', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('dea83c21-9c08-4fc1-8173-f28f9a7ced1d', '2026-05-04 16:44:10.360383+00', '2026-05-04 16:44:10.360383+00', 'password', '91b63d13-8fb9-464c-9eeb-7c4b1b03a8ac'),
	('f49c283d-30d1-44b0-bb09-03c79d6b959b', '2026-05-04 17:08:38.569621+00', '2026-05-04 17:08:38.569621+00', 'password', '799e584a-bcb4-4cf0-a2fe-40c8c1f9d0f7'),
	('13e36a8b-9987-491c-ab8d-9b00e42c170d', '2026-05-04 17:10:00.391767+00', '2026-05-04 17:10:00.391767+00', 'password', '319b1586-5a30-4188-9e9b-36cbf32b4b62'),
	('24fea285-01f5-4ed2-bc59-74bc5d08a4b2', '2026-05-04 17:32:18.212525+00', '2026-05-04 17:32:18.212525+00', 'password', '91631163-e743-462b-b8cd-4fdd568379c1'),
	('f6d3fbca-b131-45d9-ba0f-05c28c428b42', '2026-05-05 16:17:03.367626+00', '2026-05-05 16:17:03.367626+00', 'password', '44b10b54-0cf1-4dc5-9efc-0e0cb88f4d32'),
	('9ad76977-cc6e-4afd-bebe-3b19f5dda5ea', '2026-05-05 17:43:41.764814+00', '2026-05-05 17:43:41.764814+00', 'password', 'bc853a56-80b6-4389-a87e-b0e7b619747e'),
	('045aabb5-7927-403b-abde-8830ba85a116', '2026-05-06 13:49:36.658291+00', '2026-05-06 13:49:36.658291+00', 'password', 'b79849d0-7869-4103-8d78-85075f9514a5'),
	('d3f9b0de-4e37-43e0-87c4-111b648fe720', '2026-05-06 21:35:37.922504+00', '2026-05-06 21:35:37.922504+00', 'password', 'd2dd765f-f88f-4d4d-8a97-86badd612fa6'),
	('7716ef5c-fdc3-427a-aa0f-bb4dee6a93db', '2026-05-07 13:03:05.277394+00', '2026-05-07 13:03:05.277394+00', 'password', '86b880aa-13c0-4a06-9df9-f3ecca4dd28a'),
	('db84289c-be7c-42f4-a54c-c058b8cb2acf', '2026-05-08 13:55:29.723723+00', '2026-05-08 13:55:29.723723+00', 'password', '14ade9f7-d88a-4158-b912-6c4528b43635'),
	('5ced8aee-9a91-4ba3-93ee-dd7b1a2c271a', '2026-05-08 15:06:39.334293+00', '2026-05-08 15:06:39.334293+00', 'password', 'dd63291f-be3e-4046-82ec-7f98ac1be5e4'),
	('1b8eec65-15de-47c0-9b29-485895ea8a2c', '2026-05-15 23:53:39.789151+00', '2026-05-15 23:53:39.789151+00', 'password', 'b4dbad00-403d-4e61-b4a1-deaafdc39684'),
	('73da371a-20e3-45eb-983d-c9f7e361129e', '2026-05-16 00:26:57.823275+00', '2026-05-16 00:26:57.823275+00', 'otp', '2cb41d84-e78f-4341-a1bc-802c5a280eed'),
	('a4987126-9313-4248-a5d9-13b2a2fa6e4d', '2026-05-16 01:07:17.677018+00', '2026-05-16 01:07:17.677018+00', 'otp', '0b26047e-5bc7-46b8-8d21-01b2876d8aaf'),
	('492cc024-6661-47f0-87bd-82c2a53734ba', '2026-05-09 21:59:35.501655+00', '2026-05-09 21:59:35.501655+00', 'password', 'e6273486-855a-4483-89bb-f0dd0319c89e'),
	('3bf28bf1-77cf-4238-b448-d3dc118bb4ab', '2026-05-10 20:02:57.366065+00', '2026-05-10 20:02:57.366065+00', 'otp', '3f4e0fd7-d13b-4e21-b9a3-cf945098f49d'),
	('ca15b9c5-c42d-479b-834f-e12dbe012aac', '2026-05-10 20:09:15.352514+00', '2026-05-10 20:09:15.352514+00', 'otp', '1e38e8ca-d0cd-4044-973f-94a99f516ec9'),
	('3f973b13-c17d-45da-b0b5-f05e5b75a68b', '2026-05-10 20:22:34.751665+00', '2026-05-10 20:22:34.751665+00', 'otp', 'fa142a2c-c402-4daa-b16d-41820a7694be'),
	('407b904a-39a8-4714-81b9-b11a14226458', '2026-05-11 13:44:13.966651+00', '2026-05-11 13:44:13.966651+00', 'password', 'a29f1f54-3f25-4316-a255-c35d6a114142');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 2, 'cbaxnbppedtz', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-04 17:08:38.564403+00', '2026-05-04 17:08:38.564403+00', NULL, 'f49c283d-30d1-44b0-bb09-03c79d6b959b'),
	('00000000-0000-0000-0000-000000000000', 3, 'mvytdsjwby5i', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-04 17:10:00.3886+00', '2026-05-04 17:10:00.3886+00', NULL, '13e36a8b-9987-491c-ab8d-9b00e42c170d'),
	('00000000-0000-0000-0000-000000000000', 4, 'h5i5tgt3kdde', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-04 17:32:18.208276+00', '2026-05-04 18:39:39.617292+00', NULL, '24fea285-01f5-4ed2-bc59-74bc5d08a4b2'),
	('00000000-0000-0000-0000-000000000000', 5, 'lxzy64ms5vtm', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-04 18:39:39.629501+00', '2026-05-04 19:48:34.593749+00', 'h5i5tgt3kdde', '24fea285-01f5-4ed2-bc59-74bc5d08a4b2'),
	('00000000-0000-0000-0000-000000000000', 1, 'dse3vqyhu3ea', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-04 16:44:10.346348+00', '2026-05-05 16:14:31.066567+00', NULL, 'dea83c21-9c08-4fc1-8173-f28f9a7ced1d'),
	('00000000-0000-0000-0000-000000000000', 7, 'h5fw4d6cctyj', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-05 16:14:31.087339+00', '2026-05-05 16:14:31.087339+00', 'dse3vqyhu3ea', 'dea83c21-9c08-4fc1-8173-f28f9a7ced1d'),
	('00000000-0000-0000-0000-000000000000', 6, '2k3pivg7umre', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-04 19:48:34.625376+00', '2026-05-05 17:43:19.20776+00', 'lxzy64ms5vtm', '24fea285-01f5-4ed2-bc59-74bc5d08a4b2'),
	('00000000-0000-0000-0000-000000000000', 9, 'yzd76eonzvjw', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-05 17:43:19.213464+00', '2026-05-05 17:43:19.213464+00', '2k3pivg7umre', '24fea285-01f5-4ed2-bc59-74bc5d08a4b2'),
	('00000000-0000-0000-0000-000000000000', 10, 'xzacg47pk7yu', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-05 17:43:41.756661+00', '2026-05-06 13:49:36.335128+00', NULL, '9ad76977-cc6e-4afd-bebe-3b19f5dda5ea'),
	('00000000-0000-0000-0000-000000000000', 11, 'vrq2adh6j2qs', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-06 13:49:36.35834+00', '2026-05-06 13:49:36.35834+00', 'xzacg47pk7yu', '9ad76977-cc6e-4afd-bebe-3b19f5dda5ea'),
	('00000000-0000-0000-0000-000000000000', 12, 'uaosrjjqpumu', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-06 13:49:36.653613+00', '2026-05-06 14:52:11.157759+00', NULL, '045aabb5-7927-403b-abde-8830ba85a116'),
	('00000000-0000-0000-0000-000000000000', 13, 'clhfrm6icegs', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-06 14:52:11.16614+00', '2026-05-06 16:12:32.195354+00', 'uaosrjjqpumu', '045aabb5-7927-403b-abde-8830ba85a116'),
	('00000000-0000-0000-0000-000000000000', 8, 'hjvelxvu2ez7', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-05 16:17:03.364442+00', '2026-05-06 16:57:23.999173+00', NULL, 'f6d3fbca-b131-45d9-ba0f-05c28c428b42'),
	('00000000-0000-0000-0000-000000000000', 14, 'axjqrt4jrj2o', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-06 16:12:32.200131+00', '2026-05-06 17:13:29.43757+00', 'clhfrm6icegs', '045aabb5-7927-403b-abde-8830ba85a116'),
	('00000000-0000-0000-0000-000000000000', 15, 'uxeetrsqvdvn', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-06 16:57:24.004138+00', '2026-05-06 17:55:35.174941+00', 'hjvelxvu2ez7', 'f6d3fbca-b131-45d9-ba0f-05c28c428b42'),
	('00000000-0000-0000-0000-000000000000', 16, 'wnrcwb7jcieo', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-06 17:13:29.449166+00', '2026-05-06 18:57:31.693783+00', 'axjqrt4jrj2o', '045aabb5-7927-403b-abde-8830ba85a116'),
	('00000000-0000-0000-0000-000000000000', 18, '4ar2ycvwp7fr', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-06 18:57:31.698754+00', '2026-05-06 19:57:10.847236+00', 'wnrcwb7jcieo', '045aabb5-7927-403b-abde-8830ba85a116'),
	('00000000-0000-0000-0000-000000000000', 20, 'nxbm7ktputhg', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-06 21:35:37.900909+00', '2026-05-07 01:34:10.668705+00', NULL, 'd3f9b0de-4e37-43e0-87c4-111b648fe720'),
	('00000000-0000-0000-0000-000000000000', 21, 'x2faoti4kyoj', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-07 01:34:10.684747+00', '2026-05-07 02:33:18.489235+00', 'nxbm7ktputhg', 'd3f9b0de-4e37-43e0-87c4-111b648fe720'),
	('00000000-0000-0000-0000-000000000000', 22, 'mj4y3ag3ssjg', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-07 02:33:18.500384+00', '2026-05-07 03:32:18.519158+00', 'x2faoti4kyoj', 'd3f9b0de-4e37-43e0-87c4-111b648fe720'),
	('00000000-0000-0000-0000-000000000000', 19, '6k5ae73zkp45', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-06 19:57:10.859001+00', '2026-05-07 13:03:05.145424+00', '4ar2ycvwp7fr', '045aabb5-7927-403b-abde-8830ba85a116'),
	('00000000-0000-0000-0000-000000000000', 24, 'cloldhgqfj4k', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-07 13:03:05.159639+00', '2026-05-07 13:03:05.159639+00', '6k5ae73zkp45', '045aabb5-7927-403b-abde-8830ba85a116'),
	('00000000-0000-0000-0000-000000000000', 25, 'jpcpuprnjai2', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-07 13:03:05.268166+00', '2026-05-07 14:23:23.162965+00', NULL, '7716ef5c-fdc3-427a-aa0f-bb4dee6a93db'),
	('00000000-0000-0000-0000-000000000000', 26, 'ezykn65kaigw', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-07 14:23:23.180562+00', '2026-05-07 16:12:04.076632+00', 'jpcpuprnjai2', '7716ef5c-fdc3-427a-aa0f-bb4dee6a93db'),
	('00000000-0000-0000-0000-000000000000', 27, 'ws6qvmqofokq', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-07 16:12:04.082687+00', '2026-05-07 17:39:07.052806+00', 'ezykn65kaigw', '7716ef5c-fdc3-427a-aa0f-bb4dee6a93db'),
	('00000000-0000-0000-0000-000000000000', 28, 'ocsfu4dusnbp', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-07 17:39:07.062251+00', '2026-05-07 18:45:07.518915+00', 'ws6qvmqofokq', '7716ef5c-fdc3-427a-aa0f-bb4dee6a93db'),
	('00000000-0000-0000-0000-000000000000', 94, 'uenjzv2vcx5u', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', false, '2026-05-10 20:22:34.747929+00', '2026-05-10 20:22:34.747929+00', NULL, '3f973b13-c17d-45da-b0b5-f05e5b75a68b'),
	('00000000-0000-0000-0000-000000000000', 29, 's3a5xa2xtr3a', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-07 18:45:07.534608+00', '2026-05-07 20:07:51.137823+00', 'ocsfu4dusnbp', '7716ef5c-fdc3-427a-aa0f-bb4dee6a93db'),
	('00000000-0000-0000-0000-000000000000', 30, 'uvobtmgkezei', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-07 20:07:51.156676+00', '2026-05-08 11:50:16.101639+00', 's3a5xa2xtr3a', '7716ef5c-fdc3-427a-aa0f-bb4dee6a93db'),
	('00000000-0000-0000-0000-000000000000', 80, '3e5fqb4ny5dw', '93359a93-2128-4b8f-b3c2-279e4712360d', true, '2026-05-09 21:59:35.495938+00', '2026-05-11 02:08:51.218176+00', NULL, '492cc024-6661-47f0-87bd-82c2a53734ba'),
	('00000000-0000-0000-0000-000000000000', 31, '62rswt7u5s4r', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-08 11:50:16.120092+00', '2026-05-08 13:15:07.95122+00', 'uvobtmgkezei', '7716ef5c-fdc3-427a-aa0f-bb4dee6a93db'),
	('00000000-0000-0000-0000-000000000000', 32, '6lpuowlwapsj', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-08 13:15:07.958402+00', '2026-05-08 13:15:07.958402+00', '62rswt7u5s4r', '7716ef5c-fdc3-427a-aa0f-bb4dee6a93db'),
	('00000000-0000-0000-0000-000000000000', 17, '3s3p4jda23fi', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-06 17:55:35.184283+00', '2026-05-08 13:15:25.222701+00', 'uxeetrsqvdvn', 'f6d3fbca-b131-45d9-ba0f-05c28c428b42'),
	('00000000-0000-0000-0000-000000000000', 33, 'sfaslqxpzoja', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-08 13:15:25.223106+00', '2026-05-08 13:15:25.223106+00', '3s3p4jda23fi', 'f6d3fbca-b131-45d9-ba0f-05c28c428b42'),
	('00000000-0000-0000-0000-000000000000', 96, 'bynem2yevif3', '93359a93-2128-4b8f-b3c2-279e4712360d', false, '2026-05-11 02:08:51.236286+00', '2026-05-11 02:08:51.236286+00', '3e5fqb4ny5dw', '492cc024-6661-47f0-87bd-82c2a53734ba'),
	('00000000-0000-0000-0000-000000000000', 34, 'ffiwskgfmp43', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-08 13:55:29.717409+00', '2026-05-08 15:06:38.96026+00', NULL, 'db84289c-be7c-42f4-a54c-c058b8cb2acf'),
	('00000000-0000-0000-0000-000000000000', 35, 'ovejkqgwan5c', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-08 15:06:38.964814+00', '2026-05-08 15:06:38.964814+00', 'ffiwskgfmp43', 'db84289c-be7c-42f4-a54c-c058b8cb2acf'),
	('00000000-0000-0000-0000-000000000000', 68, '3tngeb6o7ex3', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-09 07:29:44.969158+00', '2026-05-11 04:57:05.702126+00', 'hvdcdigxp3oy', 'd3f9b0de-4e37-43e0-87c4-111b648fe720'),
	('00000000-0000-0000-0000-000000000000', 36, '7nrceue3orax', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-08 15:06:39.330628+00', '2026-05-08 16:14:19.584243+00', NULL, '5ced8aee-9a91-4ba3-93ee-dd7b1a2c271a'),
	('00000000-0000-0000-0000-000000000000', 97, 'vypiqlzftme2', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-11 04:57:05.719514+00', '2026-05-11 04:57:05.719514+00', '3tngeb6o7ex3', 'd3f9b0de-4e37-43e0-87c4-111b648fe720'),
	('00000000-0000-0000-0000-000000000000', 37, 'jfc4mbcrisi4', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-08 16:14:19.591095+00', '2026-05-08 17:27:39.687146+00', '7nrceue3orax', '5ced8aee-9a91-4ba3-93ee-dd7b1a2c271a'),
	('00000000-0000-0000-0000-000000000000', 38, 'lorjdrcbuhjk', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-08 17:27:39.69196+00', '2026-05-08 19:51:09.810674+00', 'jfc4mbcrisi4', '5ced8aee-9a91-4ba3-93ee-dd7b1a2c271a'),
	('00000000-0000-0000-0000-000000000000', 39, 'fuwpyu3zo3zx', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-08 19:51:09.825656+00', '2026-05-11 12:15:43.310573+00', 'lorjdrcbuhjk', '5ced8aee-9a91-4ba3-93ee-dd7b1a2c271a'),
	('00000000-0000-0000-0000-000000000000', 101, 'jbjx3uoegbf5', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-11 12:15:43.322356+00', '2026-05-11 12:15:43.322356+00', 'fuwpyu3zo3zx', '5ced8aee-9a91-4ba3-93ee-dd7b1a2c271a'),
	('00000000-0000-0000-0000-000000000000', 103, 'mea32i2bbunl', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', false, '2026-05-11 13:44:13.951457+00', '2026-05-11 13:44:13.951457+00', NULL, '407b904a-39a8-4714-81b9-b11a14226458'),
	('00000000-0000-0000-0000-000000000000', 92, 'yelazu43b3hm', 'c02c3824-379f-42b1-ac82-0b418478b4d6', true, '2026-05-10 20:09:15.350784+00', '2026-05-13 05:09:07.633951+00', NULL, 'ca15b9c5-c42d-479b-834f-e12dbe012aac'),
	('00000000-0000-0000-0000-000000000000', 108, 'jtjejcmoagfd', 'c02c3824-379f-42b1-ac82-0b418478b4d6', false, '2026-05-13 05:09:07.647452+00', '2026-05-13 05:09:07.647452+00', 'yelazu43b3hm', 'ca15b9c5-c42d-479b-834f-e12dbe012aac'),
	('00000000-0000-0000-0000-000000000000', 90, 'bfvcpbpnj5n6', 'c3ec7692-8947-419a-adff-78b187124575', true, '2026-05-10 20:02:57.3638+00', '2026-05-14 16:46:19.277471+00', NULL, '3bf28bf1-77cf-4238-b448-d3dc118bb4ab'),
	('00000000-0000-0000-0000-000000000000', 23, 'hvdcdigxp3oy', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', true, '2026-05-07 03:32:18.526604+00', '2026-05-09 07:29:44.941343+00', 'mj4y3ag3ssjg', 'd3f9b0de-4e37-43e0-87c4-111b648fe720'),
	('00000000-0000-0000-0000-000000000000', 112, 'fxb4pxafugwv', 'c3ec7692-8947-419a-adff-78b187124575', true, '2026-05-14 16:46:19.298301+00', '2026-05-15 23:52:15.740367+00', 'bfvcpbpnj5n6', '3bf28bf1-77cf-4238-b448-d3dc118bb4ab'),
	('00000000-0000-0000-0000-000000000000', 115, 'h2dmjpqhso4x', 'c3ec7692-8947-419a-adff-78b187124575', false, '2026-05-15 23:52:15.748124+00', '2026-05-15 23:52:15.748124+00', 'fxb4pxafugwv', '3bf28bf1-77cf-4238-b448-d3dc118bb4ab'),
	('00000000-0000-0000-0000-000000000000', 116, 'ybr6l2qkb4mc', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', false, '2026-05-15 23:53:39.775052+00', '2026-05-15 23:53:39.775052+00', NULL, '1b8eec65-15de-47c0-9b29-485895ea8a2c'),
	('00000000-0000-0000-0000-000000000000', 117, '3vpyfmt5wnzg', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', false, '2026-05-16 00:26:57.815188+00', '2026-05-16 00:26:57.815188+00', NULL, '73da371a-20e3-45eb-983d-c9f7e361129e'),
	('00000000-0000-0000-0000-000000000000', 118, 'yed6hdlpmu3m', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', false, '2026-05-16 01:07:17.65426+00', '2026-05-16 01:07:17.65426+00', NULL, 'a4987126-9313-4248-a5d9-13b2a2fa6e4d');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: addons; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."addons" ("id", "name", "price", "active", "created_at", "sort_order") VALUES
	('ba8f12f3-58a4-4b78-bafa-c87c4080c815', 'Ovo', 1.00, true, '2026-05-06 21:55:22.207165+00', 1),
	('6da396a6-cf69-44eb-80c8-f5473e21fc8b', 'Batata Palha', 1.00, true, '2026-05-06 21:55:22.207165+00', 2),
	('6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', 'Tomate', 1.00, true, '2026-05-06 21:55:22.207165+00', 3),
	('229a872b-aa41-412d-96b1-0e2a89ae8278', 'Cebola', 1.00, true, '2026-05-06 21:55:22.207165+00', 4),
	('805245c5-bf1e-4465-a5a6-c8134b47cdeb', 'Tomate Seco', 2.00, true, '2026-05-06 21:55:22.207165+00', 5),
	('65a87879-8577-4de2-94f3-7b2579952649', 'Azeitona', 2.00, true, '2026-05-06 21:55:22.207165+00', 6),
	('9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', 'Palmito', 2.00, true, '2026-05-06 21:55:22.207165+00', 7),
	('b129de6e-b3f1-442e-b0f1-56e8dde00592', 'Cheddar Cremoso', 2.00, true, '2026-05-06 21:55:22.207165+00', 8),
	('d7cf2c5c-48c6-4688-9ca4-efe8f628a660', 'Morango', 2.00, true, '2026-05-06 21:55:22.207165+00', 9),
	('43c7a484-9d49-4253-88b8-f787b85ed31f', 'Banana', 2.00, true, '2026-05-06 21:55:22.207165+00', 10),
	('f61e450f-60e8-4f79-b86b-af5322886890', 'Leite Condensado', 2.00, true, '2026-05-06 21:55:22.207165+00', 11),
	('954ebf0d-bda7-483c-a744-eaf453924348', 'Frango', 4.00, true, '2026-05-06 21:55:22.207165+00', 12),
	('2290b91c-2b61-4689-9605-32a81319d25c', 'Peito de Peru', 4.00, true, '2026-05-06 21:55:22.207165+00', 13),
	('9be1d846-786e-438f-8b4d-2c4216639b42', 'Calabresa', 4.00, true, '2026-05-06 21:55:22.207165+00', 14),
	('b2924bb7-aa47-4e4c-856f-7ebcf406e418', 'Queijo', 4.00, true, '2026-05-06 21:55:22.207165+00', 15),
	('d012e3b2-14bb-451c-8817-5e8761aba890', 'Bacon', 4.00, true, '2026-05-06 21:55:22.207165+00', 16),
	('11688d22-91a3-469c-ad74-e31b290de26a', 'Presunto', 4.00, true, '2026-05-06 21:55:22.207165+00', 17),
	('82ef8754-d80a-4505-94ea-4573112e4eda', 'Chocolate', 4.00, true, '2026-05-06 21:55:22.207165+00', 18),
	('a618df1b-1e43-4e42-8a22-8d27aed68874', 'Doce de Leite', 4.00, true, '2026-05-06 21:55:22.207165+00', 19),
	('84c6e73e-f6cf-4ee7-889d-7cc059bab043', 'Sorvete', 4.00, true, '2026-05-06 21:55:22.207165+00', 20),
	('510ae551-73a3-4810-8346-4022ab4c4dd9', 'Nutella', 5.00, true, '2026-05-06 21:55:22.207165+00', 21),
	('57de54ec-825c-41d1-b5cc-4c6c12ce08a4', 'Carne de Sol', 5.00, true, '2026-05-06 21:55:22.207165+00', 22),
	('3eea6e30-7bdf-420d-b9d9-64fc96911279', 'Atum', 5.00, true, '2026-05-06 21:55:22.207165+00', 23);


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "role", "name", "active", "created_at") VALUES
	('aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'ADMIN', 'Emanuel Morais', true, '2026-05-09 00:40:52.137067+00'),
	('c02c3824-379f-42b1-ac82-0b418478b4d6', 'ADMIN', 'Leda Moura', true, '2026-05-09 01:00:16.931791+00'),
	('b8b07c11-3b79-4f84-99d4-307db6d9b373', 'ADMIN', 'Administrador', false, '2026-05-04 16:39:16.545111+00'),
	('c3ec7692-8947-419a-adff-78b187124575', 'ADMIN', 'Melissa Alves', true, '2026-05-09 18:13:46.4767+00'),
	('93359a93-2128-4b8f-b3c2-279e4712360d', 'ATTENDANT', 'Emmanuely', true, '2026-05-09 21:57:32.913993+00'),
	('6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', 'ATTENDANT', 'Davi Moura', true, '2026-05-10 20:17:46.558732+00');


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."audit_logs" ("id", "user_id", "action", "table_name", "record_id", "old_data", "new_data", "created_at") VALUES
	('a505e617-2cc7-4e88-8b39-cef8d7fef5cf', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', 'ORDER_CREATED', 'orders', '27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', NULL, NULL, '2026-05-15 23:55:29.83678+00'),
	('50a3dd07-9490-4738-971f-1b06c138cbaf', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', 'ORDER_SENT_TO_QUEUE', 'orders', '27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', NULL, NULL, '2026-05-15 23:55:29.83678+00'),
	('43050bfd-6ccb-4dfb-b75d-5adbf7734f53', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', 'PAYMENT_MARKED_COURTESY', 'orders', '27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', NULL, NULL, '2026-05-15 23:55:29.83678+00'),
	('d823ad98-c387-4626-a14e-29b2b404a337', NULL, 'WHATSAPP_SENT', 'whatsapp_messages', '27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', NULL, '{"template": "novo_pedido", "event_type": "order_received", "provider_message_id": "wamid.HBgMNTU2MTgyOTkwOTYyFQIAERgSN0Y1QjNDNUM5MkFCRkM5NTNEAA==", "whatsapp_message_id": "ff689d31-6ff6-4460-a564-2fbca8877f6e"}', '2026-05-15 23:56:01.329132+00'),
	('f7210513-2c0f-41a5-b891-2966efffdbec', NULL, 'WHATSAPP_SENT', 'whatsapp_messages', '27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', NULL, '{"template": "pedido_pronto", "event_type": "order_ready", "provider_message_id": "wamid.HBgMNTU2MTgyOTkwOTYyFQIAERgSMjVERDM5MjIxODcyMkI4NkUxAA==", "whatsapp_message_id": "4250d1ce-4ad5-4960-9d1c-8999b1824691"}', '2026-05-15 23:58:00.962581+00'),
	('19e3bdbb-287b-4b73-99e6-516a48f42b68', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', 'ORDER_DELIVERED', 'orders', '27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', NULL, '{"status": "ENTREGUE"}', '2026-05-16 00:03:23.701304+00'),
	('47cddac5-b43a-4a77-8c78-6262e42cbb0d', 'c3ec7692-8947-419a-adff-78b187124575', 'ORDER_CREATED', 'orders', 'aa1fc2d7-0384-4de5-845d-55735d1b0389', NULL, NULL, '2026-05-16 00:28:52.464402+00'),
	('ed81085d-a900-400f-8b3e-cb3051734219', 'c3ec7692-8947-419a-adff-78b187124575', 'ORDER_SENT_TO_QUEUE', 'orders', 'aa1fc2d7-0384-4de5-845d-55735d1b0389', NULL, NULL, '2026-05-16 00:28:52.464402+00'),
	('f0ea3b2a-4d99-4b68-a419-fb93b02843dd', 'c3ec7692-8947-419a-adff-78b187124575', 'PAYMENT_MARKED_PAID', 'orders', 'aa1fc2d7-0384-4de5-845d-55735d1b0389', NULL, NULL, '2026-05-16 00:28:52.464402+00'),
	('9d89a6e9-cd5c-49d5-8af6-4c91f0ca6427', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'ORDER_READY', 'orders', 'aa1fc2d7-0384-4de5-845d-55735d1b0389', NULL, '{"status": "PRONTO"}', '2026-05-16 02:08:43.381379+00'),
	('f2eef4f1-143f-469f-9cd3-0cad62401618', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'ORDER_DELIVERED', 'orders', 'aa1fc2d7-0384-4de5-845d-55735d1b0389', NULL, '{"status": "ENTREGUE"}', '2026-05-16 02:08:45.64157+00'),
	('0adf2d65-4f81-4310-a1da-0abcb0f5c0a1', NULL, 'WHATSAPP_SENT', 'whatsapp_messages', 'aa1fc2d7-0384-4de5-845d-55735d1b0389', NULL, '{"template": "pedido_pronto", "event_type": "order_ready", "provider_message_id": "wamid.HBgMNTU2MTkyNDUzMDAzFQIAERgSRDQ1QTg4MTM1QjIwQkJFODVGAA==", "whatsapp_message_id": "7ba265de-59e5-42de-8451-2bd2fff73410"}', '2026-05-16 02:09:00.91855+00'),
	('b89873f1-4af1-4c70-899d-8030dec8d67e', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', 'USER_DISABLED', 'profiles', 'f26b4779-7b97-4d93-8893-ac1466f51555', NULL, NULL, '2026-05-07 17:53:08.393667+00'),
	('a25e1697-60e7-4748-8f24-6913012bda36', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', 'USER_ENABLED', 'profiles', 'f26b4779-7b97-4d93-8893-ac1466f51555', NULL, NULL, '2026-05-07 17:53:11.485252+00'),
	('2ef77b98-061f-4623-9760-f3e31ab432f0', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_DISABLED', 'profiles', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', NULL, NULL, '2026-05-09 00:59:32.515843+00'),
	('f043c803-8d21-4a8b-b518-5d8d649913d1', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_ENABLED', 'profiles', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', NULL, NULL, '2026-05-09 00:59:33.354343+00'),
	('d92d0e8c-a1de-47d2-94cb-3aa858f13f15', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_DISABLED', 'profiles', 'f26b4779-7b97-4d93-8893-ac1466f51555', NULL, NULL, '2026-05-09 00:59:38.219906+00'),
	('1e5b2e5f-3dfe-4a8c-8676-c7fa33ec5319', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_DISABLED', 'profiles', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', NULL, NULL, '2026-05-09 00:59:41.636351+00'),
	('eae64b41-2589-4723-b331-7134c9dcf2bb', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_CREATED', 'profiles', 'c02c3824-379f-42b1-ac82-0b418478b4d6', NULL, '{"name": "Leda Moura", "role": "ADMIN", "email": "Ledamoura@yahoo.com.br", "active": true}', '2026-05-09 01:00:16.989109+00'),
	('4c8cde8f-a26c-4b91-884c-b94a44b4ffb5', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_CREATED', 'profiles', '7e4289b8-70f3-4e54-a35d-4426df1036d4', NULL, '{"name": "Teste", "role": "ATTENDANT", "email": "teste@teste", "active": true}', '2026-05-09 08:21:42.796004+00'),
	('bbe4730f-8139-4859-ad2c-ea2779c06049', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_ENABLED', 'profiles', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', NULL, NULL, '2026-05-09 15:13:46.897122+00'),
	('8167dbc0-12fb-464c-8883-cad67440859f', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_DISABLED', 'profiles', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', NULL, NULL, '2026-05-09 15:13:48.462179+00'),
	('967dd326-51f6-4145-87be-9b9a7e257bcd', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_DISABLED', 'profiles', 'b8b07c11-3b79-4f84-99d4-307db6d9b373', NULL, NULL, '2026-05-09 15:13:49.168613+00'),
	('da6f9684-cd84-4b6f-9a6a-6f001d9113ae', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_DELETED', 'profiles', '7e4289b8-70f3-4e54-a35d-4426df1036d4', NULL, NULL, '2026-05-09 15:36:30.690638+00'),
	('bf9d873e-8965-4897-9ae5-4cb27e37343c', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_DELETED', 'profiles', 'f26b4779-7b97-4d93-8893-ac1466f51555', NULL, NULL, '2026-05-09 15:37:31.201207+00'),
	('f4902f58-814f-405d-9e8d-f80ceb7cb1dd', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_CREATED', 'profiles', 'c3ec7692-8947-419a-adff-78b187124575', NULL, '{"name": "Melissa Alves", "role": "ADMIN", "email": "melissamr.alves@gmail.com", "active": true}', '2026-05-09 18:13:46.518851+00'),
	('3c0e5e7c-c50e-4187-bcae-cac4abd2818d', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_CREATED', 'profiles', '93359a93-2128-4b8f-b3c2-279e4712360d', NULL, '{"name": "Emmanuely", "role": "ATTENDANT", "email": "emmanuellyagatha@gmail.com", "active": true}', '2026-05-09 21:57:33.039193+00'),
	('4c368584-4f9c-4e24-b56c-d2025ec80d05', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_PASSWORD_RESET', 'profiles', '93359a93-2128-4b8f-b3c2-279e4712360d', NULL, NULL, '2026-05-09 21:59:17.792964+00'),
	('0af10ccf-e397-4a38-b061-f1e1abcb15e0', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'ORDER_READY', 'orders', '27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', NULL, '{"status": "PRONTO"}', '2026-05-15 23:57:40.2184+00'),
	('e89ba2e8-62ec-4bad-b8d4-e2fb9f4a16fb', NULL, 'WHATSAPP_FAILED', 'whatsapp_messages', 'aa1fc2d7-0384-4de5-845d-55735d1b0389', NULL, '{"template": "novo_pedido", "definitive": true, "error_code": 190, "event_type": "order_received", "token_expired": true, "whatsapp_message_id": "58a188cc-9325-431e-8bd2-a67d0f73fa75"}', '2026-05-16 00:29:00.655446+00'),
	('3b3f5c2c-5e79-4e43-b439-aa196e50d973', 'c02c3824-379f-42b1-ac82-0b418478b4d6', 'USER_PASSWORD_RESET', 'profiles', 'c02c3824-379f-42b1-ac82-0b418478b4d6', NULL, NULL, '2026-05-10 20:08:11.267332+00'),
	('1d3d3c0e-8829-4a75-ab42-2da97986978a', 'c02c3824-379f-42b1-ac82-0b418478b4d6', 'USER_CREATED', 'profiles', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', NULL, '{"name": "Davi Moura", "role": "ATTENDANT", "email": "davimralves22092009@gmail.com", "active": true}', '2026-05-10 20:17:46.614082+00'),
	('c2624379-4f8d-4bf8-bcf2-ed17bc11abb8', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'USER_PASSWORD_RESET', 'profiles', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', NULL, NULL, '2026-05-11 06:20:59.229866+00');


--
-- Data for Name: cash_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."categories" ("id", "name", "active", "sort_order", "created_at") VALUES
	('0c5448da-c61e-4a43-9bd4-977adb062915', 'Kreps Salgados', true, 1, '2026-05-06 21:55:22.207165+00'),
	('c2292bf2-4f18-4386-95e5-4c5f94343088', 'Kreps Doces', true, 2, '2026-05-06 21:55:22.207165+00'),
	('5b31fe1e-2a42-4db6-bbad-afbb591b807f', 'Batata', true, 3, '2026-05-06 21:55:22.207165+00'),
	('e92b9c30-b22f-468e-b22c-ee5149413081', 'Bebidas / Combustíveis', true, 4, '2026-05-06 21:55:22.207165+00'),
	('bc9940ed-f5b6-462f-ba83-70f3ed9fad80', 'Adicionais', false, 6, '2026-05-06 21:55:22.207165+00'),
	('3e03b2a9-3143-405d-a8af-1f635539e997', 'Cremes / Açaí', true, 5, '2026-05-06 21:55:22.207165+00');


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."customers" ("id", "phone_e164", "name", "first_seen_at", "last_seen_at", "last_order_at", "orders_count", "marketing_opt_in", "marketing_opt_in_at", "source", "notes", "whatsapp_opt_in", "whatsapp_opt_in_updated_at", "email", "remember_checkout_data", "last_order_type", "checkout_profile_updated_at") VALUES
	('+5561991625549', '+5561991625549', 'who', '2026-05-11 22:54:35.416613+00', '2026-05-11 22:54:35.361+00', '2026-05-11 22:54:35.361+00', 1, true, '2026-05-11 22:54:35.361+00', 'APP', NULL, true, NULL, NULL, false, NULL, NULL),
	('+5561991453003', '+5561991453003', 'Leda', '2026-05-12 15:10:18.716299+00', '2026-05-12 15:10:18.597+00', '2026-05-12 15:10:18.597+00', 1, false, NULL, 'APP', NULL, true, NULL, NULL, false, NULL, NULL),
	('+5561993417606', '+5561993417606', 'Edivan', '2026-05-14 02:56:22.878952+00', '2026-05-14 02:56:22.799+00', '2026-05-14 02:56:22.799+00', 1, false, NULL, 'APP', NULL, true, NULL, NULL, false, NULL, NULL),
	('+5561982990962', '+5561982990962', 'Emanuel Araujo', '2026-05-11 21:05:28.227245+00', '2026-05-15 23:11:10.794+00', '2026-05-15 23:11:10.794+00', 14, true, '2026-05-11 21:05:28.183+00', 'APP', NULL, true, NULL, NULL, false, NULL, NULL);


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."orders" ("id", "daily_number", "public_token", "type", "source", "status", "payment_status", "payment_method", "customer_name", "customer_phone", "notes", "discount_amount", "discount_percentage", "discount_reason", "discount_applied_by", "packing_fee", "total_amount", "created_by", "confirmed_by", "confirmed_at", "ready_at", "delivered_at", "paid_at", "cancelled_at", "cancelled_by", "created_at", "updated_at", "queue_entered_at", "preparation_started_at", "preparation_finished_at", "customer_email", "customer_id") VALUES
	('27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', 1, '0aa7831491c5eb72290282f97b3362c1', 'BALCAO', 'ATTENDANT', 'ENTREGUE', 'COURTESY', 'COURTESY', 'Emanuel', '+5561982990962', NULL, 0.00, 0.00, NULL, NULL, 0.00, 25.00, '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', '2026-05-15 23:55:29.646+00', '2026-05-15 23:57:40.107+00', '2026-05-16 00:03:23.651+00', '2026-05-15 23:55:29.646+00', NULL, NULL, '2026-05-15 23:55:29.695837+00', '2026-05-16 00:03:23.663895+00', NULL, NULL, NULL, NULL, NULL),
	('aa1fc2d7-0384-4de5-845d-55735d1b0389', 2, '321b96badcfde2cde9d10e54e264a545', 'BALCAO', 'ATTENDANT', 'ENTREGUE', 'PAID', 'PIX', 'Leda Alves', '+5561992453003', NULL, 0.00, 0.00, NULL, NULL, 0.00, 20.00, 'c3ec7692-8947-419a-adff-78b187124575', 'c3ec7692-8947-419a-adff-78b187124575', '2026-05-16 00:28:52.26+00', '2026-05-16 02:08:43.255+00', '2026-05-16 02:08:45.603+00', '2026-05-16 00:28:52.26+00', NULL, NULL, '2026-05-16 00:28:52.319228+00', '2026-05-16 02:08:45.615746+00', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: discounts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ingredients; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."ingredients" ("id", "name", "active", "created_at") VALUES
	('283c5e01-9edf-4ed6-a8ea-2ce961bb4a72', 'presunto', true, '2026-05-06 21:55:22.207165+00'),
	('abb26a38-16c5-4a41-8c2c-1b184e2fbb04', 'queijo', true, '2026-05-06 21:55:22.207165+00'),
	('15cc7c24-7ef3-437f-ae04-561f0ee14ea7', 'milho', true, '2026-05-06 21:55:22.207165+00'),
	('fdc9c5cc-1a16-48ed-b438-0b6b411f5fab', 'catupiry', true, '2026-05-06 21:55:22.207165+00'),
	('f34c860c-3584-4a8b-ac83-b511a9d26c57', 'bacon', true, '2026-05-06 21:55:22.207165+00'),
	('0ce3d97b-62f1-4e3d-8859-729756285bd7', 'ovo', true, '2026-05-06 21:55:22.207165+00'),
	('cc78d045-f56c-46b0-9df5-726490dd6213', 'calabresa', true, '2026-05-06 21:55:22.207165+00'),
	('b64f420c-0159-4beb-94bf-072e24dd7edc', 'frango', true, '2026-05-06 21:55:22.207165+00'),
	('0274eba8-742c-423c-9702-ab96baaad8f7', 'atum', true, '2026-05-06 21:55:22.207165+00'),
	('4049a63d-cee6-447a-83a6-79fc8543b6c0', 'palmito', true, '2026-05-06 21:55:22.207165+00'),
	('f6a65927-ac55-4cf5-8cbf-844b468299de', 'cheddar cremoso', true, '2026-05-06 21:55:22.207165+00'),
	('63591144-ffb1-415f-9e71-8669e18a164e', 'rúcula', true, '2026-05-06 21:55:22.207165+00'),
	('168b09b9-bc3b-4583-94fb-9c639159fefe', 'tomate seco', true, '2026-05-06 21:55:22.207165+00'),
	('ecb348ac-d2ca-4ded-a531-aa116b6741e1', 'carne de sol', true, '2026-05-06 21:55:22.207165+00'),
	('6de8ae0b-5238-456e-9036-c5ec54b2d486', 'cebola', true, '2026-05-06 21:55:22.207165+00'),
	('381fb46e-e691-4022-83fc-f84d537b39e3', 'azeitona', true, '2026-05-06 21:55:22.207165+00'),
	('05143a47-3e05-4a00-b959-08996d156377', 'tomate', true, '2026-05-06 21:55:22.207165+00'),
	('1f624732-b4a4-4ac6-94f7-4ab557ece771', 'batata palha', true, '2026-05-06 21:55:22.207165+00'),
	('ee3e0642-ff05-4f4c-ba53-4b7946c9d31d', 'banana', true, '2026-05-06 21:55:22.207165+00'),
	('cd527f84-c7fd-40af-9292-528f71fe3974', 'açúcar', true, '2026-05-06 21:55:22.207165+00'),
	('0e3943b6-03cd-419d-b60c-70fcbab56bff', 'canela', true, '2026-05-06 21:55:22.207165+00'),
	('19bd6830-3a7d-4c3e-891d-38c95320e2ed', 'mel', true, '2026-05-06 21:55:22.207165+00'),
	('24606c2c-8e4f-4c32-9368-d9449fef41f8', 'chocolate', true, '2026-05-06 21:55:22.207165+00'),
	('d328b7f4-9129-485f-8667-e06179c53b30', 'doce de leite', true, '2026-05-06 21:55:22.207165+00'),
	('14aaab7d-50ca-43af-9400-34f5ac40fcc2', 'nutella', true, '2026-05-06 21:55:22.207165+00'),
	('fb9d4391-b7e3-4471-a1ef-b3062e48c2ec', 'sorvete', true, '2026-05-06 21:55:22.207165+00'),
	('66e78471-148a-419a-a6f7-00a8dbfe2d72', 'morango', true, '2026-05-06 21:55:22.207165+00'),
	('17ed4e34-78a7-462b-ab91-49d5ca30a9f3', 'goiabada', true, '2026-05-06 21:55:22.207165+00'),
	('ad9fb068-bbce-4524-9c84-e82e21662128', 'peito de peru', true, '2026-05-06 21:55:22.207165+00');


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."products" ("id", "category_id", "name", "description", "price", "sector", "active", "created_at", "sort_order") VALUES
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '0c5448da-c61e-4a43-9bd4-977adb062915', '02 - Chevrolet 28', NULL, 21.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 2),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '0c5448da-c61e-4a43-9bd4-977adb062915', '03 - Corvette', NULL, 23.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 3),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '0c5448da-c61e-4a43-9bd4-977adb062915', '04 - Mercedes', NULL, 26.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 4),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '0c5448da-c61e-4a43-9bd4-977adb062915', '05 - Simca', NULL, 20.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 5),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '0c5448da-c61e-4a43-9bd4-977adb062915', '06 - Alfa Romeo', NULL, 21.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 6),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '0c5448da-c61e-4a43-9bd4-977adb062915', '07 - Karmann Ghia', NULL, 23.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 7),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '0c5448da-c61e-4a43-9bd4-977adb062915', '08 - Impala', NULL, 26.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 8),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '0c5448da-c61e-4a43-9bd4-977adb062915', '09 - Volvo', NULL, 20.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 9),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '0c5448da-c61e-4a43-9bd4-977adb062915', '10 - Aero Willys', NULL, 21.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 10),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '0c5448da-c61e-4a43-9bd4-977adb062915', '11 - Bel Air', NULL, 23.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 11),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '0c5448da-c61e-4a43-9bd4-977adb062915', '12 - Thunderbird', NULL, 26.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 12),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '0c5448da-c61e-4a43-9bd4-977adb062915', '13 - Puma', NULL, 22.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 13),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '0c5448da-c61e-4a43-9bd4-977adb062915', '14 - Dodge', NULL, 24.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 14),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '0c5448da-c61e-4a43-9bd4-977adb062915', '15 - Continental', NULL, 28.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 15),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '0c5448da-c61e-4a43-9bd4-977adb062915', '16 - Jaguar', NULL, 30.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 16),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '0c5448da-c61e-4a43-9bd4-977adb062915', '17 - Ecto-1', NULL, 20.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 17),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '0c5448da-c61e-4a43-9bd4-977adb062915', '18 - Delorean DMC-12', NULL, 22.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 18),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '0c5448da-c61e-4a43-9bd4-977adb062915', '19 - Barracuda', NULL, 26.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 19),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '0c5448da-c61e-4a43-9bd4-977adb062915', '20 - Eleanor', NULL, 32.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 20),
	('22365660-8bab-4739-8cf5-7324187bbda8', '0c5448da-c61e-4a43-9bd4-977adb062915', '21 - Mach 5', NULL, 24.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 21),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '0c5448da-c61e-4a43-9bd4-977adb062915', '22 - Super Máquina', NULL, 26.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 22),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '0c5448da-c61e-4a43-9bd4-977adb062915', '23 - Ford Mercury', NULL, 28.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 23),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '0c5448da-c61e-4a43-9bd4-977adb062915', '24 - General Lee', NULL, 35.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 24),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '0c5448da-c61e-4a43-9bd4-977adb062915', '25 - Fusca', NULL, 30.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 25),
	('1f118fab-7bad-4119-863a-816124ca7740', '0c5448da-c61e-4a43-9bd4-977adb062915', '26 - Maverick V8tão', NULL, 40.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 26),
	('5b9f440f-6e5f-4665-bea0-e623a39b6be6', 'c2292bf2-4f18-4386-95e5-4c5f94343088', '29 - Mustang', NULL, 26.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 29),
	('b0f78fa2-0e32-416f-9c58-3498dbb11fa1', 'c2292bf2-4f18-4386-95e5-4c5f94343088', '30 - Buick', NULL, 26.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 30),
	('43133eda-7c11-4b2f-906d-ea5763377b47', 'c2292bf2-4f18-4386-95e5-4c5f94343088', '31 - Opala 71', NULL, 28.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 31),
	('1b538c4e-59e1-4233-97fe-fcb05de8fdb9', 'c2292bf2-4f18-4386-95e5-4c5f94343088', '32 - Chevette', NULL, 30.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 32),
	('157c326d-1e8a-481b-a25d-2bf80706cd5b', 'c2292bf2-4f18-4386-95e5-4c5f94343088', '33 - Landau', NULL, 26.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 33),
	('0c2dff90-d9e3-425b-b0b6-3294a363c272', 'c2292bf2-4f18-4386-95e5-4c5f94343088', '34 - Camaro', NULL, 28.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 34),
	('ebbc0901-8026-4100-a095-a4787a706eb9', 'c2292bf2-4f18-4386-95e5-4c5f94343088', '35 - Rolls Royce', NULL, 30.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 35),
	('73f2e6f4-f9ce-43eb-9c04-c04269ecd4f3', 'c2292bf2-4f18-4386-95e5-4c5f94343088', '36 - Cadillac', NULL, 22.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 36),
	('5bf4b35f-3417-40b5-9b57-18c4cc887bd4', '5b31fe1e-2a42-4db6-bbad-afbb591b807f', 'Porção de Batata', NULL, 22.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 1),
	('8a715f1e-343a-4efa-91b1-f9e20d2c3388', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Suco Limão', NULL, 8.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 3),
	('c4c18375-09d0-4e8a-abf1-d6c8c1ff028e', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Laranja + Morango', NULL, 14.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 8),
	('159b21ce-4d81-4df4-b31f-fa5eac590105', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Soda Italiana', NULL, 14.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 10),
	('47f18bd9-8b9a-4470-bc3e-b82bf4b7bfc4', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Suco de Abacaxi com Hortelã', NULL, 8.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 11),
	('9d6fa256-7e3a-4fcf-8bd4-585070e6bfe9', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Suco de Acerola', NULL, 8.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 12),
	('958b9888-ed81-4aeb-9a2d-1355a0a02a4e', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Suco de Caju', NULL, 8.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 13),
	('6791d87c-357a-438a-8094-605770f5e3c4', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Suco de Cajá', NULL, 8.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 14),
	('7eef6e76-17a4-46af-93ad-1907830b4ae7', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Suco de Cupuaçu', NULL, 8.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 15),
	('622579c7-5416-470f-a14c-8d8d546c3ffe', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Suco de Manga', NULL, 8.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 16),
	('468ba3de-a0a5-4c74-aa33-9fa8080c78f3', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Suco de Morango', NULL, 8.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 17),
	('d28b69c5-183e-44d8-9cb3-ba3f8c6c892e', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Suco de Maracujá', NULL, 8.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 18),
	('ba31cee8-9406-4565-b403-1fee8dcda65e', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Teste', NULL, 1.00, 'JUICE_POTATO', false, '2026-05-12 03:52:31.565434+00', 0),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '0c5448da-c61e-4a43-9bd4-977adb062915', '01 - Fiat 147', NULL, 20.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 1),
	('a8e2a14c-5de9-4c70-9c63-fb015f6f9613', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Guaraná 600ml', NULL, 12.00, 'JUICE_POTATO', true, '2026-05-16 00:16:32.01955+00', 0),
	('ed1947de-f3ea-4414-9bcf-f881c657c26a', 'c2292bf2-4f18-4386-95e5-4c5f94343088', '27 - DKW Vemag', NULL, 23.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 27),
	('a82d9585-d6a6-49d7-97d8-722222229a08', 'c2292bf2-4f18-4386-95e5-4c5f94343088', '28 - Galaxie', NULL, 23.00, 'KITCHEN', true, '2026-05-06 21:55:22.207165+00', 28),
	('cc0522fe-860b-46eb-816e-05984204e2f1', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Coca Lata', NULL, 6.00, 'JUICE_POTATO', true, '2026-05-11 05:58:47.214252+00', 0),
	('f3edd808-4ae2-4923-9e9a-0099eca09747', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Coca Zero 600ml', NULL, 12.00, 'JUICE_POTATO', true, '2026-05-16 00:17:48.859901+00', 0),
	('1c7d3f3e-bab0-4c6c-a759-e580a9cc16dd', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'H2O', NULL, 7.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 2),
	('3316fdc8-6a03-48ee-8e89-4524d8f0334d', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Guaraná Zero 600ml', NULL, 12.00, 'NONE', true, '2026-05-16 00:18:21.387396+00', 0),
	('1c88a62e-d3e8-4503-ac85-08cc574e5778', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Suco Laranja', NULL, 8.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 4),
	('cb14a1cd-a9dd-46b5-af28-9111337475ce', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Coca 600ml', NULL, 12.00, 'JUICE_POTATO', true, '2026-05-16 00:17:11.196084+00', 0),
	('f4323bf6-2c13-4ada-bd97-1352ec27f78b', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Coca Zero Lata', NULL, 6.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 1),
	('bdcc18d3-fe55-4712-ba27-e2bb285da253', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Guaraná Lata', NULL, 6.00, 'JUICE_POTATO', true, '2026-05-16 00:15:59.723382+00', 0),
	('2e706c78-4af4-497a-98a2-62ecb2e66db6', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Suco Laranja + Acerola', NULL, 12.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 9),
	('b0da565f-7695-466f-8c81-b27b5f824d85', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Polpa + Leite', NULL, 10.00, 'JUICE_POTATO', false, '2026-05-06 21:55:22.207165+00', 5),
	('a56ee33a-9a2f-4625-bbb3-94528ac2dac4', 'e92b9c30-b22f-468e-b22c-ee5149413081', 'Polpa + Água', NULL, 8.00, 'JUICE_POTATO', false, '2026-05-06 21:55:22.207165+00', 6),
	('7a80e442-85b3-4437-aa19-6d6b6bdef102', '3e03b2a9-3143-405d-a8af-1f635539e997', 'Creme de Morango', NULL, 10.00, 'JUICE_POTATO', true, '2026-05-16 00:21:25.64097+00', 0),
	('1cf03a59-336e-4a7e-8233-280b1f6dc725', '3e03b2a9-3143-405d-a8af-1f635539e997', 'Creme de Maracujá', NULL, 10.00, 'JUICE_POTATO', true, '2026-05-16 00:21:40.129955+00', 0),
	('487a5181-abed-476f-99d8-c4710863ff48', '3e03b2a9-3143-405d-a8af-1f635539e997', 'Creme de Acerola', NULL, 10.00, 'JUICE_POTATO', true, '2026-05-16 00:21:55.081857+00', 0),
	('5ba2d88b-ea20-4d04-9cea-4cd8f2d59783', '3e03b2a9-3143-405d-a8af-1f635539e997', 'Creme de Cajá', NULL, 10.00, 'JUICE_POTATO', true, '2026-05-16 00:23:04.112579+00', 0),
	('ef2e3fcb-5468-4977-8a0a-510cb195bcc9', '3e03b2a9-3143-405d-a8af-1f635539e997', 'Creme de Cupuaçu', NULL, 10.00, 'JUICE_POTATO', true, '2026-05-16 00:23:20.92013+00', 0),
	('3dd27d41-f270-4719-bdca-9e458db56c6d', '3e03b2a9-3143-405d-a8af-1f635539e997', 'Creme de Açai', NULL, 15.00, 'JUICE_POTATO', true, '2026-05-06 21:55:22.207165+00', 7);


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."order_items" ("id", "order_id", "product_id", "product_name_snapshot", "product_price_snapshot", "production_sector", "quantity", "observation", "total_price", "created_at") VALUES
	('deeb8dec-872f-4510-922c-17ca4a00ad99', '27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', '278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '11 - Bel Air', 23.00, 'KITCHEN', 1, NULL, 25.00, '2026-05-15 23:55:29.787245+00'),
	('409cdae5-9361-4393-8937-3e2980719c2f', 'aa1fc2d7-0384-4de5-845d-55735d1b0389', '736d47c6-f957-475d-8dc5-3d50a206d6f2', '01 - Fiat 147', 20.00, 'KITCHEN', 1, NULL, 20.00, '2026-05-16 00:28:52.438018+00');


--
-- Data for Name: order_item_addons; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."order_item_addons" ("id", "order_item_id", "addon_id", "quantity", "addon_name_snapshot", "addon_price_snapshot", "created_at") VALUES
	('1329e0c9-a4d8-42cd-9af0-e3bbcd09f4d9', 'deeb8dec-872f-4510-922c-17ca4a00ad99', '229a872b-aa41-412d-96b1-0e2a89ae8278', 1, 'Cebola', 1.00, '2026-05-15 23:55:29.811796+00'),
	('e36e7bba-ae95-4702-9b8c-ddc9ecc76fee', 'deeb8dec-872f-4510-922c-17ca4a00ad99', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', 1, 'Tomate', 1.00, '2026-05-15 23:55:29.811796+00');


--
-- Data for Name: order_item_removed_ingredients; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: payment_method_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."payment_method_configs" ("code", "provider", "label", "internal_payment_method", "enabled", "sort_order", "requires_email", "requires_document", "requires_device_support", "availability_reason", "provider_config", "created_at", "updated_at") VALUES
	('MERCADO_PAGO_PAYMENT_BRICK', 'MERCADO_PAGO', 'Mercado Pago', NULL, true, 10, true, false, false, 'Checkout transparente via Payment Brick: credito, debito disponivel, Pix e outros metodos habilitados pela conta.', '{"brick": "payment", "paymentMethods": {"debitCard": "all", "creditCard": "all", "prepaidCard": "all", "bankTransfer": "all"}}', '2026-05-11 05:31:16.828186+00', '2026-05-11 05:31:16.828186+00'),
	('PIX', 'MERCADO_PAGO', 'Pix', 'PIX', true, 20, true, false, false, 'Pix processado pelo Mercado Pago.', '{"brickPaymentMethod": "bankTransfer", "providerPaymentMethodId": "pix"}', '2026-05-11 05:31:16.828186+00', '2026-05-11 05:31:16.828186+00'),
	('CREDIT_CARD', 'MERCADO_PAGO', 'Cartao de credito', 'CREDIT_CARD', true, 30, true, true, false, 'Cartao tokenizado pelo Brick oficial do Mercado Pago.', '{"brickPaymentMethod": "creditCard"}', '2026-05-11 05:31:16.828186+00', '2026-05-11 05:31:16.828186+00'),
	('DEBIT_CARD', 'MERCADO_PAGO', 'Cartao de debito', 'DEBIT_CARD', true, 40, true, true, false, 'Disponibilidade depende dos meios liberados na conta Mercado Pago no Brasil.', '{"brickPaymentMethod": "debitCard"}', '2026-05-11 05:31:16.828186+00', '2026-05-11 05:31:16.828186+00'),
	('MERCADO_PAGO_WALLET', 'MERCADO_PAGO', 'Conta Mercado Pago', NULL, false, 50, true, false, false, 'Preparado para Wallet Brick/preferencia Mercado Pago; ativar apos configurar preferencia e retorno.', '{"brick": "wallet"}', '2026-05-11 05:31:16.828186+00', '2026-05-11 05:31:16.828186+00'),
	('GOOGLE_PAY', 'MERCADO_PAGO', 'Google Pay', 'CREDIT_CARD', false, 60, true, true, true, 'Aguardando suporte oficial confirmado do Mercado Pago para checkout online Brasil.', '{"wallet": "google_pay"}', '2026-05-11 05:31:16.828186+00', '2026-05-11 05:31:16.828186+00'),
	('APPLE_PAY', 'MERCADO_PAGO', 'Apple Pay', 'CREDIT_CARD', false, 70, true, true, true, 'Aguardando suporte oficial confirmado do Mercado Pago para checkout online Brasil.', '{"wallet": "apple_pay"}', '2026-05-11 05:31:16.828186+00', '2026-05-11 05:31:16.828186+00'),
	('NUPAY', 'NUPAY', 'NuPay', 'CREDIT_CARD', false, 80, true, true, true, 'Reservado para fase futura, fora do Mercado Pago.', '{"future": true}', '2026-05-11 05:31:16.828186+00', '2026-05-11 05:31:16.828186+00');


--
-- Data for Name: payment_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."payments" ("id", "order_id", "amount", "payment_method", "payment_status", "received_by", "notes", "created_at") VALUES
	('b4a7362a-8d2c-4144-8126-7071967e4fb6', '27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', 25.00, 'COURTESY', 'COURTESY', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', NULL, '2026-05-15 23:55:29.757605+00'),
	('eb4d84c8-4ca0-49b4-b902-97f3e53a7335', 'aa1fc2d7-0384-4de5-845d-55735d1b0389', 20.00, 'PIX', 'PAID', 'c3ec7692-8947-419a-adff-78b187124575', NULL, '2026-05-16 00:28:52.403024+00');


--
-- Data for Name: printer_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: product_addons; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."product_addons" ("product_id", "addon_id", "is_required", "max_quantity", "created_at") VALUES
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', 'ba8f12f3-58a4-4b78-bafa-c87c4080c815', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '6855a0c8-9aa5-4fa6-b1fc-1a8e4d001aae', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '805245c5-bf1e-4465-a5a6-c8134b47cdeb', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '65a87879-8577-4de2-94f3-7b2579952649', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '9b579dfa-fd3a-4d6f-85f6-582b7f466ff1', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '954ebf0d-bda7-483c-a744-eaf453924348', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '2290b91c-2b61-4689-9605-32a81319d25c', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '9be1d846-786e-438f-8b4d-2c4216639b42', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '11688d22-91a3-469c-ad74-e31b290de26a', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '57de54ec-825c-41d1-b5cc-4c6c12ce08a4', false, 1, '2026-05-06 21:55:22.207165+00'),
	('736d47c6-f957-475d-8dc5-3d50a206d6f2', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('25f3b997-90d4-452a-a144-abc1636aaf6c', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3aaf1d94-e327-4601-8109-d4ab952ce525', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('e02b09b0-852c-4a2c-ba9c-47fc7b174807', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5c1f517c-42e9-421d-83df-3b43fb7640b8', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60b95925-b3cf-40e5-88dc-f33937a03b0b', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('dbd31f6a-665d-4341-9f60-881a817d30da', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('60bd4ed4-7583-482c-bf1b-9ebb44c24591', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('55fa9957-c49c-4fda-b7ba-90722fd0a984', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('065031c9-9964-40ac-8a45-aba9f6fc9104', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('2a9b633e-550f-4e44-94c7-4cae886b3ae0', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1efdd14a-4cae-4328-8fb5-ef300bde0a02', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('6386d0fa-daa4-4f33-9a3c-105134bf6aed', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('eb544e0d-edfa-4951-bd2c-c002803bae1a', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('405f7d75-f8b1-4d7d-9200-ac2849b3b302', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('22365660-8bab-4739-8cf5-7324187bbda8', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('374ca14e-bb3c-4d87-81a8-48007b11bc0d', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5383b9e7-f333-4275-ada1-2a5bd75dc25c', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('05d958f4-6fd9-496c-893f-662723cefc2c', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1f118fab-7bad-4119-863a-816124ca7740', '3eea6e30-7bdf-420d-b9d9-64fc96911279', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ed1947de-f3ea-4414-9bcf-f881c657c26a', 'd7cf2c5c-48c6-4688-9ca4-efe8f628a660', false, 1, '2026-05-06 21:55:22.207165+00'),
	('a82d9585-d6a6-49d7-97d8-722222229a08', 'd7cf2c5c-48c6-4688-9ca4-efe8f628a660', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5b9f440f-6e5f-4665-bea0-e623a39b6be6', 'd7cf2c5c-48c6-4688-9ca4-efe8f628a660', false, 1, '2026-05-06 21:55:22.207165+00'),
	('b0f78fa2-0e32-416f-9c58-3498dbb11fa1', 'd7cf2c5c-48c6-4688-9ca4-efe8f628a660', false, 1, '2026-05-06 21:55:22.207165+00'),
	('43133eda-7c11-4b2f-906d-ea5763377b47', 'd7cf2c5c-48c6-4688-9ca4-efe8f628a660', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1b538c4e-59e1-4233-97fe-fcb05de8fdb9', 'd7cf2c5c-48c6-4688-9ca4-efe8f628a660', false, 1, '2026-05-06 21:55:22.207165+00'),
	('157c326d-1e8a-481b-a25d-2bf80706cd5b', 'd7cf2c5c-48c6-4688-9ca4-efe8f628a660', false, 1, '2026-05-06 21:55:22.207165+00'),
	('0c2dff90-d9e3-425b-b0b6-3294a363c272', 'd7cf2c5c-48c6-4688-9ca4-efe8f628a660', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ebbc0901-8026-4100-a095-a4787a706eb9', 'd7cf2c5c-48c6-4688-9ca4-efe8f628a660', false, 1, '2026-05-06 21:55:22.207165+00'),
	('73f2e6f4-f9ce-43eb-9c04-c04269ecd4f3', 'd7cf2c5c-48c6-4688-9ca4-efe8f628a660', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ed1947de-f3ea-4414-9bcf-f881c657c26a', '43c7a484-9d49-4253-88b8-f787b85ed31f', false, 1, '2026-05-06 21:55:22.207165+00'),
	('a82d9585-d6a6-49d7-97d8-722222229a08', '43c7a484-9d49-4253-88b8-f787b85ed31f', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5b9f440f-6e5f-4665-bea0-e623a39b6be6', '43c7a484-9d49-4253-88b8-f787b85ed31f', false, 1, '2026-05-06 21:55:22.207165+00'),
	('b0f78fa2-0e32-416f-9c58-3498dbb11fa1', '43c7a484-9d49-4253-88b8-f787b85ed31f', false, 1, '2026-05-06 21:55:22.207165+00'),
	('43133eda-7c11-4b2f-906d-ea5763377b47', '43c7a484-9d49-4253-88b8-f787b85ed31f', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1b538c4e-59e1-4233-97fe-fcb05de8fdb9', '43c7a484-9d49-4253-88b8-f787b85ed31f', false, 1, '2026-05-06 21:55:22.207165+00'),
	('157c326d-1e8a-481b-a25d-2bf80706cd5b', '43c7a484-9d49-4253-88b8-f787b85ed31f', false, 1, '2026-05-06 21:55:22.207165+00'),
	('0c2dff90-d9e3-425b-b0b6-3294a363c272', '43c7a484-9d49-4253-88b8-f787b85ed31f', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ebbc0901-8026-4100-a095-a4787a706eb9', '43c7a484-9d49-4253-88b8-f787b85ed31f', false, 1, '2026-05-06 21:55:22.207165+00'),
	('73f2e6f4-f9ce-43eb-9c04-c04269ecd4f3', '43c7a484-9d49-4253-88b8-f787b85ed31f', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ed1947de-f3ea-4414-9bcf-f881c657c26a', 'f61e450f-60e8-4f79-b86b-af5322886890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('a82d9585-d6a6-49d7-97d8-722222229a08', 'f61e450f-60e8-4f79-b86b-af5322886890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5b9f440f-6e5f-4665-bea0-e623a39b6be6', 'f61e450f-60e8-4f79-b86b-af5322886890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('b0f78fa2-0e32-416f-9c58-3498dbb11fa1', 'f61e450f-60e8-4f79-b86b-af5322886890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('43133eda-7c11-4b2f-906d-ea5763377b47', 'f61e450f-60e8-4f79-b86b-af5322886890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1b538c4e-59e1-4233-97fe-fcb05de8fdb9', 'f61e450f-60e8-4f79-b86b-af5322886890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('157c326d-1e8a-481b-a25d-2bf80706cd5b', 'f61e450f-60e8-4f79-b86b-af5322886890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('0c2dff90-d9e3-425b-b0b6-3294a363c272', 'f61e450f-60e8-4f79-b86b-af5322886890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ebbc0901-8026-4100-a095-a4787a706eb9', 'f61e450f-60e8-4f79-b86b-af5322886890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('73f2e6f4-f9ce-43eb-9c04-c04269ecd4f3', 'f61e450f-60e8-4f79-b86b-af5322886890', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ed1947de-f3ea-4414-9bcf-f881c657c26a', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('a82d9585-d6a6-49d7-97d8-722222229a08', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5b9f440f-6e5f-4665-bea0-e623a39b6be6', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('b0f78fa2-0e32-416f-9c58-3498dbb11fa1', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('43133eda-7c11-4b2f-906d-ea5763377b47', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1b538c4e-59e1-4233-97fe-fcb05de8fdb9', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('157c326d-1e8a-481b-a25d-2bf80706cd5b', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('0c2dff90-d9e3-425b-b0b6-3294a363c272', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ebbc0901-8026-4100-a095-a4787a706eb9', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('73f2e6f4-f9ce-43eb-9c04-c04269ecd4f3', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ed1947de-f3ea-4414-9bcf-f881c657c26a', '82ef8754-d80a-4505-94ea-4573112e4eda', false, 1, '2026-05-06 21:55:22.207165+00'),
	('a82d9585-d6a6-49d7-97d8-722222229a08', '82ef8754-d80a-4505-94ea-4573112e4eda', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5b9f440f-6e5f-4665-bea0-e623a39b6be6', '82ef8754-d80a-4505-94ea-4573112e4eda', false, 1, '2026-05-06 21:55:22.207165+00'),
	('b0f78fa2-0e32-416f-9c58-3498dbb11fa1', '82ef8754-d80a-4505-94ea-4573112e4eda', false, 1, '2026-05-06 21:55:22.207165+00'),
	('43133eda-7c11-4b2f-906d-ea5763377b47', '82ef8754-d80a-4505-94ea-4573112e4eda', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1b538c4e-59e1-4233-97fe-fcb05de8fdb9', '82ef8754-d80a-4505-94ea-4573112e4eda', false, 1, '2026-05-06 21:55:22.207165+00'),
	('157c326d-1e8a-481b-a25d-2bf80706cd5b', '82ef8754-d80a-4505-94ea-4573112e4eda', false, 1, '2026-05-06 21:55:22.207165+00'),
	('0c2dff90-d9e3-425b-b0b6-3294a363c272', '82ef8754-d80a-4505-94ea-4573112e4eda', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ebbc0901-8026-4100-a095-a4787a706eb9', '82ef8754-d80a-4505-94ea-4573112e4eda', false, 1, '2026-05-06 21:55:22.207165+00'),
	('73f2e6f4-f9ce-43eb-9c04-c04269ecd4f3', '82ef8754-d80a-4505-94ea-4573112e4eda', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ed1947de-f3ea-4414-9bcf-f881c657c26a', 'a618df1b-1e43-4e42-8a22-8d27aed68874', false, 1, '2026-05-06 21:55:22.207165+00'),
	('a82d9585-d6a6-49d7-97d8-722222229a08', 'a618df1b-1e43-4e42-8a22-8d27aed68874', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5b9f440f-6e5f-4665-bea0-e623a39b6be6', 'a618df1b-1e43-4e42-8a22-8d27aed68874', false, 1, '2026-05-06 21:55:22.207165+00'),
	('b0f78fa2-0e32-416f-9c58-3498dbb11fa1', 'a618df1b-1e43-4e42-8a22-8d27aed68874', false, 1, '2026-05-06 21:55:22.207165+00'),
	('43133eda-7c11-4b2f-906d-ea5763377b47', 'a618df1b-1e43-4e42-8a22-8d27aed68874', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1b538c4e-59e1-4233-97fe-fcb05de8fdb9', 'a618df1b-1e43-4e42-8a22-8d27aed68874', false, 1, '2026-05-06 21:55:22.207165+00'),
	('157c326d-1e8a-481b-a25d-2bf80706cd5b', 'a618df1b-1e43-4e42-8a22-8d27aed68874', false, 1, '2026-05-06 21:55:22.207165+00'),
	('0c2dff90-d9e3-425b-b0b6-3294a363c272', 'a618df1b-1e43-4e42-8a22-8d27aed68874', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ebbc0901-8026-4100-a095-a4787a706eb9', 'a618df1b-1e43-4e42-8a22-8d27aed68874', false, 1, '2026-05-06 21:55:22.207165+00'),
	('73f2e6f4-f9ce-43eb-9c04-c04269ecd4f3', 'a618df1b-1e43-4e42-8a22-8d27aed68874', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ed1947de-f3ea-4414-9bcf-f881c657c26a', '84c6e73e-f6cf-4ee7-889d-7cc059bab043', false, 1, '2026-05-06 21:55:22.207165+00'),
	('a82d9585-d6a6-49d7-97d8-722222229a08', '84c6e73e-f6cf-4ee7-889d-7cc059bab043', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5b9f440f-6e5f-4665-bea0-e623a39b6be6', '84c6e73e-f6cf-4ee7-889d-7cc059bab043', false, 1, '2026-05-06 21:55:22.207165+00'),
	('b0f78fa2-0e32-416f-9c58-3498dbb11fa1', '84c6e73e-f6cf-4ee7-889d-7cc059bab043', false, 1, '2026-05-06 21:55:22.207165+00'),
	('43133eda-7c11-4b2f-906d-ea5763377b47', '84c6e73e-f6cf-4ee7-889d-7cc059bab043', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1b538c4e-59e1-4233-97fe-fcb05de8fdb9', '84c6e73e-f6cf-4ee7-889d-7cc059bab043', false, 1, '2026-05-06 21:55:22.207165+00'),
	('157c326d-1e8a-481b-a25d-2bf80706cd5b', '84c6e73e-f6cf-4ee7-889d-7cc059bab043', false, 1, '2026-05-06 21:55:22.207165+00'),
	('0c2dff90-d9e3-425b-b0b6-3294a363c272', '84c6e73e-f6cf-4ee7-889d-7cc059bab043', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ebbc0901-8026-4100-a095-a4787a706eb9', '84c6e73e-f6cf-4ee7-889d-7cc059bab043', false, 1, '2026-05-06 21:55:22.207165+00'),
	('73f2e6f4-f9ce-43eb-9c04-c04269ecd4f3', '84c6e73e-f6cf-4ee7-889d-7cc059bab043', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ed1947de-f3ea-4414-9bcf-f881c657c26a', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('a82d9585-d6a6-49d7-97d8-722222229a08', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5b9f440f-6e5f-4665-bea0-e623a39b6be6', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('b0f78fa2-0e32-416f-9c58-3498dbb11fa1', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('43133eda-7c11-4b2f-906d-ea5763377b47', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('1b538c4e-59e1-4233-97fe-fcb05de8fdb9', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('157c326d-1e8a-481b-a25d-2bf80706cd5b', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('0c2dff90-d9e3-425b-b0b6-3294a363c272', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('ebbc0901-8026-4100-a095-a4787a706eb9', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('73f2e6f4-f9ce-43eb-9c04-c04269ecd4f3', '510ae551-73a3-4810-8346-4022ab4c4dd9', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5bf4b35f-3417-40b5-9b57-18c4cc887bd4', '6da396a6-cf69-44eb-80c8-f5473e21fc8b', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5bf4b35f-3417-40b5-9b57-18c4cc887bd4', '229a872b-aa41-412d-96b1-0e2a89ae8278', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5bf4b35f-3417-40b5-9b57-18c4cc887bd4', 'b129de6e-b3f1-442e-b0f1-56e8dde00592', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5bf4b35f-3417-40b5-9b57-18c4cc887bd4', 'b2924bb7-aa47-4e4c-856f-7ebcf406e418', false, 1, '2026-05-06 21:55:22.207165+00'),
	('5bf4b35f-3417-40b5-9b57-18c4cc887bd4', 'd012e3b2-14bb-451c-8817-5e8761aba890', false, 1, '2026-05-06 21:55:22.207165+00');


--
-- Data for Name: product_ingredients; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."product_ingredients" ("id", "product_id", "ingredient_id", "created_at") VALUES
	('c24af25e-e386-426c-8c35-6ab04efef271', '736d47c6-f957-475d-8dc5-3d50a206d6f2', '283c5e01-9edf-4ed6-a8ea-2ce961bb4a72', '2026-05-06 21:55:22.207165+00'),
	('306b7368-06dc-4f62-9be1-7697411b60db', '736d47c6-f957-475d-8dc5-3d50a206d6f2', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('df0a4564-1e45-4a07-a01b-08ba3300873d', '879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '283c5e01-9edf-4ed6-a8ea-2ce961bb4a72', '2026-05-06 21:55:22.207165+00'),
	('3d2720a8-7b67-46ac-ba90-b4ced1b1538f', '879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('e9b66363-315e-4a6c-ac7a-60704527ea10', '879c2edc-13f7-4a58-8cc4-8ba31b9ead0d', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('5246e338-4d21-44c6-bf9e-292c4aede7f0', '25f3b997-90d4-452a-a144-abc1636aaf6c', '283c5e01-9edf-4ed6-a8ea-2ce961bb4a72', '2026-05-06 21:55:22.207165+00'),
	('e935818d-b5dd-4d4c-b96d-7f1ed09e30a4', '25f3b997-90d4-452a-a144-abc1636aaf6c', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('d4a11439-68be-4321-a10d-eaa6d408df14', '25f3b997-90d4-452a-a144-abc1636aaf6c', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('367ae0a7-2d66-4cbd-a027-aa1f23ae7c9d', '25f3b997-90d4-452a-a144-abc1636aaf6c', 'fdc9c5cc-1a16-48ed-b438-0b6b411f5fab', '2026-05-06 21:55:22.207165+00'),
	('861dbabe-6b7f-4c93-9f4c-1b7e053667de', '3aaf1d94-e327-4601-8109-d4ab952ce525', '283c5e01-9edf-4ed6-a8ea-2ce961bb4a72', '2026-05-06 21:55:22.207165+00'),
	('3540e32e-696a-49c7-82bd-e4604901e045', '3aaf1d94-e327-4601-8109-d4ab952ce525', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('e0470d20-e539-4c27-9426-ebd46b79292b', '3aaf1d94-e327-4601-8109-d4ab952ce525', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('d7b62f3a-b3e8-4946-a732-b4a5ae7273f8', '3aaf1d94-e327-4601-8109-d4ab952ce525', 'fdc9c5cc-1a16-48ed-b438-0b6b411f5fab', '2026-05-06 21:55:22.207165+00'),
	('e4b341b8-8bb6-472c-b00f-c53d4c1c81fe', '3aaf1d94-e327-4601-8109-d4ab952ce525', 'f34c860c-3584-4a8b-ac83-b511a9d26c57', '2026-05-06 21:55:22.207165+00'),
	('db4c6b37-f095-4493-af60-82d133ac9dad', '3aaf1d94-e327-4601-8109-d4ab952ce525', '0ce3d97b-62f1-4e3d-8859-729756285bd7', '2026-05-06 21:55:22.207165+00'),
	('ed2e7f5f-1913-4534-b694-10a3c11a4767', 'e02b09b0-852c-4a2c-ba9c-47fc7b174807', 'cc78d045-f56c-46b0-9df5-726490dd6213', '2026-05-06 21:55:22.207165+00'),
	('2a113373-ad93-440a-95ba-705ea383b587', 'e02b09b0-852c-4a2c-ba9c-47fc7b174807', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('4e496f39-c97b-4b1c-a624-ac87b5b181f5', '5c1f517c-42e9-421d-83df-3b43fb7640b8', 'cc78d045-f56c-46b0-9df5-726490dd6213', '2026-05-06 21:55:22.207165+00'),
	('61a914ae-b59c-4eac-a130-9f45bddf77c2', '5c1f517c-42e9-421d-83df-3b43fb7640b8', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('e04d2c6e-ba5a-427f-bd2e-fb2c8e91797f', '5c1f517c-42e9-421d-83df-3b43fb7640b8', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('bf43fae0-a7d2-4c74-8f4f-d32b02637dd3', '60b95925-b3cf-40e5-88dc-f33937a03b0b', 'cc78d045-f56c-46b0-9df5-726490dd6213', '2026-05-06 21:55:22.207165+00'),
	('78d78f7c-aeff-4de0-99c6-eb2db0b20fbb', '60b95925-b3cf-40e5-88dc-f33937a03b0b', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('00bc9bef-5eaf-4be1-8cf0-bef666a66d26', '60b95925-b3cf-40e5-88dc-f33937a03b0b', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('0d0f3537-8626-4b51-a9ac-0badc6c57db7', '60b95925-b3cf-40e5-88dc-f33937a03b0b', 'fdc9c5cc-1a16-48ed-b438-0b6b411f5fab', '2026-05-06 21:55:22.207165+00'),
	('0610bddb-8a1c-4fbb-a9b4-d02e92a48211', 'dbd31f6a-665d-4341-9f60-881a817d30da', 'cc78d045-f56c-46b0-9df5-726490dd6213', '2026-05-06 21:55:22.207165+00'),
	('bde098ef-99db-4d9e-a93c-6ffa210a9072', 'dbd31f6a-665d-4341-9f60-881a817d30da', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('fb6d6b68-e954-4f7b-bf79-916ab0aec86c', 'dbd31f6a-665d-4341-9f60-881a817d30da', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('6970997b-2a89-4829-b65f-9c995339ebb6', 'dbd31f6a-665d-4341-9f60-881a817d30da', 'fdc9c5cc-1a16-48ed-b438-0b6b411f5fab', '2026-05-06 21:55:22.207165+00'),
	('0551c923-df67-4471-9a33-ca6e0d64a225', 'dbd31f6a-665d-4341-9f60-881a817d30da', 'f34c860c-3584-4a8b-ac83-b511a9d26c57', '2026-05-06 21:55:22.207165+00'),
	('07123cb9-4614-48b7-bcb7-d5f59898fada', 'dbd31f6a-665d-4341-9f60-881a817d30da', '0ce3d97b-62f1-4e3d-8859-729756285bd7', '2026-05-06 21:55:22.207165+00'),
	('89d1c5aa-5335-4cdb-b0f8-31f25da507b0', '60bd4ed4-7583-482c-bf1b-9ebb44c24591', 'b64f420c-0159-4beb-94bf-072e24dd7edc', '2026-05-06 21:55:22.207165+00'),
	('268d321d-6c85-49b6-aeeb-7c62f0e81c56', '60bd4ed4-7583-482c-bf1b-9ebb44c24591', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('1608f8f9-4b67-4435-bcec-29d23b3e4bad', '7d5859d9-2bcf-4432-ba3e-8b9989a7995d', 'b64f420c-0159-4beb-94bf-072e24dd7edc', '2026-05-06 21:55:22.207165+00'),
	('e26c0327-0953-4584-8369-8e4f772c8390', '7d5859d9-2bcf-4432-ba3e-8b9989a7995d', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('5e5093aa-cade-415c-98ba-3059867cca44', '7d5859d9-2bcf-4432-ba3e-8b9989a7995d', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('ddb5845b-f206-496d-93a9-a62b7d445be3', '278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', 'b64f420c-0159-4beb-94bf-072e24dd7edc', '2026-05-06 21:55:22.207165+00'),
	('dea1516d-df95-4dde-97cb-a5812a5b0b45', '278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('742a5b51-a791-40f8-a7ff-eec3ddfb64ad', '278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('8388b20e-6606-415b-af29-a0a5fd56b07d', '278e8ef3-bcd9-46dc-a8b1-6cf6885f7aef', 'fdc9c5cc-1a16-48ed-b438-0b6b411f5fab', '2026-05-06 21:55:22.207165+00'),
	('6bad5be3-28be-48b8-940b-02296129567e', 'c7dccb22-01d7-4de2-97d2-c0b15dc5251c', 'b64f420c-0159-4beb-94bf-072e24dd7edc', '2026-05-06 21:55:22.207165+00'),
	('e7a6c79c-0640-4212-af6d-a6ab4d594861', 'c7dccb22-01d7-4de2-97d2-c0b15dc5251c', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('11f2c1ed-81f0-439c-a1ee-95f82cc4887c', 'c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('30c3060a-1ccd-4803-979b-c63b6e4f127e', 'c7dccb22-01d7-4de2-97d2-c0b15dc5251c', 'fdc9c5cc-1a16-48ed-b438-0b6b411f5fab', '2026-05-06 21:55:22.207165+00'),
	('389d92aa-588e-4f1a-b2f2-22df5bf7bdc5', 'c7dccb22-01d7-4de2-97d2-c0b15dc5251c', 'f34c860c-3584-4a8b-ac83-b511a9d26c57', '2026-05-06 21:55:22.207165+00'),
	('32fee299-732e-4c7f-bc43-c3e76c36d8ff', 'c7dccb22-01d7-4de2-97d2-c0b15dc5251c', '0ce3d97b-62f1-4e3d-8859-729756285bd7', '2026-05-06 21:55:22.207165+00'),
	('351984a0-5ff8-4e42-88db-08a9d9769292', '55fa9957-c49c-4fda-b7ba-90722fd0a984', '0274eba8-742c-423c-9702-ab96baaad8f7', '2026-05-06 21:55:22.207165+00'),
	('5b776e56-9146-4764-8be6-05b9e88a7b47', '55fa9957-c49c-4fda-b7ba-90722fd0a984', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('d7c6c490-6c95-4c33-aa3b-e7dbff374821', '065031c9-9964-40ac-8a45-aba9f6fc9104', '0274eba8-742c-423c-9702-ab96baaad8f7', '2026-05-06 21:55:22.207165+00'),
	('9f3b1c39-0dc0-48fb-8d79-a6b63f40cebc', '065031c9-9964-40ac-8a45-aba9f6fc9104', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('6a34e45e-d563-434e-9aa9-4f7ba04e6d2c', '065031c9-9964-40ac-8a45-aba9f6fc9104', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('b88f5f37-4f36-46f6-b612-bde5c3508f69', '2a9b633e-550f-4e44-94c7-4cae886b3ae0', '0274eba8-742c-423c-9702-ab96baaad8f7', '2026-05-06 21:55:22.207165+00'),
	('f0e762ea-33d9-430b-bbfc-a24256f28cd0', '2a9b633e-550f-4e44-94c7-4cae886b3ae0', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('66daf2cc-89fc-4afd-bf8a-544a13af65e3', '2a9b633e-550f-4e44-94c7-4cae886b3ae0', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('74ed2c7c-6d48-475b-ab95-11233405ab17', '2a9b633e-550f-4e44-94c7-4cae886b3ae0', 'fdc9c5cc-1a16-48ed-b438-0b6b411f5fab', '2026-05-06 21:55:22.207165+00'),
	('880fb7f4-6cd0-4228-a526-2a46855760d9', '1efdd14a-4cae-4328-8fb5-ef300bde0a02', '0274eba8-742c-423c-9702-ab96baaad8f7', '2026-05-06 21:55:22.207165+00'),
	('bf7a59ed-fdb6-49a0-b4c8-375a72468efc', '1efdd14a-4cae-4328-8fb5-ef300bde0a02', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('fde652d2-c0e9-44cc-942c-a9e9ead7b273', '1efdd14a-4cae-4328-8fb5-ef300bde0a02', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('fe5e1631-9ebc-4566-9a15-a540965a5e09', '1efdd14a-4cae-4328-8fb5-ef300bde0a02', 'fdc9c5cc-1a16-48ed-b438-0b6b411f5fab', '2026-05-06 21:55:22.207165+00'),
	('9d260ad2-7fc2-48c5-8657-84a938ae7ef4', '1efdd14a-4cae-4328-8fb5-ef300bde0a02', 'f34c860c-3584-4a8b-ac83-b511a9d26c57', '2026-05-06 21:55:22.207165+00'),
	('7e7f063c-3526-4cd0-b68a-59732b60a58f', '1efdd14a-4cae-4328-8fb5-ef300bde0a02', '0ce3d97b-62f1-4e3d-8859-729756285bd7', '2026-05-06 21:55:22.207165+00'),
	('3e5ce40f-cfaf-48d4-907b-a3ad57052ceb', '6386d0fa-daa4-4f33-9a3c-105134bf6aed', 'ad9fb068-bbce-4524-9c84-e82e21662128', '2026-05-06 21:55:22.207165+00'),
	('4c02cbc8-a977-4e18-9d81-1c22b215a0b4', '6386d0fa-daa4-4f33-9a3c-105134bf6aed', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('77b5d515-8e36-45dc-b5c0-ca56b8212350', '3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', 'ad9fb068-bbce-4524-9c84-e82e21662128', '2026-05-06 21:55:22.207165+00'),
	('d4a2ca08-3f89-404f-8dd9-1dd263420675', '3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('4ef52d56-aa2e-4a9f-8e9f-2e41518bcbf1', '3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', '4049a63d-cee6-447a-83a6-79fc8543b6c0', '2026-05-06 21:55:22.207165+00'),
	('8ee1d31d-99e2-4f5d-b14c-e713ca883da0', '3e54e9be-bc0b-4e29-92ac-bab9df9bd0dd', 'f6a65927-ac55-4cf5-8cbf-844b468299de', '2026-05-06 21:55:22.207165+00'),
	('b2abd1b2-3ed3-4c45-bbde-f177632ecc2e', 'eb544e0d-edfa-4951-bd2c-c002803bae1a', 'ad9fb068-bbce-4524-9c84-e82e21662128', '2026-05-06 21:55:22.207165+00'),
	('07fbbf91-513e-464a-97c7-f2833d3bb24b', 'eb544e0d-edfa-4951-bd2c-c002803bae1a', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('c6bf6092-d277-47ea-9d2e-2ca9775bf6fe', 'eb544e0d-edfa-4951-bd2c-c002803bae1a', '63591144-ffb1-415f-9e71-8669e18a164e', '2026-05-06 21:55:22.207165+00'),
	('3a2ace60-1e14-442b-967b-9fb6f635c014', 'eb544e0d-edfa-4951-bd2c-c002803bae1a', '168b09b9-bc3b-4583-94fb-9c639159fefe', '2026-05-06 21:55:22.207165+00'),
	('25da4252-dba7-433f-9710-3b2216396818', 'eb544e0d-edfa-4951-bd2c-c002803bae1a', 'f6a65927-ac55-4cf5-8cbf-844b468299de', '2026-05-06 21:55:22.207165+00'),
	('c9908253-4a45-4b54-8a67-a54dc9f4ffc2', '405f7d75-f8b1-4d7d-9200-ac2849b3b302', 'ad9fb068-bbce-4524-9c84-e82e21662128', '2026-05-06 21:55:22.207165+00'),
	('a081e43a-3e26-427d-a6c1-699c0ed2ceeb', '405f7d75-f8b1-4d7d-9200-ac2849b3b302', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('e305352c-41c4-4c86-bd2e-f5a912075d3c', '405f7d75-f8b1-4d7d-9200-ac2849b3b302', '4049a63d-cee6-447a-83a6-79fc8543b6c0', '2026-05-06 21:55:22.207165+00'),
	('02e35819-5950-47de-b8ab-e31409aba74c', '405f7d75-f8b1-4d7d-9200-ac2849b3b302', 'f6a65927-ac55-4cf5-8cbf-844b468299de', '2026-05-06 21:55:22.207165+00'),
	('d4d79fd3-3c78-4198-8c93-1af1cc235f76', '405f7d75-f8b1-4d7d-9200-ac2849b3b302', 'f34c860c-3584-4a8b-ac83-b511a9d26c57', '2026-05-06 21:55:22.207165+00'),
	('78b516c2-4b59-4515-bf6f-bf7e35ba9cac', '405f7d75-f8b1-4d7d-9200-ac2849b3b302', '0ce3d97b-62f1-4e3d-8859-729756285bd7', '2026-05-06 21:55:22.207165+00'),
	('e8e3b566-3e64-4a94-8c28-9151022e501a', '22365660-8bab-4739-8cf5-7324187bbda8', 'ecb348ac-d2ca-4ded-a531-aa116b6741e1', '2026-05-06 21:55:22.207165+00'),
	('d19480fb-5f66-4a5d-99ab-643deee33138', '22365660-8bab-4739-8cf5-7324187bbda8', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('2774426d-8657-40d0-b080-7e3085ed5843', '22365660-8bab-4739-8cf5-7324187bbda8', '6de8ae0b-5238-456e-9036-c5ec54b2d486', '2026-05-06 21:55:22.207165+00'),
	('91487b49-fd44-4ef5-afd2-2cf2b8768d0d', '7fb4118e-70aa-4973-b0a6-ccbe527c0d50', 'ecb348ac-d2ca-4ded-a531-aa116b6741e1', '2026-05-06 21:55:22.207165+00'),
	('0bd8ff5c-071f-4805-8196-e3d706eee0fc', '7fb4118e-70aa-4973-b0a6-ccbe527c0d50', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('79742ea6-d633-41e1-b098-a383ecdf2e7d', '7fb4118e-70aa-4973-b0a6-ccbe527c0d50', '381fb46e-e691-4022-83fc-f84d537b39e3', '2026-05-06 21:55:22.207165+00'),
	('07382219-54f4-4fbe-bc81-339f25e383aa', '7fb4118e-70aa-4973-b0a6-ccbe527c0d50', 'fdc9c5cc-1a16-48ed-b438-0b6b411f5fab', '2026-05-06 21:55:22.207165+00'),
	('888502c1-a0f7-4111-9391-ff6e52d85c6c', '374ca14e-bb3c-4d87-81a8-48007b11bc0d', 'ecb348ac-d2ca-4ded-a531-aa116b6741e1', '2026-05-06 21:55:22.207165+00'),
	('947afbd6-7059-441c-a83b-f6aa6a8d096b', '374ca14e-bb3c-4d87-81a8-48007b11bc0d', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('eba9db18-14db-4623-bfe4-10c373ed1493', '374ca14e-bb3c-4d87-81a8-48007b11bc0d', '6de8ae0b-5238-456e-9036-c5ec54b2d486', '2026-05-06 21:55:22.207165+00'),
	('8a794478-b53f-4606-9e5c-2bee0a466010', '374ca14e-bb3c-4d87-81a8-48007b11bc0d', '381fb46e-e691-4022-83fc-f84d537b39e3', '2026-05-06 21:55:22.207165+00'),
	('e8f8853e-2a28-4198-8dee-08150f5e268f', '374ca14e-bb3c-4d87-81a8-48007b11bc0d', 'f6a65927-ac55-4cf5-8cbf-844b468299de', '2026-05-06 21:55:22.207165+00'),
	('744c3f62-44ce-4de6-88f2-4e2122816dad', '5383b9e7-f333-4275-ada1-2a5bd75dc25c', 'ecb348ac-d2ca-4ded-a531-aa116b6741e1', '2026-05-06 21:55:22.207165+00'),
	('c3c97b51-794f-4825-a9b6-73f2ae825ac9', '5383b9e7-f333-4275-ada1-2a5bd75dc25c', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('0b916905-ae42-477a-ba8d-f01f66ea92dd', '5383b9e7-f333-4275-ada1-2a5bd75dc25c', '6de8ae0b-5238-456e-9036-c5ec54b2d486', '2026-05-06 21:55:22.207165+00'),
	('cc433889-6078-46fd-b125-6726cbc4818f', '5383b9e7-f333-4275-ada1-2a5bd75dc25c', '381fb46e-e691-4022-83fc-f84d537b39e3', '2026-05-06 21:55:22.207165+00'),
	('a36ca047-5bbe-4dab-9d85-232ae52a82de', '5383b9e7-f333-4275-ada1-2a5bd75dc25c', 'f6a65927-ac55-4cf5-8cbf-844b468299de', '2026-05-06 21:55:22.207165+00'),
	('df336c55-f74d-4d99-b3d8-b450e1779a5c', '5383b9e7-f333-4275-ada1-2a5bd75dc25c', 'f34c860c-3584-4a8b-ac83-b511a9d26c57', '2026-05-06 21:55:22.207165+00'),
	('661d5a02-f5d0-4591-b92a-272ce26dc886', '5383b9e7-f333-4275-ada1-2a5bd75dc25c', '0ce3d97b-62f1-4e3d-8859-729756285bd7', '2026-05-06 21:55:22.207165+00'),
	('5086b513-b1a9-496e-b33f-3d482802d377', '05d958f4-6fd9-496c-893f-662723cefc2c', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('776c1e81-b9c1-4469-a808-a53e2f0f0b7a', '05d958f4-6fd9-496c-893f-662723cefc2c', '0ce3d97b-62f1-4e3d-8859-729756285bd7', '2026-05-06 21:55:22.207165+00'),
	('0a270f70-bde0-42b9-bdb5-0ce8c32078a1', '05d958f4-6fd9-496c-893f-662723cefc2c', '168b09b9-bc3b-4583-94fb-9c639159fefe', '2026-05-06 21:55:22.207165+00'),
	('08bbf88b-d37a-4be9-ab7c-64896fdfd943', '05d958f4-6fd9-496c-893f-662723cefc2c', '6de8ae0b-5238-456e-9036-c5ec54b2d486', '2026-05-06 21:55:22.207165+00'),
	('1c9ed10a-1848-49b2-b657-cd1f82299204', '05d958f4-6fd9-496c-893f-662723cefc2c', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('9412e0e2-caca-48f8-91de-8f8cb20a06aa', '05d958f4-6fd9-496c-893f-662723cefc2c', '4049a63d-cee6-447a-83a6-79fc8543b6c0', '2026-05-06 21:55:22.207165+00'),
	('8123fd5f-6dfe-4cb0-819e-cf9a27366ce1', '05d958f4-6fd9-496c-893f-662723cefc2c', '381fb46e-e691-4022-83fc-f84d537b39e3', '2026-05-06 21:55:22.207165+00'),
	('701cc397-e663-4a75-8e7f-9dc84fc651ac', '05d958f4-6fd9-496c-893f-662723cefc2c', '05143a47-3e05-4a00-b959-08996d156377', '2026-05-06 21:55:22.207165+00'),
	('686929db-4b85-41f1-bde9-1d5f9c350644', '1f118fab-7bad-4119-863a-816124ca7740', '283c5e01-9edf-4ed6-a8ea-2ce961bb4a72', '2026-05-06 21:55:22.207165+00'),
	('a1876c5a-6b66-405c-ba5e-d85c55b021de', '1f118fab-7bad-4119-863a-816124ca7740', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('3e7be4a0-39fb-4863-9764-b75f16f32392', '1f118fab-7bad-4119-863a-816124ca7740', 'cc78d045-f56c-46b0-9df5-726490dd6213', '2026-05-06 21:55:22.207165+00'),
	('baed75de-3a79-4b05-9607-2618fbd377dc', '1f118fab-7bad-4119-863a-816124ca7740', 'b64f420c-0159-4beb-94bf-072e24dd7edc', '2026-05-06 21:55:22.207165+00'),
	('bf637ef2-d0dd-44d3-851c-0a0f542925cc', '1f118fab-7bad-4119-863a-816124ca7740', '1f624732-b4a4-4ac6-94f7-4ab557ece771', '2026-05-06 21:55:22.207165+00'),
	('19bf4c3e-4176-4d5d-ab5a-eb49b91a97e9', '1f118fab-7bad-4119-863a-816124ca7740', 'f34c860c-3584-4a8b-ac83-b511a9d26c57', '2026-05-06 21:55:22.207165+00'),
	('eb5f6652-bfdb-4529-809e-6638098837da', '1f118fab-7bad-4119-863a-816124ca7740', '0ce3d97b-62f1-4e3d-8859-729756285bd7', '2026-05-06 21:55:22.207165+00'),
	('b74a3588-5ebc-4baf-9bfb-a7770bb4b7f6', '1f118fab-7bad-4119-863a-816124ca7740', '15cc7c24-7ef3-437f-ae04-561f0ee14ea7', '2026-05-06 21:55:22.207165+00'),
	('92b95fe2-7fef-4494-874f-a235504a4334', '1f118fab-7bad-4119-863a-816124ca7740', 'fdc9c5cc-1a16-48ed-b438-0b6b411f5fab', '2026-05-06 21:55:22.207165+00'),
	('9dab5cff-8279-42f4-89d9-9fceb5cfed2c', 'ed1947de-f3ea-4414-9bcf-f881c657c26a', 'ee3e0642-ff05-4f4c-ba53-4b7946c9d31d', '2026-05-06 21:55:22.207165+00'),
	('6c35c26b-9e24-4944-86f0-0860062e8d6f', 'ed1947de-f3ea-4414-9bcf-f881c657c26a', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('4cfd8792-df1e-489f-b52f-45c51db012f7', 'ed1947de-f3ea-4414-9bcf-f881c657c26a', 'cd527f84-c7fd-40af-9292-528f71fe3974', '2026-05-06 21:55:22.207165+00'),
	('61c10b27-b94e-477d-b5ac-a1f00d8a6b93', 'ed1947de-f3ea-4414-9bcf-f881c657c26a', '0e3943b6-03cd-419d-b60c-70fcbab56bff', '2026-05-06 21:55:22.207165+00'),
	('b56c1e51-3bd7-4766-a834-cf1fe15275d5', 'a82d9585-d6a6-49d7-97d8-722222229a08', 'ee3e0642-ff05-4f4c-ba53-4b7946c9d31d', '2026-05-06 21:55:22.207165+00'),
	('8a2ca638-b1e7-4a2a-8b4f-416645b1f19c', 'a82d9585-d6a6-49d7-97d8-722222229a08', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('e3f62f50-ff44-4fa1-9a50-05aaef30f2bc', 'a82d9585-d6a6-49d7-97d8-722222229a08', 'cd527f84-c7fd-40af-9292-528f71fe3974', '2026-05-06 21:55:22.207165+00'),
	('b561736b-df3a-47bf-9cd1-642c062da2bb', 'a82d9585-d6a6-49d7-97d8-722222229a08', '0e3943b6-03cd-419d-b60c-70fcbab56bff', '2026-05-06 21:55:22.207165+00'),
	('c076eb00-c836-409c-b43f-428c86b87795', 'a82d9585-d6a6-49d7-97d8-722222229a08', '19bd6830-3a7d-4c3e-891d-38c95320e2ed', '2026-05-06 21:55:22.207165+00'),
	('be7bb686-0070-4e09-9bf7-001a0305dc91', '5b9f440f-6e5f-4665-bea0-e623a39b6be6', 'ee3e0642-ff05-4f4c-ba53-4b7946c9d31d', '2026-05-06 21:55:22.207165+00'),
	('95d6af7b-f000-4a29-86e6-5ceac38f2d98', '5b9f440f-6e5f-4665-bea0-e623a39b6be6', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('a53388b6-2118-497b-9d8a-ea58a4e2895d', '5b9f440f-6e5f-4665-bea0-e623a39b6be6', 'cd527f84-c7fd-40af-9292-528f71fe3974', '2026-05-06 21:55:22.207165+00'),
	('d6770e33-d111-4b55-b526-20235a2a900d', '5b9f440f-6e5f-4665-bea0-e623a39b6be6', '0e3943b6-03cd-419d-b60c-70fcbab56bff', '2026-05-06 21:55:22.207165+00'),
	('361ee637-199a-454c-8d8c-c255ee23c41c', '5b9f440f-6e5f-4665-bea0-e623a39b6be6', '24606c2c-8e4f-4c32-9368-d9449fef41f8', '2026-05-06 21:55:22.207165+00'),
	('31dd5bc3-9d02-44d6-88e7-66b8940b1de3', 'b0f78fa2-0e32-416f-9c58-3498dbb11fa1', 'ee3e0642-ff05-4f4c-ba53-4b7946c9d31d', '2026-05-06 21:55:22.207165+00'),
	('01861b99-1a2d-4605-80d1-bfecbb256c02', 'b0f78fa2-0e32-416f-9c58-3498dbb11fa1', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('f3fe2c42-f7a2-4a74-a4d2-be3bba20a8c1', 'b0f78fa2-0e32-416f-9c58-3498dbb11fa1', 'cd527f84-c7fd-40af-9292-528f71fe3974', '2026-05-06 21:55:22.207165+00'),
	('e76c31cd-031f-4210-832a-a66dd9d4d634', 'b0f78fa2-0e32-416f-9c58-3498dbb11fa1', '0e3943b6-03cd-419d-b60c-70fcbab56bff', '2026-05-06 21:55:22.207165+00'),
	('3ad44697-322c-4821-bdca-8e8bc06409ef', 'b0f78fa2-0e32-416f-9c58-3498dbb11fa1', 'd328b7f4-9129-485f-8667-e06179c53b30', '2026-05-06 21:55:22.207165+00'),
	('357a2b02-2134-47c3-98fc-5f582b7ab3d2', '43133eda-7c11-4b2f-906d-ea5763377b47', 'ee3e0642-ff05-4f4c-ba53-4b7946c9d31d', '2026-05-06 21:55:22.207165+00'),
	('0a73c340-0817-412e-8314-f3c4f41d98f8', '43133eda-7c11-4b2f-906d-ea5763377b47', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('d98c63b4-c781-4c93-8cde-d3d07438ee08', '43133eda-7c11-4b2f-906d-ea5763377b47', 'cd527f84-c7fd-40af-9292-528f71fe3974', '2026-05-06 21:55:22.207165+00'),
	('f0dbb743-9a5f-46dd-b5a1-54e51d358aef', '43133eda-7c11-4b2f-906d-ea5763377b47', '0e3943b6-03cd-419d-b60c-70fcbab56bff', '2026-05-06 21:55:22.207165+00'),
	('0535738f-031f-4bd8-9f73-e5162f0e748f', '43133eda-7c11-4b2f-906d-ea5763377b47', '24606c2c-8e4f-4c32-9368-d9449fef41f8', '2026-05-06 21:55:22.207165+00'),
	('563d3b2f-1bee-4d0b-9bc3-94eb7da1fb94', '43133eda-7c11-4b2f-906d-ea5763377b47', 'd328b7f4-9129-485f-8667-e06179c53b30', '2026-05-06 21:55:22.207165+00'),
	('fea258ad-3f13-40c0-a932-f7d84d685780', '1b538c4e-59e1-4233-97fe-fcb05de8fdb9', 'ee3e0642-ff05-4f4c-ba53-4b7946c9d31d', '2026-05-06 21:55:22.207165+00'),
	('60ea04f1-d97c-4a69-9d2d-685e0a2e543a', '1b538c4e-59e1-4233-97fe-fcb05de8fdb9', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('3e1cc781-af84-48c1-a4ea-0d6162e85438', '1b538c4e-59e1-4233-97fe-fcb05de8fdb9', '14aaab7d-50ca-43af-9400-34f5ac40fcc2', '2026-05-06 21:55:22.207165+00'),
	('cccb1c08-5758-4852-82c5-9ee26c87bdeb', '1b538c4e-59e1-4233-97fe-fcb05de8fdb9', 'fb9d4391-b7e3-4471-a1ef-b3062e48c2ec', '2026-05-06 21:55:22.207165+00'),
	('659e7ab0-1e44-442c-99f4-b53b4fe21914', '157c326d-1e8a-481b-a25d-2bf80706cd5b', '66e78471-148a-419a-a6f7-00a8dbfe2d72', '2026-05-06 21:55:22.207165+00'),
	('f6b1e1a1-8a80-4c22-82a0-89ddc9e89e01', '157c326d-1e8a-481b-a25d-2bf80706cd5b', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('215f95f0-7d09-4d16-ad74-a49fe1340243', '157c326d-1e8a-481b-a25d-2bf80706cd5b', '24606c2c-8e4f-4c32-9368-d9449fef41f8', '2026-05-06 21:55:22.207165+00'),
	('d89330b4-d9c9-44c9-8256-7e2c716ed903', '0c2dff90-d9e3-425b-b0b6-3294a363c272', '66e78471-148a-419a-a6f7-00a8dbfe2d72', '2026-05-06 21:55:22.207165+00'),
	('99a9bc22-22ac-4441-bfc4-7c62107387e0', '0c2dff90-d9e3-425b-b0b6-3294a363c272', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('326bc3f3-b7c5-40cc-b5c5-b11da8fa6e18', '0c2dff90-d9e3-425b-b0b6-3294a363c272', '24606c2c-8e4f-4c32-9368-d9449fef41f8', '2026-05-06 21:55:22.207165+00'),
	('11655270-cdab-490a-9ad3-c86df7732243', '0c2dff90-d9e3-425b-b0b6-3294a363c272', 'fb9d4391-b7e3-4471-a1ef-b3062e48c2ec', '2026-05-06 21:55:22.207165+00'),
	('e0352b6c-f17d-4190-a799-f4a2192ae2d4', 'ebbc0901-8026-4100-a095-a4787a706eb9', '66e78471-148a-419a-a6f7-00a8dbfe2d72', '2026-05-06 21:55:22.207165+00'),
	('5478848f-859e-4176-adb3-6c6f8a60bf62', 'ebbc0901-8026-4100-a095-a4787a706eb9', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('901a153f-5b23-4af7-ba08-ad92a3be872c', 'ebbc0901-8026-4100-a095-a4787a706eb9', '14aaab7d-50ca-43af-9400-34f5ac40fcc2', '2026-05-06 21:55:22.207165+00'),
	('35af46ad-9c8e-4f41-8224-df1599cf47d5', 'ebbc0901-8026-4100-a095-a4787a706eb9', 'fb9d4391-b7e3-4471-a1ef-b3062e48c2ec', '2026-05-06 21:55:22.207165+00'),
	('a396b99b-6b1a-47b5-92d3-12dcefadc669', '73f2e6f4-f9ce-43eb-9c04-c04269ecd4f3', 'abb26a38-16c5-4a41-8c2c-1b184e2fbb04', '2026-05-06 21:55:22.207165+00'),
	('b4cf9531-aa7d-4547-bc84-1598be0a428c', '73f2e6f4-f9ce-43eb-9c04-c04269ecd4f3', '17ed4e34-78a7-462b-ab91-49d5ca30a9f3', '2026-05-06 21:55:22.207165+00');


--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."settings" ("key", "value", "updated_at") VALUES
	('printer_poll_interval_ms', '3000', '2026-05-07 12:49:06.275746+00'),
	('printer_character_set', '"PC860_PORTUGUESE"', '2026-05-13 03:17:09.589761+00'),
	('printing_enabled', 'false', '2026-05-15 23:04:25.405821+00'),
	('printer_host', '"192.168.31.67"', '2026-05-15 23:04:25.405821+00'),
	('printer_port', '9100', '2026-05-15 23:04:25.405821+00'),
	('printer_type', '"network"', '2026-05-15 23:04:25.405821+00'),
	('printer_paper_width', '80', '2026-05-15 23:04:25.405821+00'),
	('print_customer_copy', 'true', '2026-05-15 23:04:25.405821+00'),
	('print_kitchen_copy', 'true', '2026-05-15 23:04:25.405821+00'),
	('print_juice_potato_copy', 'true', '2026-05-15 23:04:25.405821+00'),
	('whatsapp_enabled', '"true"', '2026-05-15 23:04:25.405821+00'),
	('whatsapp_template_ready', '"pedido_pronto"', '2026-05-15 23:04:25.405821+00'),
	('whatsapp_template_received', '"novo_pedido"', '2026-05-15 23:04:25.405821+00'),
	('whatsapp_template_language', '"pt_BR"', '2026-05-15 23:04:25.405821+00'),
	('whatsapp_test_phone', '""', '2026-05-15 23:04:25.405821+00'),
	('public_ordering_enabled', 'true', '2026-05-15 23:04:25.405821+00'),
	('public_ordering_start_time', '"00:00"', '2026-05-15 23:04:25.405821+00'),
	('public_ordering_end_time', '"23:59"', '2026-05-15 23:04:25.405821+00'),
	('packaging_fee', '1', '2026-05-15 23:04:25.405821+00'),
	('apply_packaging_fee_for_takeout', 'true', '2026-05-15 23:04:25.405821+00'),
	('print_worker_status', '"ACTIVE"', '2026-05-16 16:21:14.476375+00'),
	('print_worker_last_seen_at', '"2026-05-16T16:21:14.318Z"', '2026-05-16 16:21:14.476375+00'),
	('print_worker_hostname', '"marcoskrep"', '2026-05-16 16:21:14.476375+00'),
	('print_worker_ip', '"192.168.31.12"', '2026-05-16 16:21:14.476375+00'),
	('print_worker_platform', '"linux arm"', '2026-05-16 16:21:14.476375+00'),
	('print_worker_printer_host', '"192.168.31.67"', '2026-05-16 16:21:14.476375+00'),
	('print_worker_printer_port', '9100', '2026-05-16 16:21:14.476375+00'),
	('whatsapp_api_version', '"v21.0"', '2026-05-15 22:27:55.960893+00');


--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."webauthn_credentials" ("id", "user_id", "credential_id", "public_key_jwk", "sign_count", "device_name", "created_at") VALUES
	('52aa0e8d-e81d-4028-afd1-8cea63a00f71', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'LpWXM5u0qNMAJ4N8fl-nJ5BniOziiGqfuK-SSLIgHw0', '{"x": "evALGa4oxSqWzZditm3FxUsWWbgEW8LsrH6LdpCIcIs", "y": "RQ58C6XtaLIHZSHc8WqBw8MBVWJ7AOD2_wOqv3ZZPvM", "crv": "P-256", "kty": "EC"}', 0, 'iPhone/iPad', '2026-05-10 03:59:41.686559+00'),
	('2d7842af-ef76-4500-b224-6f7ccd0eb750', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', '7XU07l8wfWV4IyrFg876u3u7588', '{"x": "Ga09TWyXIpF7Yg7lqKTIuscdPUhXMjLgd1HNQ739sfA", "y": "XRMzKRaahQKqXeh6GTcv9MjBCrtjpwDv_2ZwxmxuPEw", "crv": "P-256", "kty": "EC"}', 0, 'iPhone/iPad', '2026-05-15 23:53:48.126129+00'),
	('75fad907-4b52-4a99-a9e8-322c6848ac0b', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', '3TC5F8J0GepTaRBkUK9mZQ', '{"x": "MUT60SWKMt0VnS1O-YzvH0KMCSMc60NqXrWFT3W6ibY", "y": "GqtOAiQosha101_zmLEUHbFovxX54pwV9_oCwFr0cAs", "crv": "P-256", "kty": "EC"}', 0, 'Android', '2026-05-11 06:21:23.895453+00'),
	('94f1c52c-6b78-4b80-81a7-0c8a21134a76', 'aa374e0e-f4a9-45b0-a18f-dce09d07ed47', 'igLVmVlbdno9If1dhgi5Jw', '{"x": "2plhGS3VMZuZewjzYPfv4PVCVuyfbV_P2TUV4bh7nw0", "y": "tyYCWS9ypJPyy6uMfoj3XbJ0pdUcdxZF9wxAW8WssVE", "crv": "P-256", "kty": "EC"}', 0, 'Dispositivo', '2026-05-10 04:27:17.586216+00'),
	('9be269ee-e50b-44e4-81ff-772bb4ffe2ee', 'c3ec7692-8947-419a-adff-78b187124575', 'oN4v7F5Dohr_x_WyA5HveTVMGyI', '{"x": "LFKYIYDp2OanhnfeLGhwHyiOq0fkMMpgWa6_5E0CxBY", "y": "5GHeT9jzoDa9V_XrDk22tYdiyn1htDTZ38kvqy3KjG0", "crv": "P-256", "kty": "EC"}', 0, 'iPhone/iPad', '2026-05-10 20:02:35.587208+00'),
	('5b84aadd-25eb-4b1c-9a3f-8a1874923e7f', 'c02c3824-379f-42b1-ac82-0b418478b4d6', 'edyGO3fdkkiz8Zyb1TAkvE0scNk', '{"x": "GLcxuB9NiY6F5W2Qld0pAnYdfJZM3FqcRJoSKgFHyQA", "y": "puMP54DaO_jaRr-jwpN761EUIMxE9pMC-xgRpSw3qgE", "crv": "P-256", "kty": "EC"}', 0, 'iPhone/iPad', '2026-05-10 20:07:01.884161+00'),
	('ef27b9e1-582d-4999-8419-5aa6ac9a96d1', '6b7fd3fd-5aa8-4d94-9e0c-e8f47a85af3e', 't5VgKBQyycad68vw3IImMJ8R9Tw', '{"x": "3VuUu-VJeVkCsatP5Z7NpyQh6MI8hSq5PdLASB9IDfU", "y": "6-mLHVjjhovJcD5W-OCrE9sLtPpS2SKssWQF0erNS5E", "crv": "P-256", "kty": "EC"}', 0, 'iPhone/iPad', '2026-05-10 20:18:31.67584+00');


--
-- Data for Name: whatsapp_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."whatsapp_messages" ("id", "order_id", "phone", "message_type", "status", "created_at", "updated_at", "template_name", "payload", "attempts", "last_attempt_at", "error_message", "sent_at", "provider_message_id", "event_type", "scheduled_at", "next_retry_at", "delivery_status", "customer_opt_in", "error_code") VALUES
	('4250d1ce-4ad5-4960-9d1c-8999b1824691', '27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', '+5561982990962', 'order_ready', 'SENT', '2026-05-15 23:57:40.165907+00', '2026-05-15 23:58:11.059856+00', 'pedido_pronto', '{"daily_number": 1, "customer_name": "Emanuel"}', 1, '2026-05-15 23:58:00.364+00', NULL, '2026-05-15 23:58:00.927+00', 'wamid.HBgMNTU2MTgyOTkwOTYyFQIAERgSMjVERDM5MjIxODcyMkI4NkUxAA==', 'order_ready', '2026-05-15 23:57:40.165907+00', NULL, 'READ', true, NULL),
	('58a188cc-9325-431e-8bd2-a67d0f73fa75', 'aa1fc2d7-0384-4de5-845d-55735d1b0389', '+5561992453003', 'order_received', 'FAILED', '2026-05-16 00:28:52.544047+00', '2026-05-16 00:29:00.624425+00', 'novo_pedido', '{"daily_number": 2, "customer_name": "Leda"}', 1, '2026-05-16 00:29:00.321+00', 'Authentication Error', NULL, NULL, 'order_received', '2026-05-16 00:28:52.544047+00', NULL, NULL, true, '190'),
	('ff689d31-6ff6-4460-a564-2fbca8877f6e', '27d83586-9d9c-4f9a-a9c2-b4d866bbdbed', '+5561982990962', 'order_received', 'SENT', '2026-05-15 23:55:29.905439+00', '2026-05-15 23:56:08.67821+00', 'novo_pedido', '{"daily_number": 1, "customer_name": "Emanuel"}', 1, '2026-05-15 23:56:00.399+00', NULL, '2026-05-15 23:56:01.276+00', 'wamid.HBgMNTU2MTgyOTkwOTYyFQIAERgSN0Y1QjNDNUM5MkFCRkM5NTNEAA==', 'order_received', '2026-05-15 23:55:29.905439+00', NULL, 'FAILED_BY_PROVIDER', true, '10'),
	('7ba265de-59e5-42de-8451-2bd2fff73410', 'aa1fc2d7-0384-4de5-845d-55735d1b0389', '+5561992453003', 'order_ready', 'SENT', '2026-05-16 02:08:43.313745+00', '2026-05-16 02:09:11.789243+00', 'pedido_pronto', '{"daily_number": 2, "customer_name": "Leda"}', 1, '2026-05-16 02:09:00.395+00', NULL, '2026-05-16 02:09:00.885+00', 'wamid.HBgMNTU2MTkyNDUzMDAzFQIAERgSRDQ1QTg4MTM1QjIwQkJFODVGAA==', 'order_ready', '2026-05-16 02:08:43.313745+00', NULL, 'DELIVERED', true, NULL);


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 118, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict GuoYXxPUpCq3Bdg0f3MuttnnNCKGqDqT8y3ePAU92OJHkvorowW2S5PUw9QjeR7

RESET ALL;
