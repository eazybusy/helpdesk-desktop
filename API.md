# HelpDesk API — კონტრაქტი კლიენტებისთვის

ერთი კოდი, ორი აპი (`src/api/http.ts`). JSON ველები ზუსტად ემთხვევა `src/lib/types.ts`-ს.

| | დესკტოპ აპი (Tauri) | ვებ-აპი |
|---|---|---|
| ვისთვის | თანამშრომლები | მთავარი ადმინი, IT სპეციალისტები |
| შესვლა | **login-ის გარეშე**: `POST /api/device/session` (Windows ანგარიში + `X-Device-Key`) | ელ-ფოსტა + პაროლი: `POST /api/auth/login` |
| სერვერის მისამართი | რეესტრი `HKLM\SOFTWARE\Policies\ITSupport\ApiUrl` (GPO) | იგივე origin (FastAPI ემსახურება `dist-web/`-ს) |
| ხედები | ახალი მოთხოვნა, ჩემი მოთხოვნები | მიმოხილვა, მოთხოვნები, გასანაწილებელი… |

ყველა მოთხოვნა, გარდა `/api/auth/login`, `/api/device/session`, `/api/health` და `/api/tickets/{id}/remote`, მიდის `Authorization: Bearer <token>` header-ით.
`401` → ვებ-აპი აბრუნებს შესვლის გვერდზე, დესკტოპ აპი ჩუმად ხსნის ახალ device session-ს. შეცდომის ტექსტს აპი იღებს `{"detail": "..."}`-დან.

## Endpoint-ები

| Method | Path | ვინ | აღწერა |
|---|---|---|---|
| GET | `/api/health` | ყველა | `200` |
| POST | `/api/auth/login` | **მხოლოდ IT** | `{email, password, remember}` → `{access_token, user}`; `user` როლით → `403` |
| POST | `/api/device/session` | დესკტოპ აპი | header `X-Device-Key`; body `Device` → `{access_token, user}` (როლი ყოველთვის `user`) |
| GET | `/api/auth/me` | ყველა | `User` |
| GET | `/api/tickets` | ყველა | `Ticket[]`; query: `scope`, `origin` (`hq`/`region`, admin), `status`, `region`, `q` |
| POST | `/api/tickets` | ყველა | `NewTicket` → `Ticket` |
| GET | `/api/tickets/{id}` | ყველა* | `TicketDetail` (`snapshot`, `log_snapshot`, `history`, `remote` — მხოლოდ IT-ს) |
| POST | `/api/tickets/{id}/remote` | PC-ის SYSTEM task | header `X-Agent-Key`; `{hostname, netbios, rustdesk_id, password}` → `204` |
| PATCH | `/api/tickets/{id}` | IT (იხ. უფლებები) | `{status?, category?, assignee_id?}` → `Ticket` |
| POST | `/api/tickets/{id}/delegate` | admin | `{assignee_id, note}` → `Ticket` |
| POST | `/api/tickets/{id}/return` | მინიჭებული agent | `{note}` → `Ticket` — რეგიონული მოთხოვნა ბრუნდება ადმინთან |
| POST | `/api/tickets/{id}/comments` | IT (ვინც ამ მოთხოვნას ხედავს) | `{body}` → `TicketComment` — თანამშრომელი ხედავს და შეტყობინება მიუვა |
| GET | `/api/replies` | IT | `CannedReply[]` — გუნდის მზა პასუხები |
| POST | `/api/replies` | IT | `{title, body}` → `CannedReply` |
| PATCH | `/api/replies/{id}` | ავტორი ან admin | `{title, body}` → `CannedReply` |
| DELETE | `/api/replies/{id}` | ავტორი ან admin | `204` |
| GET | `/api/agents` | admin | `Agent[]` — `User` + `active_count` (დატვირთვა არჩევისას) |
| GET | `/api/audit` | admin | `AuditEntry[]`; query: `action` (`assignment` ან ერთი `kind`), `person_id`, `since`, `q`, `limit` |
| GET | `/api/stats` | IT | `Stats` (+ `by_origin: {hq, region}` — აქტიური, admin; `team[].closed_today`) |
| GET | `/api/reports` | admin | `Report`; query: `since`, `until`, `origin`, `region` |
| GET | `/api/sla` | IT | `SlaPolicy` — ვადები კატეგორიების მიხედვით |
| PUT | `/api/sla` | admin | `{hours: {hardware: 24, printer: 8, …}}` → `SlaPolicy` |
| GET | `/api/sla/team` | admin | `TeamReport` — ვინ რამდენი შეასრულა, ხშირი პრობლემები; query: `since`, `until`, `origin`, `region` |
| GET | `/api/v1/eventlogs/user/{sam}` | IT | შენი pipeline — `?hours=&category=&limit=` |
| GET | `/api/v1/eventlogs/user/{sam}/day` | IT | შენი pipeline — `?date=YYYY-MM-DD` |
| GET | `/api/v1/eventlogs/user/{sam}/sessions` | IT | შენი pipeline — `?hours=` |

\* ჩვეულებრივ მომხმარებელს მხოლოდ საკუთარ მოთხოვნაზე აქვს წვდომა.

## სტატუსები

