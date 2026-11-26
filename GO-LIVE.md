# გაშვებამდე: რა დარჩა გასაკეთებელი

კლიენტის მხარე (დესკტოპ აპი + ვები) მზადაა, ვერსია **1.0.0**. დარჩენილი სამუშაო ძირითადად სერვერზე და ინფრასტრუქტურაზეა.
ყველა endpoint-ის ზუსტი ფორმატი და SQL — [API.md](API.md).

## 1. სერვერი (FastAPI + PostgreSQL)

**ბაზა**
- [ ] `tickets`: `status` მხოლოდ `new` / `open` / `closed`; `category`; `region` (`reg-<რეგიონი>-*` hostname-იდან); `due_at`; `resolved_at`, `resolved_by_id`; `assignee_id`, `delegated_by_id`, `delegation_note`.
- [ ] ძველი ჩანაწერები: `pending` → `open`, `resolved` → `closed` (API.md → „სტატუსები“) — **append-only trigger-ის ჩართვამდე**.
- [ ] `ticket_history` — append-only (REVOKE + trigger), ინდექსები (API.md → „ისტორია და ჟურნალი“).
- [ ] `sla_policy` — 7 კატეგორია, თავიდან ყველა 24 სთ.
- [ ] `users`: ადმინი და IT სპეციალისტები (ელ-ფოსტა + პაროლის hash, როლი `admin` / `agent`). თანამშრომლები თავად იქმნება პირველ შესვლაზე.

**Endpoint-ები** (ყველა API.md-ის ცხრილშია; ბოლოს დამატებულები ✱)
- [ ] `/api/health`, `/api/auth/login`, `/api/auth/me`, `/api/device/session`
- [ ] `/api/tickets` (GET/POST), `/api/tickets/{id}` (GET/PATCH), `/delegate`, `/return`, `/remote`
- [ ] `/api/agents`, `/api/audit`, `/api/stats` (✱ `team[].closed_today`, `by_origin`)
- [ ] `/api/reports` (✱ `handoffs` — მიწერები და გადაწერები)
- [ ] ✱ `/api/sla` (GET/PUT), ✱ `/api/sla/team` (`TeamReport` + `handoffs`)
- [ ] ✱ `due_at` = `created_at` + კატეგორიის ვადა; კატეგორიის შეცვლისას თავიდან ითვლება.
- [ ] Event Log pipeline (`/api/v1/eventlogs/...`) — უკვე შენია, მხოლოდ შეამოწმე IT-ის token-ით.

**უფლებები** (API.md → „როლები და უფლებები“)
- [ ] device token-ით (`kind=device`) IT endpoint-ები → `403`; `user` როლით ვებ login → `403`.
- [ ] IT სპეციალისტი: მხოლოდ თავისუფალი რიგი + თავისი მოთხოვნები; რეგიონული მოთხოვნა მხოლოდ ადმინთან სანამ არ გადასცემს.
- [ ] ყველა მიწერა / გადაწერა / დაბრუნება / სტატუსი იწერება `ticket_history`-ში (ვინ, როდის, IP, client).

**კონფიგურაცია (env)**
- [ ] `HELPDESK_JWT_SECRET` (გრძელი, შემთხვევითი), `HELPDESK_DEVICE_KEY`, `HELPDESK_AGENT_KEY` — სამივე სხვადასხვა.
- [ ] CORS: production-ში დატოვე მხოლოდ `http://tauri.localhost` და `tauri://localhost` (localhost:1420/1430 მხოლოდ dev-ისთვისაა).
- [ ] „დღეს“ (დღეს დასრულდა, closed_today) — `Asia/Tbilisi` დროით.

## 2. ვები (ადმინი + IT)

- [ ] `npm run build:web` → `dist-web/`; FastAPI ემსახურება იმავე origin-ზე (`app.mount("/", StaticFiles(...))`), `.env.web` → `VITE_API_URL=` ცარიელი.
- [ ] **HTTPS** (შიდა CA ან სერტიფიკატი) — პაროლები და RustDesk პაროლი გადის.
- [ ] DNS: მაგ. `helpdesk.water.local`.

