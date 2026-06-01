import { format, parseISO } from "date-fns";
import { cs } from "date-fns/locale";

// Lokální datum jako YYYY-MM-DD string (bez UTC konverze)
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDate(date: string | Date, fmt: string = "d. M. yyyy") {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt, { locale: cs });
}

export function entryTypeLabel(type: string): string {
  return { work: "Práce", vacation: "Dovolená", sick: "Nemoc", day_off: "Volno", holiday: "Svátek" }[type] || type;
}

export function entryTypeColor(type: string): string {
  return {
    work: "bg-blue-100 text-blue-800",
    vacation: "bg-emerald-100 text-emerald-800",
    sick: "bg-amber-100 text-amber-800",
    day_off: "bg-purple-100 text-purple-800",
    holiday: "bg-red-100 text-red-800",
  }[type] || "bg-gray-100 text-gray-800";
}

export function entryTypeShort(type: string): string {
  return { work: "", vacation: "D", sick: "N", day_off: "V", holiday: "S" }[type] || "";
}

export function categoryLabel(cat: string): string {
  return {
    advance: "Záloha",
    loan: "Splátka půjčky",
    insolvence: "Insolvence",
    insurance_health: "Zdravotní poj.",
    insurance_social: "Sociální poj.",
    internet: "Internet",
    other: "Jiné",
    premium: "Prémie / Odměna",
  }[cat] || cat;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Výpočet denní výplaty
// Svátek: hodiny × sazba × (bonus_percent / 100)
export function calcDayPay(entryType: string, hours: number, hourlyRate: number, sickPercent: number, bonusPercent: number = 100): number {
  if (entryType === "vacation") return hourlyRate * 8;
  if (entryType === "sick") return hourlyRate * 8 * (sickPercent / 100);
  if (entryType === "work") return hourlyRate * hours;
  if (entryType === "holiday") return hourlyRate * hours * (bonusPercent / 100);
  if (entryType === "day_off") return 0;
  return 0;
}

// České státní svátky (pevné datumy)
// Velikonoce se počítají dynamicky
function easterMonday(year: number): string {
  // Algoritmus pro výpočet Velikonočního pondělí (Oudin's algorithm)
  const f = Math.floor;
  const G = year % 19;
  const C = f(year / 100);
  const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J;
  const month = 3 + f((L + 40) / 44);
  const day = L + 28 - 31 * f(month / 4);
  // Easter Sunday + 1 = Easter Monday
  const easterSunday = new Date(year, month - 1, day);
  const monday = new Date(easterSunday);
  monday.setDate(monday.getDate() + 1);
  return toDateStr(monday);
}

function goodFriday(year: number): string {
  const em = easterMonday(year);
  const d = parseISO(em);
  d.setDate(d.getDate() - 3);
  return toDateStr(d);
}

export function getCzechHolidays(year: number): Record<string, string> {
  return {
    [`${year}-01-01`]: "Nový rok",
    [goodFriday(year)]: "Velký pátek",
    [easterMonday(year)]: "Velikonoční pondělí",
    [`${year}-05-01`]: "Svátek práce",
    [`${year}-05-08`]: "Den vítězství",
    [`${year}-07-05`]: "Cyril a Metoděj",
    [`${year}-07-06`]: "Jan Hus",
    [`${year}-09-28`]: "Den české státnosti",
    [`${year}-10-28`]: "Vznik Československa",
    [`${year}-11-17`]: "Den boje za svobodu",
    [`${year}-12-24`]: "Štědrý den",
    [`${year}-12-25`]: "1. svátek vánoční",
    [`${year}-12-26`]: "2. svátek vánoční",
  };
}

export function isCzechHoliday(dateStr: string): string | null {
  const year = parseInt(dateStr.substring(0, 4));
  const holidays = getCzechHolidays(year);
  return holidays[dateStr] || null;
}