მხოლოდ სამი: `new` (ახალი), `open` (მუშავდება), `closed` (დასრულებული). სხვა მნიშვნელობას აპი არ იცნობს.
თუ ბაზაში ძველი ჩანაწერებია: `UPDATE tickets SET status='open' WHERE status='pending'; UPDATE tickets SET status='closed' WHERE status='resolved';`
(იგივე `ticket_history`-ში: `UPDATE … SET value='closed' WHERE kind='status' AND value='resolved'` — ეს ერთჯერადი მიგრაციაა, append-only trigger-ის გაშვებამდე.)

## როლები და უფლებები

| | თანამშრომელი (`user`) | IT სპეციალისტი (`agent`) | მთავარი ადმინი (`admin`) |
|---|---|---|---|
| რას ხედავს | საკუთარ მოთხოვნებს | **შემოსულს** (თავისუფალი, არარეგიონული, აქტიური) + **შენზე მიწერილს** | ყველაფერს |
| მიმოხილვა | — | პირადი: ჩემზე, ვადაგადაცილებული, დღეს დასრულებული, შემოსული | მთელი სამსახური + გუნდის დატვირთვა |
| მოთხოვნის აღება | — | თავისუფალი → ჩემზე (`PATCH assignee_id = self`) | ნებისმიერი, ნებისმიერზე |
| სტატუსი | — | მხოლოდ საკუთარზე: `open`, `closed` | ყველა (`new`, `open`, `closed`) |
| კატეგორია | — | ❌ | ✅ |
| სხვაზე მიწერა / დელეგირება | — | ❌ | ✅ |
| დაბრუნება | — | საკუთარი: რეგიონული → ადმინს, სხვა → შემოსულებში | — |
| `/api/agents` | ❌ | ❌ | ✅ |
| RustDesk ID / პაროლი | ❌ | ✅ (რაც ხედავს) | ✅ |
| სად მუშაობს | დესკტოპ აპი, login-ის გარეშე | ვები | ვები |

agent-ის ნებისმიერ სხვა `PATCH`-ზე სერვერი აბრუნებს `403`. `GET /api/tickets/{id}` agent-ს სხვის მოთხოვნაზე → `404`.

**`scope` agent-ისთვის:** `mine` — ჩემზე, აქტიური · `unassigned` — შემოსული · `closed` — ჩემი დასრულებული · `all` — `mine` + `unassigned`.

**`Stats` agent-ისთვის პირადია:** `mine`, `overdue` (ჩემზე), `resolved_today` (ჩემი), `unassigned` (შემოსული). `team` — მხოლოდ admin-ს, agent-ს `[]`.

## რეგიონული მოთხოვნები და დელეგირება

**რეგიონის ამოცნობა** — სერვერი `POST /api/tickets`-ზე, `device.hostname`-იდან:

```python
import re
REGION_RE = re.compile(r"^reg-([a-z]+)(?:-|$)", re.I)

def region_of(hostname: str | None) -> str | None:
    m = REGION_RE.match(hostname or "")
    return m.group(1).lower() if m else None
```

`device.hostname` სრული DNS სახელია (`reg-mtskheta-lashaberadze`). `device.netbios` არის `%COMPUTERNAME%`,
მაქსიმუმ 15 სიმბოლო (`REG-MTSKHETA-LA`). რეგექსი ორივეზე მუშაობს, მაგრამ ჯობს `hostname`-ით ამოცნობა.

**ხილვადობა** (`awaiting = region IS NOT NULL AND assignee_id IS NULL AND status <> 'closed'`):

| როლი | რას ხედავს |
|---|---|
| `admin` | ყველაფერს. `scope=dispatch` → მხოლოდ `awaiting` |
| `agent` | შემოსულს და საკუთარს (იხ. ზემოთ). რეგიონული მოთხოვნა მხოლოდ მასზე დელეგირების შემდეგ უჩნდება |
| `user` | მხოლოდ საკუთარს |

**`scope`:** `all` — აქტიური, `awaiting`-ის გარეშე · `mine` — აქტიური, ჩემზე · `unassigned` — აქტიური, შემსრულებლის
გარეშე, **არარეგიონული** · `dispatch` — `awaiting` (admin) · `closed` — დასრულებული · `requested` — ჩემი შექმნილი.

**წესები:**
- `delegate` — მხოლოდ `admin`. ავსებს `assignee_id`, `delegated_by_id`, `delegation_note`; `new` → `open`; ისტორიაში `delegated`.
- `return` — მხოლოდ მინიჭებულ agent-ს: `assignee_id = NULL`, `status = new`, ისტორიაში `returned` + note. რეგიონული ბრუნდება `dispatch`-ში, სხვა — შემოსულებში.
- `resolved_by` — ვინც სტატუსი `closed`-ზე გადაიყვანა (ხელახლა გახსნისას `null`). თანამშრომელს აპი აჩვენებს „თქვენი მოთხოვნა დასრულდა ნინო ბერიძის მიერ“.
- `delegation_note` და `suspected_problem` user-ს არ უბრუნდება (`null`). ისტორიაში user-ს `delegated` → `assigned`, `returned` → `unassigned`, `note = null`.
- `Stats.dispatch` — `awaiting`-ების რაოდენობა admin-ისთვის, სხვებისთვის 0. `Stats.by_region` — აქტიური რეგიონების მიხედვით.

