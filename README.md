Sotahar Poshchim Para Premier League (SPPL)
Official Website & Live Cricket Platform
=========================================

Stack
-----
Frontend : React 18 + Vite + Tailwind CSS + React Router + TanStack Query
           + Framer Motion + React Hook Form + Axios + Firebase SDK
           + react-i18next + vite-plugin-pwa      -> Netlify
Backend  : Node + Express (REST) + Socket.IO + Mongoose -> Render
Database : MongoDB Atlas
Auth     : Firebase Authentication (verified on the server with Firebase Admin SDK)
Media    : Cloudinary (signed uploads)
Language : Bangla + English

Repository layout
-----------------
  shared/   reusable constants, enums, zod schemas, pure cricket math
  client/   React SPA (Netlify)
  server/   Express API + Socket.IO (Render)

Getting started
---------------
  npm install                      # installs all three workspaces
  cp server/.env.example server/.env
  cp client/.env.example client/.env
  npm run seed --workspace=server   # Season 1 data + Season 2 shell
  npm run dev:server               # [localhost](http://localhost:5000)
  npm run dev:client               # [localhost](http://localhost:5173)

Deployment
----------
  client -> Netlify (build: npm run build --workspace=client, publish: client/dist)
  server -> Render  (build: npm install, start: npm run start --workspace=server)

Season model
------------
Every season-bound document carries a `seasonId`, so Season 1, 2, 3 ... coexist
in the same collections with no schema migration.

Current state
-------------
  Season 1 (2026) — COMPLETED. Played 9-10 January 2026. Full squad and fixture
                    record seeded; results are entered from the scorer's sheets.
  Season 2 (2027) — UPCOMING. Created with NO dates and no teams, because the
                    organizers have not announced a date and squads are
                    re-confirmed each season.
