# HelpDesk — დესკტოპ აპი + ვებ-აპი

Tauri 2 + React 19 + TypeScript + Tailwind CSS 4. ერთი კოდი, ორი build:

- **დესკტოპ აპი — თანამშრომლებისთვის, login-ის გარეშე.** ჩართვისას თვითონ შედის Windows-ის ანგარიშით
  (USERNAME + კომპიუტერის სახელი + GPO-ით მიწოდებული მოწყობილობის გასაღები). მხოლოდ „ახალი მოთხოვნა“ და „ჩემი მოთხოვნები“.
  მოთხოვნას ავტომატურად ერთვის: კომპიუტერის სახელი, IP, მომხმარებელი, OS, მდგომარეობა (CPU, RAM, HDD/SSD/M.2 NVMe, ტომები,
  პრინტერები), Event Log (სერვერის მხრიდან) და **RustDesk ID + ახალი ერთჯერადი პაროლი**.
- **ვებ-აპი — მთავარი ადმინისა და IT სპეციალისტებისთვის, ელ-ფოსტით და პაროლით.**
  - IT სპეციალისტი: პირადი მიმოხილვა და მოთხოვნები („ჩემზე“, „შემოსული“, „დასრულებული“), კომპიუტერი, Event Log, RustDesk.
  - მთავარი ადმინი: ყველაფერი — „გასანაწილებელი“ (`reg-<რეგიონი>-*`), დელეგირება, კატეგორია, გუნდის დატვირთვა.
  - „ჟურნალი“ (ადმინი): ყველა აღება, მიწერა, გადაწერა, დაბრუნება — ვინ, როდის, ვისგან ვის, საიდან (IP); ფილტრი და CSV.
  - სათავო და რეგიონები ცალ-ცალკე (მენიუ); რეგიონის მოთხოვნა მხოლოდ ადმინთან მიდის, სათავოსი — ადმინთან და IT-სთან.
  - „SLA“ (ადმინი): **ახლა** — ლაივ (10 წმ): ახალი / მუშავდება / დღეს დასრულდა / გასანაწილებელი, ვინ რაზე მუშაობს,
    ბოლო მოქმედებები; **შესრულება** — ვინ რამდენი შეასრულა, ყველაზე ხშირი პრობლემები და მოთხოვნები, „რეპორტი“ (CSV);
    **ვადები** — ვადა კატეგორიების მიხედვით. IT-ს თავის მოთხოვნებზე ვადა წვეთით უჩანს; თანამშრომელს — არა.
  - „რეპორტი“ (ადმინი): რაოდენობები, ყველაზე ხშირი მოთხოვნები და პრობლემები, კატეგორიები, რეგიონები, კომპიუტერები, სპეციალისტები, დინამიკა; CSV.

**გამიჯვნა build-ის დონეზე:** დესკტოპ build-ში (`npm run build`, Tauri) IT-ის ეკრანები (მიმოხილვა, მოთხოვნები, ჟურნალი,
რეპორტი, login) საერთოდ არ შედის; ვებ build-ში (`npm run build:web`) — თანამშრომლის ეკრანები (ახალი მოთხოვნა, ჩემი მოთხოვნები).
იხ. `HAS_STAFF` / `HAS_EMPLOYEE` — `src/lib/target.ts`. სერვერიც ამოწმებს: device token-ით IT endpoint-ები `403`,
`user` როლით ვებ login — `403` (API.md). ორივე ერთად მხოლოდ დემო preview-შია (`npm run build:preview`).

კონტრაქტი სერვერისთვის: [API.md](API.md). გაშვებამდე დარჩენილი სამუშაო: [GO-LIVE.md](GO-LIVE.md). PC-ების მომზადება: [deploy/](deploy/).

## მოთხოვნები (Windows)

- Node.js 20+
- Rust (stable): https://rustup.rs
- Visual Studio Build Tools → „Desktop development with C++“
- WebView2 — Windows 10/11-ზე უკვე არის

## გაშვება

```powershell
npm install              # ყოველი ახალი ვერსიის შემდეგ

# დესკტოპ აპი (თანამშრომელი)
npm run tauri dev        # დეველოპმენტი, hot reload
npm run tauri build      # ინსტალერები: src-tauri\target\release\bundle\{nsis,msi}

# ვებ-აპი (IT)
npm run dev:web:demo     # http://localhost:1430, დემო მონაცემებით (სერვერი არ სჭირდება)
npm run dev:web          # http://localhost:1430, /api → შენი FastAPI (http://localhost:8000; სხვა: $env:HELPDESK_API="http://host:port")
npm run build:web        # → dist-web\  (FastAPI ემსახურება, იხ. API.md → „ვებ-აპის განთავსება“)

# ორივე ერთ ფაილში, დემო მონაცემებით
npm run build:preview    # → dist-preview\index.html; ძირის ბარში გადამრთველი: აპი / ვები
```