## კომპიუტერის მდგომარეობა (`snapshot`)

აპი აგროვებს მოთხოვნის გახსნისას (Rust `device_snapshot`: CPU/RAM sysinfo-ით, დისკები/ტომები/პრინტერები
PowerShell CIM-ით, ადმინის უფლებების გარეშე) და აგზავნის `POST /api/tickets`-ში `snapshot` ველად.

- სერვერი ინახავს როგორც არის: `tickets.snapshot JSONB`.
- `Ticket.issue_count = len(snapshot.issues)` — პრობლემები კლიენტზევე ითვლება (`src/lib/health.ts`), სერვერს ლოგიკა არ სჭირდება.
- `snapshot` შეიძლება იყოს `null` (PowerShell-ის timeout).

## Event Log (შენი eventlog-pipeline)

მოთხოვნის შექმნისას — ისე, როგორც pipeline-ის README-შია:

```python
ticket = Ticket(..., requester_sam=current_user.username, region=region_of(data.device.hostname),
                snapshot=data.snapshot.model_dump(mode="json") if data.snapshot else None,
                issue_count=len(data.snapshot.issues) if data.snapshot else 0)
db.add(ticket); db.flush()
attach_logs_to_ticket(db, ticket)   # ავსებს log_snapshot, log_text, suspected_problem
db.commit()
```

აპი `TicketDetail.log_snapshot`-ში ელის `TicketSnapshot`-ს ზუსტად იმ ფორმით, რასაც `snap.model_dump(mode="json")` იძლევა,
ხოლო `Ticket.suspected_problem`-ში — `snap.summary`-ს. user-ს ორივე `null` უნდა დაუბრუნდეს.

Event Log ჩანართი:
- **შეჯამება** — `summary`, `activity.flags`, `problems` (რჩევა + ნიმუშები), კატეგორიების რაოდენობა.
- **ჩანაწერები** — ფილტრი დონით, კატეგორიით, „მხოლოდ ფაქტი“ (`sam_source` = `event`/`sid`), „მხოლოდ პრობლემები“, ტექსტით.
  პერიოდი: მიმაგრებული ამონაწერი ან ცოცხლად `/user/{sam}?hours=24|72|168|720`, ან `/user/{sam}/day?date=`.
- **ფაილები, USB** — `activity.deleted_files`, `transferred_files`, `devices`.
- **სესიები** — `/user/{sam}/sessions?hours=168`.

> ⚠️ **pipeline-ის კითხვის endpoint-ებს ავთენტიფიკაცია არ აქვს.** `/user/{sam}`, `/files/recent`, `/devices/recent`
> აბრუნებს ვინ რა ფაილი წაშალა — ქსელში ნებისმიერს შეუძლია წაიკითხოს. დაამატე IT-ის შემოწმება
> (ingest-ს `X-Agent-Key` რჩება):
>
> ```python
> # eventlogs_router.py — თითოეულ GET-ზე, ან ცალკე router-ად
> from app.auth import require_staff          # შენი dependency: role in ("agent", "admin")
> @router.get("/user/{sam}", response_model=list[EventOut], dependencies=[Depends(require_staff)])
> ```

## სათავო და რეგიონები

ერთი თანამშრომლის აპია ყველასთვის. სათავოს და რეგიონს სერვერი კომპიუტერის სახელით არჩევს: `reg-<რეგიონი>-*` → `region`, სხვა → სათავო (`region = NULL`).

| | სათავოს მოთხოვნა | რეგიონის მოთხოვნა |
|---|---|---|
| ვინ ხედავს თავიდან | ადმინი + ყველა IT სპეციალისტი (თავისუფალი რიგი) | **მხოლოდ ადმინი** (გასანაწილებელი) |
| ვინ ანაწილებს | სპეციალისტი თვითონ იღებს ან ადმინი მიაწერს | ადმინი დელეგირებით |
| სპეციალისტი ხედავს | თავისუფალს და თავისას | მხოლოდ მასზე დელეგირებულს |

- `GET /api/tickets?origin=hq` → `region IS NULL`; `origin=region` → `region IS NOT NULL` (მხოლოდ admin; სხვას იგნორირდება).
- ადმინის ვებ-მენიუ: **სათავო** → მოთხოვნები; **რეგიონები** → გასანაწილებელი, მოთხოვნები; დასრულებულში ფილტრი სათავო/რეგიონები.
- `Stats.by_origin` — აქტიური მოთხოვნები: `{hq: …, region: …}` (region მოიცავს გასანაწილებელსაც).

## რეპორტი (`/api/reports`)

მხოლოდ admin. ითვლება **ყველა მოთხოვნაზე** (არა მხოლოდ სიაში ნაჩვენებზე), `since ≤ created_at < until` (default `until = now()`), ფილტრი `origin`, `region`.