## 3. დესკტოპ აპი (თანამშრომლები)

- [ ] Windows build მანქანაზე: `npm install` → `npm run tauri build` → `src-tauri\target\release\bundle\msi\*.msi`.
- [ ] სურვილისამებრ: ხელმოწერა (code signing), რომ SmartScreen არ გააფრთხილოს.
- [ ] გავრცელება: GPO Software Installation (MSI, per-machine) ან სხვა ინსტრუმენტი.
- [ ] production build-ში **დემო მონაცემები არ არის**: `ApiUrl`-ის გარეშე აპი წერს „სერვერის მისამართი არ არის მითითებული“.

## 4. GPO და კომპიუტერები

- [ ] Computer startup script: `deploy/Install-ITSupportAgent.ps1 -ApiUrl "https://helpdesk.water.local" -DeviceKey "…" -AgentKey "…"` (რეესტრი, SYSTEM task, autostart tray-ში).
- [ ] `deploy/RemoteAccess.ps1` იგივე GPO საქაღალდეში (startup script იქიდან აკოპირებს).
- [ ] RustDesk დაყენებული ყველა PC-ზე (და IT-ის კომპიუტერებზე); თუ საკუთარი RustDesk სერვერია — კლიენტების კონფიგი.
- [ ] Windows შეტყობინებები ჩართულია (Focus Assist / GPO არ ბლოკავს).

## 5. პილოტი (1–2 დღე, გაშვებამდე)

- [ ] 3–5 PC სათავოში + 1–2 რეგიონში (`reg-…` სახელით).
- [ ] თანამშრომელი: აპი იხსნება login-ის გარეშე, მოთხოვნა იგზავნება, კომპიუტერის მონაცემები და RustDesk ID ერთვის.
- [ ] IT: აიღებს → თანამშრომელს მოსდის „მუშავდება … მიერ“; დაასრულებს → „დასრულდა … მიერ“ (აპი დახურული/tray-ში).
- [ ] ადმინი: რეგიონული მოთხოვნა მხოლოდ მასთან ჩანს; გადასცემს, გადააწერს, უკან დააბრუნებს → „ჟურნალში“ და „რეპორტი“ → „მიწერები და გადაწერები“-ში ჩანს.
- [ ] RustDesk: IT ხედავს ID-ს და ერთჯერად პაროლს, უერთდება.
- [ ] SLA: ვადის შეცვლა კატეგორიაზე → ახალ მოთხოვნას ახალი ვადა აქვს; „ახლა“ ბლოკი ლაივში იცვლება.
- [ ] რეპორტი / CSV იხსნება Excel-ში ქართულად.

## 6. ექსპლუატაცია

- [ ] PostgreSQL-ის ყოველდღიური backup (+ აღდგენის ერთხელ შემოწმება).
- [ ] სერვერის ლოგები და `/api/health`-ის მონიტორინგი.
- [ ] ახალი ვერსია: ვერსია ერთდროულად `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` → ახალი MSI GPO-ით; ვები — `npm run build:web` და `dist-web/` შეცვლა.

## ცნობილი რისკი (გადაწყვეტილება შენზეა)

**DeviceKey თანამშრომელს შეუძლია წაიკითხოს** (რეესტრში ღიაა), ხოლო მომხმარებლის სახელს აპი თვითონ აგზავნის.
ტექნიკურად მცოდნე თანამშრომელს თეორიულად შეუძლია სხვის სახელით მოთხოვნის გაგზავნა ან სხვისი მოთხოვნების ნახვა
(IT-ის უფლებებს ვერ მიიღებს — device token-ს ისინი არ აქვს). შემცირება გაშვებისთვის: სერვერზე შეამოწმე,
რომ `username` AD-ში არსებობს და ჩართულია, და `ip` შიდა ქსელიდანაა. სრული გადაწყვეტა მოგვიანებით:
Windows Integrated Auth (Kerberos) `/api/device/session`-ზე — მაშინ გასაღები აღარ დაგჭირდება.