build-ის ტიპს ირჩევს `VITE_TARGET` (`.env`, `.env.web`, `.env.preview`).
ვებ-აპი default-ად იგივე origin-ის API-ს იძახებს; სხვა მისამართისთვის `.env.web` → `VITE_API_URL=https://...`.

**დემო მონაცემები მხოლოდ dev-შია.** `npm run tauri dev` რეესტრში `ApiUrl`-ის გარეშე სატესტო მონაცემებით მუშაობს;
dev-ში რეესტრის ნაცვლად: `$env:ITSUPPORT_API_URL="http://localhost:8000"; $env:ITSUPPORT_DEVICE_KEY="..."; npm run tauri dev`
(env ცვლადებს მხოლოდ debug build კითხულობს). **production build-ში დემო საერთოდ არ შედის**: `ApiUrl`-ის გარეშე
აპი აჩვენებს „სერვერის მისამართი არ არის მითითებული“. სურვილისამებრ მისამართი build-შიც ჩაიწერება: `.env` → `VITE_API_URL=https://…`
(რეესტრის `ApiUrl` მაინც უპირატესია).

## სტრუქტურა

```
src/
  api/          http.ts (FastAPI), mock*.ts (დემო, მხოლოდ dev/preview), queries.ts (TanStack Query hooks)
  components/   TicketDetail, TicketOverview (დელეგირება, ისტორია), DevicePanel, EventLogPanel, TicketList, Handoffs, Board, Sidebar, ui/
  views/        თანამშრომელი: NewTicket, MyRequests · ვები: Login, Dashboard, Queue, Sla, Report, Journal · Settings
  hooks/        useDeviceSession (დესკტოპის ავტომატური შესვლა), useNotifier
  lib/          types.ts (API + eventlog-pipeline ტიპები), labels.ts (სახელები, რეგიონები, SLA), health.ts (კომპიუტერის პრობლემების წესები), tauri.ts
  store/        session.ts (ტოკენი, პარამეტრები), nav.ts
src-tauri/
  src/lib.rs        system_info, device_snapshot, device_config, rustdesk_id, request_remote_access
  src/remote.rs     რეესტრი (ApiUrl, DeviceKey), RustDesk ID, SYSTEM task-ის გაშვება
  src/proc.rs       პროგრამის გაშვება ფანჯრის გარეშე, timeout-ით
  src/snapshot.rs   CPU/RAM (sysinfo) + PowerShell გაშვება (-EncodedCommand, 15 წმ timeout)
  src/snapshot.ps1  დისკები, ტომები, პრინტერები (CIM, ადმინის გარეშე)
  tauri.conf.json, capabilities/default.json
deploy/
  Install-ITSupportAgent.ps1   GPO startup script (SYSTEM): რეესტრი, საქაღალდეები, task
  RemoteAccess.ps1             SYSTEM task: ახალი RustDesk პაროლი → სერვერზე
```

## კლავიშები

| | |
|---|---|
| `Ctrl K` | ძებნა და მოქმედებები |
| `Ctrl N` | ახალი მოთხოვნა |
| `Ctrl ,` | პარამეტრები |
| `↑ ↓` / `J K` | რიგში მოთხოვნებს შორის გადაადგილება |
| `Ctrl Enter` | მოთხოვნის გაგზავნა |

## GPO-ით გავრცელება

1. **აპი:** `.msi` → Computer Configuration → Policies → Software Settings → Software Installation.
   ან NSIS ჩუმად: `"IT Support System_0.1.0_x64-setup.exe" /S`. ინსტალაცია: `C:\Program Files\IT Support System\ITSupport.exe`.
   აპი Windows-ში შესვლისას ჩაირთვება საათთან ხატულად (`--hidden`, Run key-ს `Install-ITSupportAgent.ps1` წერს),
   ფანჯრის დახურვა ან ჩაკეცვა მას მალავს ფარულ ხატულებში (taskbar-ზე ღილაკი აღარ ჩანს) და სიახლეები Windows-ის
   შეტყობინებებში მოდის. „გასვლა“ — ხატულას მენიუში.
   Windows-ის შეტყობინება სწორად (აპის სახელით) ჩანს **დაინსტალირებულ** აპზე; `npm run tauri dev`-ში ის შეიძლება
   PowerShell-ის სახელით მოვიდეს ან საერთოდ არ გამოჩნდეს.