| ველი | როგორ ითვლება |
|---|---|
| `totals.opened` | შექმნილი პერიოდში |
| `totals.resolved` | მათგან `closed` |
| `totals.open_now` | ახლა აქტიური (პერიოდის მიუხედავად, იგივე ფილტრით) |
| `totals.late` | დასრულებული ვადაზე გვიან (`resolved_at > due_at`) |
| `totals.avg_resolution_minutes` | `avg(resolved_at - created_at)` |
| `totals.avg_first_response_minutes` | `avg(` პირველი `taken/assigned/delegated/reassigned` ისტორიაში `- created_at)` |
| `by_origin` | `region IS NULL` / `IS NOT NULL` |
| `by_region` | `GROUP BY region` → `opened`, `resolved` |
| `by_category` | `GROUP BY category` → `opened`, `avg_resolution_minutes` |
| `top_subjects` (ყველაზე ხშირი მოთხოვნა) | `GROUP BY normalize(subject)` top 10; `subject` = ჯგუფის პირველი ორიგინალი |
| `top_problems` (ყველაზე ხშირი პრობლემა) | Event Log-ის `suspected_problem`, `"სავარაუდო პრობლემა:"` და `(…)`/`.`-ის შემდეგ ნაწილი მოჭრილი, top 10 |
| `top_devices` | `GROUP BY hostname` top 8, `requester` = ბოლო მომთხოვნი |
| `by_agent` | `GROUP BY resolved_by` → `resolved`, `avg_resolution_minutes` |
| `trend` | ≤ 45 დღე: დღეებით; მეტი: კვირებით (ორშაბათიდან). `created` — შექმნილი, `resolved` — დასრულებული იმ დღეს/კვირას |

```sql
-- normalize(subject): პატარა ასოები, სასვენი ნიშნები და ზედმეტი ჰარები მოშორებული
lower(regexp_replace(regexp_replace(subject, '[[:punct:]„“«»–]', ' ', 'g'), '\s+', ' ', 'g'))

-- ყველაზე ხშირი მოთხოვნები
SELECT min(subject) AS subject, mode() WITHIN GROUP (ORDER BY category) AS category, count(*)
FROM tickets
WHERE created_at >= :since AND created_at < :until
  AND (:origin IS NULL OR (:origin = 'region') = (region IS NOT NULL))
  AND (:region IS NULL OR region = :region)
GROUP BY normalize(subject) ORDER BY count(*) DESC LIMIT 10;
```

საჭიროა `tickets.resolved_at` (სტატუსის `closed`-ზე გადასვლისას, ხელახლა გახსნისას `NULL`) და `tickets.resolved_by_id`.
ადამიანები ერთსა და იმავეს სხვადასხვანაირად წერენ, ამიტომ „ხშირი მოთხოვნა“ ზუსტია მხოლოდ მსგავს ფორმულირებაზე; „ხშირი პრობლემა“ (Event Log) — უფრო სანდოა.

### მიწერები და გადაწერები (`handoffs`)

ორივე რეპორტს — `GET /api/reports` და `GET /api/sla/team` — ემატება ერთი და იგივე ბლოკი `handoffs`. ითვლება
`ticket_history`-დან, მიწერის სახეობების ჩანაწერებზე (`taken`, `assigned`, `reassigned`, `delegated`, `unassigned`, `returned`),
რომელთა `at` პერიოდშია (`since ≤ at < until`), იგივე `origin` / `region` ფილტრით.

```jsonc
"handoffs": {
  "by_admin": 16,     // actor.role = 'admin' AND kind IN ('assigned','reassigned','delegated')
  "moved": 5,         // from_user_id IS NOT NULL AND to_user_id IS NOT NULL AND from_user_id <> to_user_id
  "per_agent": [      // ყველა, ვისაც პერიოდში რამე შეეხო
    { "agent": User,
      "received": 6,      // ადმინმა მისცა: admin-ის assigned/reassigned/delegated, to_user = agent
      "taken": 4,         // თვითონ აიღო: kind = 'taken', to_user = agent
      "moved_away": 1,    // სხვას გადაეწერა: from_user = agent, to_user = სხვა
      "returned": 1 }     // დააბრუნა: kind = 'returned', from_user = agent
  ],
  "chains": [         // მოთხოვნები, რომლებსაც პერიოდში 2+ ასეთი ჩანაწერი აქვს; ჯერ ყველაზე მეტი, max 30
    { "ticket": { "id": 2045, "subject": "…", "region": null, "status": "open" },
      "steps": [ { "at": "…", "kind": "assigned", "by": User, "to": User, "from": null },
                 { "at": "…", "kind": "reassigned", "by": User, "to": User, "from": User }, … ] }   // at-ის მიხედვით
  ]
}
```

```sql
SELECT h.ticket_id, h.at, h.kind, h.actor_id, h.to_user_id, h.from_user_id
FROM ticket_history h JOIN tickets t ON t.id = h.ticket_id
WHERE h.kind IN ('taken','assigned','reassigned','delegated','unassigned','returned')
  AND h.at >= :since AND h.at < :until
  AND (:origin IS NULL OR (:origin = 'region') = (t.region IS NOT NULL))
  AND (:region IS NULL OR t.region = :region)
ORDER BY h.ticket_id, h.at;
-- ამ სიიდან ითვლება by_admin, moved, per_agent და chains (ticket_id-ით დაჯგუფებული, 2+ ჩანაწერი).
```

