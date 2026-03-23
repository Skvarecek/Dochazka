import { format, parseISO } from "date-fns";
import { cs } from "date-fns/locale";

export function formatDate(date: string | Date, fmt: string = "d. M. yyyy") {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt, { locale: cs });
}

export function entryTypeLabel(type: string): string {
  return { work: "Práce", vacation: "Dovolená", sick: "Nemoc", day_off: "Volno" }[type] || type;
}

export function entryTypeColor(type: string): string {
  return {
    work: "bg-blue-100 text-blue-800",
    vacation: "bg-emerald-100 text-emerald-800",
    sick: "bg-amber-100 text-amber-800",
    day_off: "bg-purple-100 text-purple-800",
  }[type] || "bg-gray-100 text-gray-800";
}

export function entryTypeShort(type: string): string {
  return { work: "", vacation: "D", sick: "N", day_off: "V" }[type] || "";
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

// Výpočet denní výplaty dle Excelu
export function calcDayPay(entryType: string, hours: number, hourlyRate: number, sickPercent: number): number {
  if (entryType === "vacation") return hourlyRate * 8;
  if (entryType === "sick") return hourlyRate * 8 * (sickPercent / 100);
  if (entryType === "work") return hourlyRate * hours;
  if (entryType === "day_off") return 0;
  return 0;
}