2. **RustDesk** (თუ ჯერ არ არის): ოფიციალური MSI, სერვისად (`rustdesk.exe --silent-install`). საკუთარი RustDesk სერვერი თუ გაქვს,
   მისი პარამეტრებიც იქვე.
3. **კონფიგურაცია:** Computer Configuration → Policies → Windows Settings → Scripts → **Startup** → PowerShell Scripts:
   `Install-ITSupportAgent.ps1`, პარამეტრები:
   ```
   -ApiUrl "https://helpdesk.water.local" -DeviceKey "<HELPDESK_DEVICE_KEY>" -AgentKey "<HELPDESK_AGENT_KEY>"
   ```
   `RemoteAccess.ps1` იმავე საქაღალდეში დადე. სკრიპტი ყოველ ჩართვაზე თავიდან ამოწმებს ყველაფერს.

გასაღებები სერვერზე გარემოს ცვლადებშია (`HELPDESK_DEVICE_KEY`, `HELPDESK_AGENT_KEY`). შექმნა:
`python -c "import secrets; print(secrets.token_urlsafe(32))"`.
- `DeviceKey` — თანამშრომელს შეუძლია წაიკითხოს. ის მხოლოდ თანამშრომლის სესიას ხსნის (იხ. API.md).
- `AgentKey` — მხოლოდ SYSTEM/Administrators-ს. მისი გაჟონვის შემთხვევაშიც სერვერი RustDesk-ის მონაცემს იღებს მხოლოდ
  მოთხოვნის საკუთარი კომპიუტერიდან (hostname-ის შემოწმება).

შემოწმება PC-ზე: `reg query HKLM\SOFTWARE\Policies\ITSupport`, `schtasks /Query /TN \ITSupport\RemoteAccess`,
ჟურნალი `%ProgramData%\ITSupport\remote-access.log` (პაროლის გარეშე).

## რეგიონები

სია და ქართული სახელები: `src/lib/labels.ts` → `REGIONS`. თუ კომპიუტერის სახელებში მოკლე კოდებს იყენებ
(`reg-mts-...`), დაამატე იქ `mts: "მცხეთა"`.

NetBIOS სახელი 15 სიმბოლოა: `reg-mtskheta-lashaberadze` → `REG-MTSKHETA-LA`. ორი კომპიუტერი, რომლის პირველი
15 სიმბოლო ემთხვევა (`reg-mtskheta-lashaberadze`, `reg-mtskheta-lashakapanadze`), დომენში ერთად ვერ იქნება.

## ბრენდი

`src/lib/brand.ts` — კომპანიის სახელი, ვერსია ძირის ბარისთვის, copyright.
`src/assets/logo-mark.svg` — ლოგოს ნიშანი (ვექტორი, აწყობილია მოწოდებული PNG-იდან). თუ ორიგინალი SVG/AI გაქვს, ჩაანაცვლე ეს ფაილი
და `assets/logo.svg` (აპის აიკონი), შემდეგ `npx tauri icon assets/logo.png`.

## ფერები

ყველა ფერი ერთ ფაილშია: `src/index.css`. ორივე აპი (თანამშრომლის და ვები) ერთ „მინის“ სტილს იყენებს. კომპონენტებში ფერები პირდაპირ არ წერია.

| რა | სად (`src/index.css`) |
|---|---|
| ღია თემა | `:root[data-skin="glass"]:not(.dark) { … }` — `--raised` (ბარათები), `--bg` (ზედა ზოლი), `--chrome` (გვერდითი მენიუ), `--line` (ჩარჩოები, გამყოფი ხაზები), `--accent` (მთავარი ფერი) |
| ღია თემის ფონი | მის ქვემოთ: `:root[data-skin="glass"]:not(.dark) body { background: … }` |
| მუქი თემა | `:root.dark[data-skin="glass"] { … }` და `:root.dark[data-skin="glass"] body { background: … }` |
| სტატუსები | `:root` / `.dark`: `--st-new` (ახალი), `--st-open` (მუშავდება), `--st-closed` (დასრულებული) + `-bg`/`-ring` |
| შეცდომა / გაფრთხილება / წარმატება, გრაფიკები | `:root` / `.dark`: `--critical`, `--high`, `--ok`, `--chart-1`, `--chart-2` |

შეცვლის შემდეგ `npm run dev` / `npm run dev:web:demo` ცვლილებას მაშინვე აჩვენებს.
#   h e l p d e s k - d e s k t o p  
 