ვებში: „რეპორტი“ → „მიწერები და გადაწერები“ (ცხრილი + ჯაჭვი „ნინო → გიორგი → ნინო“); ორივე CSV-ში იგივე ბლოკია.

## კომენტარები და მზა პასუხები

IT (სპეციალისტი ან ადმინი) მოთხოვნაზე წერს კომენტარს, რომელიც **თანამშრომელს უჩანს** აპში და **შეტყობინება მიუვა**
(მაგ. „ეს საკითხი IT-ს არ ეხება, მიმართეთ …“). თანამშრომელი კომენტარს არ წერს.

```jsonc
// TicketDetail.comments — ძველიდან ახლისკენ; თანამშრომელიც იღებს
[ { "id": 7, "author": User, "body": "მონიტორის კაბელი შევცვალეთ…", "at": "2026-11-18T10:40:00Z" } ]

// Ticket (სიებშიც) — ამით აპი ხვდება, რომ ახალი კომენტარია, და აჩვენებს შეტყობინებას
"comment_count": 1,
"last_comment": { "author": User, "body": "…", "at": "…" }      // ან null
```

- **ცხრილი:** `ticket_comments(id, ticket_id FK, author_id FK, body text CHECK (length(body) BETWEEN 1 AND 4000), at timestamptz DEFAULT now())`.
- `POST /api/tickets/{id}/comments`: მხოლოდ IT (`require_staff`) და მხოლოდ თუ ეს მოთხოვნა მას უჩანს (იგივე წესი, რაც `GET`-ზე);
  `body.strip()` ცარიელი → `422`. იმავე ტრანზაქციაში `ticket_history`: `kind='commented'`, `value` = ტექსტის პირველი 140 სიმბოლო
  (ჟურნალში ჩანს), და `tickets.updated_at = now()`.
- `comment_count` / `last_comment` — `GET /api/tickets`-ის ყველა ელემენტზე (თანამშრომლის `scope=requested`-ზეც).
- **შეტყობინება:** აპი ყოველ 30 წამში (tray-შიც) ადარებს `comment_count`-ს წინასთან → Windows notification
  „ახალი კომენტარი: #2049 …“ + ავტორი და ტექსტის დასაწყისი. სერვერს push არ სჭირდება.

```jsonc
// CannedReply — GET/POST /api/replies, PATCH/DELETE /api/replies/{id}
{ "id": 3, "title": "არ ეხება IT-ს", "body": "გამარჯობა, {სახელი}! ეს საკითხი IT სამსახურს არ ეხება… მოთხოვნა {ნომერი} დახურულია.",
  "author": User, "updated_at": "…" }
```

- **ცხრილი:** `canned_replies(id, title varchar(80) NOT NULL, body text NOT NULL CHECK (length(body) <= 4000), author_id FK, updated_at)`.
- ყველა IT ხედავს ყველას და ამატებს; შეცვლა / წაშლა — ავტორი ან admin (სხვა → `403`). სია `title`-ით დალაგებული.
- `{სახელი}` და `{ნომერი}` სერვერი **არ ცვლის** — აპი ჩასვამს თანამშრომლის სახელს და `#ნომერს` ტექსტში ჩასმისას.
  კომენტარად უკვე შევსებული ტექსტი მოდის.

## ვადები (SLA) — `/api/sla`

ვადას მთავარი ადმინი აყენებს **კატეგორიის მიხედვით** (ვებში „SLA“ → „ვადები“).

```jsonc
// SlaPolicy — GET/PUT /api/sla
{ "hours": { "hardware": 24, "printer": 8, "network": 8, "email": 8, "software": 24, "access": 4, "other": 48 },
  "updated_at": "2026-11-18T09:12:00Z", "updated_by": { "id": 1, "full_name": "თორნიკე …", … } }
```

- **ცხრილი:** `sla_policy(category PK, hours int CHECK (hours BETWEEN 1 AND 720), updated_at, updated_by_id)`. თავიდან ყველა 24.
- `PUT` მხოლოდ admin (`403` სხვებს); ყველა 7 კატეგორია ერთად; `1 ≤ hours ≤ 720`, სხვა შემთხვევაში `422`.
- **ახალი მოთხოვნა:** `due_at = created_at + hours[category]` — შექმნისას ერთხელ ინახება.
- **კატეგორიის შეცვლა** (`PATCH category`): `due_at = created_at + hours[ახალი category]`.
- **ვადის შეცვლა ადმინის მიერ** მხოლოდ ახალ მოთხოვნებზე ვრცელდება — არსებულების `due_at` არ იცვლება (ვადა არავის „გადაუხტება“).
- თანამშრომელს ვადა არ უჩანს (`due_at` user-ს შეგიძლია `null`-ად დაუბრუნო).

### SLA გვერდი (ადმინი)

ვებში „SLA“ გვერდი სამი ნაწილია: **ახლა** (ლაივ, ყოველ 10 წამში), **შესრულება** (პერიოდით) და **ვადები** (ზემოთ).

**ახლა** ახალ endpoint-ს არ საჭიროებს: `GET /api/stats`, `GET /api/tickets?scope=all`, `GET /api/audit?limit=14`. `Stats.team`-ს ემატება ერთი ველი:

```jsonc
// Stats.team[] — admin-ისთვის ყველა IT თანამშრომელი (agent + admin)
{ "agent": User, "active": 2, "overdue": 0,
  "closed_today": 3 }   // resolved_by = agent AND resolved_at >= დღევანდელი დღის დასაწყისი (Asia/Tbilisi)
```

**შესრულება** — `GET /api/sla/team?since=&until=&origin=&region=` (მხოლოდ admin; „რეპორტი“ ღილაკი ამას CSV-ად იწერს):

```jsonc
// TeamReport
{ "since": "…", "until": "…",
  "opened": 112,                     // created_at პერიოდში
  "closed": 100,                     // resolved_at პერიოდში (since ≤ resolved_at < until)
  "avg_resolution_minutes": 157,     // avg(resolved_at - created_at) დასრულებულებზე
  "by_agent": [                      // GROUP BY resolved_by, closed DESC
    { "agent": User, "closed": 35, "avg_resolution_minutes": 127,
      "by_category": { "printer": 7, "software": 10, … } }   // 0-იანი კატეგორია შეგიძლია გამოტოვო
  ],
  "top_problems": [ { "problem": "ბეჭდვის რიგი გაჭედილია", "count": 11 }, … ],   // top 8, როგორც რეპორტში, created_at პერიოდში
  "top_subjects": [ { "subject": "პრინტერი არ ბეჭდავს", "category": "printer", "count": 14 }, … ]  // top 8
}
```

```sql
SELECT resolved_by_id, count(*) AS closed, avg(extract(epoch FROM resolved_at - created_at) / 60) AS avg_resolution_minutes
FROM tickets
WHERE status = 'closed' AND resolved_at >= :since AND resolved_at < :until
  AND (:origin IS NULL OR (:origin = 'region') = (region IS NOT NULL))
  AND (:region IS NULL OR region = :region)
GROUP BY resolved_by_id ORDER BY closed DESC;
-- by_category: იგივე + GROUP BY resolved_by_id, category
```

## ისტორია და ჟურნალი (`history`, `/api/audit`)

ყველა ცვლილება იწერება **ერთ append-only ცხრილში**. ის ერთდროულად არის მოთხოვნის ისტორია (`TicketDetail.history`) და ადმინის ჟურნალი (`/api/audit`).

| `kind` | როდის | `actor` | `from` | `to` |
|---|---|---|---|---|
| `created` | მოთხოვნა შეიქმნა (აპიდან) | თანამშრომელი | — | — |
| `taken` | IT სპეციალისტმა თავისუფალი მოთხოვნა აიღო | სპეციალისტი | — | სპეციალისტი |
| `assigned` | ადმინმა მიუწერელი მოთხოვნა ვინმეს მიაწერა | ადმინი | — | შემსრულებელი |
| `reassigned` | ადმინმა ერთისგან მეორეზე გადაწერა | ადმინი | ძველი | ახალი |
| `delegated` | ადმინმა რეგიონული მოთხოვნა გადაწერა | ადმინი | ძველი (თუ იყო) | ახალი |
| `unassigned` | ადმინმა შემსრულებელი მოხსნა | ადმინი | ძველი | — |
| `returned` | შემსრულებელმა დააბრუნა (რეგიონული → ადმინს, სხვა → რიგში) | შემსრულებელი | შემსრულებელი | — |
| `status` / `category` | ველის ცვლილება (`value` = ახალი მნიშვნელობა) | ვინც შეცვალა | — | — |
| `commented` | IT-მ კომენტარი დაწერა (`value` = ტექსტის პირველი 140 სიმბოლო; სრული — `ticket_comments`) | ავტორი | — | — |

```sql
CREATE TABLE ticket_history (
    id           bigserial PRIMARY KEY,
    at           timestamptz NOT NULL DEFAULT now(),
    ticket_id    int  NOT NULL REFERENCES tickets(id),
    actor_id     int  REFERENCES users(id),           -- NULL = სისტემა
    kind         text NOT NULL,
    from_user_id int  REFERENCES users(id),
    to_user_id   int  REFERENCES users(id),
    value        text,
    note         text,
    ip           inet,                                -- request.client.host (proxy-ის უკან: X-Forwarded-For)
    user_agent   text,
    client       text                                 -- 'web' | 'desktop' | 'agent' (JWT kind-იდან)
);
CREATE INDEX ON ticket_history (ticket_id, at);
CREATE INDEX ON ticket_history (at DESC);
CREATE INDEX ON ticket_history (actor_id, at DESC);

-- ჩანაწერს ვერავინ შეცვლის და წაშლის, აპის DB მომხმარებელიც კი
REVOKE UPDATE, DELETE, TRUNCATE ON ticket_history FROM helpdesk_app;
CREATE FUNCTION ticket_history_readonly() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ticket_history is append-only'; END $$;
CREATE TRIGGER ticket_history_readonly BEFORE UPDATE OR DELETE ON ticket_history
    FOR EACH ROW EXECUTE FUNCTION ticket_history_readonly();
```

ჩაწერე **იმავე ტრანზაქციაში**, რომელშიც მოთხოვნა იცვლება. ასე ცვლილება ჟურნალის გარეშე ვერ მოხდება:

