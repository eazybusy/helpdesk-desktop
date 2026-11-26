// Company identity used in the header, footer and window title.

/** Mkhedruli → Mtavruli (Georgian capitals), as in the company lockup. */
const mtavruli = (s: string) => s.replace(/[ა-ჺ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x10d0 + 0x1c90));

export const BRAND = {
  nameKa: "საქართველოს გაერთიანებული წყალმომარაგების კომპანია",
  nameKaLines: [mtavruli("საქართველოს გაერთიანებული"), mtavruli("წყალმომარაგების კომპანია")],
  nameEn: "UNITED WATER SUPPLY COMPANY OF GEORGIA",
  system: "IT Support System",
  version: __APP_VERSION__,
  copyright: `© ${new Date().getFullYear()} United Water Supply Company. All rights reserved.`,
};
