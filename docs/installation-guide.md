# Installation

Copy `.env.example` to `.env`; set unique random secrets for JWT and database access. `docker compose up --build` starts PostgreSQL, API and web UI. Open dashboard at `http://localhost:4200` and Swagger at `http://localhost:3000/api/docs`.

Seed demo-only records manually after the API image is built: `docker compose exec backend npx prisma db seed`. Demo logins: `admin@forestguard.demo` / `DemoAdmin!ChangeMe`; `officer@forestguard.demo` / `DemoOfficer!ChangeMe`. These are for local demonstration only.

Native development: backend `cd backend; npm install; npx prisma generate; npx prisma db push; npm run seed; npm run start:dev`. Frontend `cd frontend; npm install; npm start`. Android: open `mobile/` with Android Studio and configure the API endpoint. Do not deploy demo credentials or development CORS settings.