```python
def record(db, request, actor, ticket, kind, *, frm=None, to=None, value=None, note=None):
    db.add(TicketHistory(
        ticket_id=ticket.id, actor_id=actor.id if actor else None, kind=kind,
        from_user_id=frm.id if frm else None, to_user_id=to.id if to else None,
        value=value, note=note,
        ip=client_ip(request), user_agent=request.headers.get("user-agent", "")[:300],
        client=token_kind(request),
    ))

# PATCH /api/tickets/{id}, assignee_id:
prev, new = t.assignee, (db.get(User, patch.assignee_id) if patch.assignee_id else None)
if (prev and prev.id) != (new and new.id):
    kind = "unassigned" if not new else "reassigned" if prev else "taken" if new.id == me.id else "assigned"
    t.assignee = new
    record(db, request, me, t, kind, frm=prev, to=new)
db.commit()
```

- `GET /api/tickets/{id}` → `history` **ძველიდან ახლისკენ**. თანამშრომელს: `delegated`/`reassigned` → `assigned`, `returned` → `unassigned`, `from` და `note` ცარიელი.
- `GET /api/audit` (admin): ყველა მოთხოვნის ჩანაწერი, **ახლიდან ძველისკენ**, `limit` default 500, max 1000.
  `action=assignment` → `kind IN ('taken','assigned','reassigned','delegated','unassigned','returned')`.
  `person_id` → `actor_id = :id OR from_user_id = :id OR to_user_id = :id`. `q` → `ticket_id = :n` ან `subject ILIKE`.
- `AuditEntry`: `{id, at, actor, action, ticket: {id, subject, region}, from, to, value, note, ip, client}`.
- სურვილისამებრ: უარყოფილი ცდებიც (`403` მიწერაზე) ჩაწერე ცალკე `security_log`-ში. `ticket_history`-ში მხოლოდ რეალური ცვლილებები უნდა იყოს.

## თანამშრომლის შეტყობინებები

აპი `GET /api/tickets?scope=requested`-ს 30 წამში ერთხელ კითხულობს (ფანჯარა დამალულია თუ არა) და ადარებს წინა მდგომარეობას.
ცალკე endpoint არ სჭირდება — საკმარისია `Ticket`-ში სწორი `status`, `assignee` და `resolved_by`.

| ცვლილება | შეტყობინება |
|---|---|
| `assignee` გაჩნდა/შეიცვალა (აიღო, მიაწერეს, დელეგირდა, გადაწერეს) | „თქვენი მოთხოვნა მუშავდება ნინო ბერიძის მიერ“ |
| `status` → `closed` | „თქვენი მოთხოვნა დასრულდა ნინო ბერიძის მიერ“ (`resolved_by`, თუ არა — `assignee`) |
| `closed` → აქტიური | „თქვენი მოთხოვნა ხელახლა გაიხსნა“ |

სახელი ბრუნვაში აპი თვითონ სვამს (`full_name`-დან). ის, რაც აპის დახურვისას მოხდა, მომდევნო ჩართვისას ჩანს.

## სხვა წესები

- **SLA:** `due_at` კატეგორიის ვადით ითვლება — იხ. „ვადები (SLA)“.
- `new` + შემსრულებელი → `open`.
- თარიღები — ISO 8601 UTC. Event Log-ის `time_local` მოდის pipeline-იდან (`Asia/Tbilisi`).
- აპი ყოველ 30 წამში ითხოვს `GET /api/tickets`-ს (შეტყობინებებისთვის), ამიტომ `updated_at` ყოველ ცვლილებაზე უნდა განახლდეს.

## თანამშრომლის შესვლა login-ის გარეშე (`/api/device/session`)

დესკტოპ აპი ჩართვისას აგზავნის:

```http
POST /api/device/session
X-Device-Key: <GPO-ით გავრცელებული გასაღები>
Content-Type: application/json

{"hostname":"reg-mtskheta-lashaberadze","netbios":"REG-MTSKHETA-LA","username":"lasha.beradze","domain":"WATER.LOCAL","ip":"192.168.20.34","os":"Windows 10 Pro 22H2"}
```

```python
DEVICE_KEY = os.environ["HELPDESK_DEVICE_KEY"]

@router.post("/api/device/session")
def device_session(device: Device, x_device_key: str = Header(...), db: Session = Depends(get_db)):
    if not hmac.compare_digest(x_device_key, DEVICE_KEY):
        raise HTTPException(401, "მოწყობილობა არ არის რეგისტრირებული.")
    sam = device.username.strip().lower()
    user = db.query(User).filter_by(username=sam).one_or_none() or create_employee(db, sam)  # სახელი AD-დან
    # Device session ყოველთვის თანამშრომლის უფლებებით — IT-ის ანგარიშიც კი აქ მხოლოდ `user`-ია.
    token = create_jwt(sub=user.id, role="user", kind="device", hostname=device.hostname, ttl=timedelta(hours=12))
    return {"access_token": token, "user": {**user_out(user), "role": "user"}}
```

