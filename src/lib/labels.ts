import type { TicketCategory, TicketStatus } from "./types";

export const STATUS: Record<TicketStatus, string> = {
  new: "ახალი",
  open: "მუშავდება",
  closed: "დასრულებული",
};
export const STATUS_ORDER: TicketStatus[] = ["new", "open", "closed"];

/** Default deadline in hours until the admin sets one per category (SLA page; the server keeps the policy). */
export const SLA_HOURS = 24;
/** Deadlines the admin can choose from. */
export const SLA_CHOICES = [1, 2, 4, 8, 24, 48, 72];


export const CATEGORY: Record<TicketCategory, string> = {
  hardware: "კომპიუტერი",
  printer: "პრინტერი, სკანერი",
  network: "ქსელი, ინტერნეტი",
  email: "ელ-ფოსტა",
  software: "პროგრამა",
  access: "პაროლი, წვდომა",
  other: "სხვა",
};
export const CATEGORY_ORDER: TicketCategory[] = ["hardware", "printer", "network", "email", "software", "access", "other"];


// ---- regions (reg-<slug>-<user> computer names) ----

const REGIONS: Record<string, string> = {
  mtskheta: "მცხეთა", dusheti: "დუშეთი", tianeti: "თიანეთი", kazbegi: "ყაზბეგი",
  rustavi: "რუსთავი", gardabani: "გარდაბანი", marneuli: "მარნეული", bolnisi: "ბოლნისი",
  dmanisi: "დმანისი", tetritskaro: "თეთრიწყარო", tsalka: "წალკა",
  gori: "გორი", kaspi: "კასპი", kareli: "ქარელი", khashuri: "ხაშური",
  telavi: "თელავი", gurjaani: "გურჯაანი", sighnaghi: "სიღნაღი", signagi: "სიღნაღი",
  kvareli: "ყვარელი", lagodekhi: "ლაგოდეხი", sagarejo: "საგარეჯო", dedoplistskaro: "დედოფლისწყარო", akhmeta: "ახმეტა",
  kutaisi: "ქუთაისი", zestaponi: "ზესტაფონი", samtredia: "სამტრედია", tkibuli: "ტყიბული", chiatura: "ჭიათურა",
  sachkhere: "საჩხერე", tskaltubo: "წყალტუბო", khoni: "ხონი", terjola: "თერჯოლა",
  batumi: "ბათუმი", kobuleti: "ქობულეთი", ozurgeti: "ოზურგეთი", lanchkhuti: "ლანჩხუთი",
  zugdidi: "ზუგდიდი", poti: "ფოთი", senaki: "სენაკი", martvili: "მარტვილი", tsalenjikha: "წალენჯიხა",
  akhaltsikhe: "ახალციხე", borjomi: "ბორჯომი", akhalkalaki: "ახალქალაქი", ninotsminda: "ნინოწმინდა", adigeni: "ადიგენი", aspindza: "ასპინძა",
  ambrolauri: "ამბროლაური", oni: "ონი", tsageri: "ცაგერი", mestia: "მესტია",
};

export const regionName = (slug: string) => REGIONS[slug.toLowerCase()] ?? slug.charAt(0).toUpperCase() + slug.slice(1);

/** Same rule the server uses: reg-<region>-... (NetBIOS truncation may cut the trailing dash). */
export const regionFromHost = (host: string) => /^reg-([a-z]+)(?:-|$)/i.exec(host)?.[1]?.toLowerCase() ?? null;

// ---- computer state ----

export const PRINTER_STATE: Record<import("./types").PrinterState, string> = {
  ready: "მზადაა",
  printing: "ბეჭდავს",
  offline: "კავშირგარეშე",
  paused: "შეჩერებულია",
  error: "შეცდომა",
  paper_jam: "ქაღალდი გაიჭედა",
  no_paper: "ქაღალდი ამოიწურა",
  low_toner: "ტონერი იწურება",
  no_toner: "ტონერი ამოიწურა",
  door_open: "სახურავი ღიაა",
  unknown: "უცნობი",
};

export const DISK_HEALTH: Record<import("./types").DiskHealth, string> = {
  Healthy: "ჯანმრთელი",
  Warning: "გაფრთხილება",
  Unhealthy: "დაზიანებული",
  Unknown: "უცნობი",
};

export const MEDIA_LABEL: Record<import("./types").DiskMedia, string> = {
  HDD: "HDD",
  SSD: "SSD",
  NVMe: "M.2 NVMe",
  Unknown: "დისკი",
};

// ---- event log (mirrors eventlog-pipeline/server/problem_rules.py) ----

export const LOG_CATEGORY: Record<string, string> = {
  file_delete: "ფაილის წაშლა",
  file_write: "ფაილის შეცვლა/ჩაწერა",
  file_transfer: "ფაილის გადატანა (USB/ქსელი)",
  file_acl: "ფაილის უფლებების შეცვლა",
  device: "მოწყობილობის მიერთება",
  session: "შესვლა/გამოსვლა",
  auth: "ავთენტიფიკაცია",
  security: "უსაფრთხოება",
  hardware: "აპარატურა",
  system: "სისტემა/სერვისი",
  network: "ქსელი/დომენი",
  app: "აპლიკაცია",
  profile: "მომხმარებლის პროფილი",
  print: "ბეჭდვა",
  performance: "წარმადობა",
  critical: "კრიტიკული",
  other: "სხვა",
};

export const LOG_LEVEL: Record<number, string> = { 0: "ინფორმაცია", 1: "კრიტიკული", 2: "შეცდომა", 3: "გაფრთხილება", 4: "ინფორმაცია", 5: "დეტალური" };

export const SAM_SOURCE: Record<string, { label: string; hint: string; fact: boolean }> = {
  event: { label: "ფაქტი", hint: "მომხმარებელი პირდაპირ ლოგშია", fact: true },
  session: { label: "სესიით", hint: "დასკვნა: მოვლენა მომხმარებლის სესიის დროს მოხდა", fact: false },
  sid: { label: "SID-ით", hint: "SID ითარგმნა ანგარიშად", fact: true },
  console: { label: "კონსოლით", hint: "დასკვნა: ვინ იჯდა მანქანაზე აგენტის ციკლისას", fact: false },
};