- JWT-ში `kind="device"` → ასეთი token-ით მხოლოდ თანამშრომლის endpoint-ები (`GET/POST /api/tickets` საკუთარზე, `GET /api/auth/me`). ყველა IT endpoint `require_staff`-ით: `kind == "password"` **და** როლი `agent`/`admin`.
- **გასაღები საიდუმლო არ არის თანამშრომლისთვის** (რეესტრი იკითხება). ის მხოლოდ "ჩვენი კომპიუტერიდან მოდის"-ს ამოწმებს. ამიტომ: device token-ს არასოდეს მისცე IT უფლებები; შეგიძლია დამატებით შეამოწმო, რომ `device.username` AD-ში არსებობს და ჩართულია, და რომ `ip` შიდა ქსელიდანაა.
- ძლიერი ვარიანტი მომავლისთვის: IIS/FastAPI Windows Integrated Auth (Kerberos) — მაშინ გასაღები აღარ დაგჭირდება.

## IT-ის შესვლა (`/api/auth/login`)

`{email, password, remember}`. `remember: true` → გრძელვადიანი token (მაგ. 14 დღე), სხვა შემთხვევაში 8–12 სთ. ვებ-აპი "დამახსოვრების" გარეშე token-ს ინახავს მხოლოდ ბრაუზერის ჩანართის სესიაში (`sessionStorage`).
- არასწორი მონაცემები → `401 {"detail":"ელ-ფოსტა ან პაროლი არასწორია."}`
- როლი `user` → `403 {"detail":"ვებ-სისტემა მხოლოდ IT პერსონალისთვისაა. მოთხოვნა გააგზავნეთ IT Support აპლიკაციიდან."}`
- პაროლი: `bcrypt`/`argon2`; რამდენიმე წარუმატებელ ცდაზე დროებითი ბლოკი (rate limit).

## RustDesk: ID და ერთჯერადი პაროლი

1. თანამშრომელი ხსნის მოთხოვნას. აპი კითხულობს RustDesk ID-ს (`rustdesk.exe --get-id`) და აგზავნის `remote_id`-ით `POST /api/tickets`-ში.
2. მოთხოვნის შექმნის შემდეგ აპი წერს `%ProgramData%\ITSupport\requests\<ticket id>.req` და უშვებს `\ITSupport\RemoteAccess` task-ს.
3. Task (SYSTEM, `deploy/RemoteAccess.ps1`) ადგენს ახალ შემთხვევით პაროლს (`rustdesk.exe --password`) და თვითონ აგზავნის სერვერზე. **აპი და თანამშრომელი პაროლს ვერ ხედავენ.**
4. IT ვებ-აპში ხედავს ID-ს, პაროლს (დამალულს, ჩვენება/კოპირება) და ღილაკს `rustdesk://connection/new/<id>?password=…`.

```python
AGENT_KEY = os.environ["HELPDESK_AGENT_KEY"]  # მხოლოდ SYSTEM-ს აქვს PC-ზე (HKLM\SOFTWARE\ITSupport\Agent)

@router.post("/api/tickets/{ticket_id}/remote", status_code=204)
def set_remote(ticket_id: int, body: RemoteIn, x_agent_key: str = Header(...), db: Session = Depends(get_db)):
    if not hmac.compare_digest(x_agent_key, AGENT_KEY):
        raise HTTPException(401)
    t = db.get(Ticket, ticket_id) or abort(404)
    # ყალბი .req ფაილი სხვის მოთხოვნას ვერ მიაბამს: კომპიუტერი უნდა ემთხვეოდეს.
    names = {t.device_hostname.lower(), (t.device_netbios or "").lower()}
    if body.hostname.lower() not in names and body.netbios.lower() not in names:
        raise HTTPException(403, "კომპიუტერი არ ემთხვევა მოთხოვნას.")
    if t.status == "closed" or t.created_at < utcnow() - timedelta(minutes=30):
        raise HTTPException(409)
    t.remote_id = body.rustdesk_id
    t.remote_password = fernet.encrypt(body.password.encode())  # დაშიფრული, არა plain text
    t.remote_updated_at = utcnow()
    db.commit()
```

- `GET /api/tickets/{id}` → `remote: {rustdesk_id, password, updated_at}` **მხოლოდ** `require_staff`-ზე; თანამშრომელს `remote: null`.
- `remote_id` `POST /api/tickets`-დან ინახე `rustdesk_id`-ად მაშინვე (password `null`, სანამ task არ გამოაგზავნის).
- პაროლი მუდმივია შემდეგ მოთხოვნამდე. მოთხოვნის დახურვისას შეგიძლია `remote_password` წაშალო ბაზიდან.

## ვებ-აპის განთავსება

```bash
npm run build:web      # → dist-web/
```

```python
from fastapi.staticfiles import StaticFiles
# API router-ების შემდეგ, ბოლოს:
app.mount("/", StaticFiles(directory="dist-web", html=True), name="web")
```

ერთი origin → CORS ვებ-აპისთვის არ სჭირდება. HTTPS აუცილებელია (პაროლი და RustDesk პაროლი გადის).

## CORS

```python
app.add_middleware(
    CORSMiddleware,
    # დესკტოპ აპი (Tauri) + dev სერვერები. ვებ-აპი იგივე origin-იდანაა.
    allow_origins=["http://tauri.localhost", "tauri://localhost", "http://localhost:1420", "http://localhost:1430"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```
