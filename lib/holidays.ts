/* ==========================================================================
   INDIA HOLIDAYS, FESTIVALS AND OBSERVANCES
   Source: Department of Personnel & Training (DoPT) holiday lists for Central
   Government offices (2026: O.M. dated 3 July 2025, 2027: O.M. dated
   16 July 2026) plus a few fixed-date observances.

   public      = gazetted public holiday
   festival    = restricted holiday / festival
   observance  = other notable day

   Islamic festival dates depend on moon sighting and can shift by a day.
   To add another year, add a block to DATA below - the calendar picks it up.
   ========================================================================== */
export type HolidayType = "public" | "festival" | "observance";
export type Holiday = { date: string; name: string; type: HolidayType };

type Row = [string, string, HolidayType]; // [MM-DD, name, type]

/* ---------- 2026 ---------- */
const Y2026: Row[] = [
  // Public holidays (gazetted)
  ["01-26", "Republic Day", "public"],
  ["03-04", "Holi", "public"],
  ["03-21", "Id-ul-Fitr", "public"],
  ["03-26", "Ram Navami", "public"],
  ["03-31", "Mahavir Jayanti", "public"],
  ["04-03", "Good Friday", "public"],
  ["05-01", "Buddha Purnima", "public"],
  ["05-27", "Id-ul-Zuha (Bakrid)", "public"],
  ["06-26", "Muharram", "public"],
  ["08-15", "Independence Day", "public"],
  ["08-26", "Milad-un-Nabi", "public"],
  ["09-04", "Janmashtami", "public"],
  ["10-02", "Gandhi Jayanti", "public"],
  ["10-20", "Dussehra", "public"],
  ["11-08", "Diwali", "public"],
  ["11-24", "Guru Nanak Jayanti", "public"],
  ["12-25", "Christmas Day", "public"],
  // Festivals (restricted holidays)
  ["01-01", "New Year's Day", "observance"],
  ["01-03", "Hazrat Ali's Birthday", "festival"],
  ["01-14", "Makar Sankranti / Pongal", "festival"],
  ["01-23", "Basant Panchami", "festival"],
  ["02-01", "Guru Ravidas Jayanti", "festival"],
  ["02-12", "Dayananda Saraswati Jayanti", "festival"],
  ["02-15", "Maha Shivratri", "festival"],
  ["02-19", "Shivaji Jayanti", "festival"],
  ["03-03", "Holika Dahan", "festival"],
  ["03-19", "Ugadi / Gudi Padwa", "festival"],
  ["03-20", "Jamat-ul-Vida", "festival"],
  ["04-05", "Easter Sunday", "festival"],
  ["04-14", "Vaisakhi / Vishu / Tamil New Year", "festival"],
  ["04-15", "Bengali New Year / Bahag Bihu", "festival"],
  ["05-09", "Tagore Jayanti", "festival"],
  ["07-16", "Rath Yatra", "festival"],
  ["08-15", "Parsi New Year", "festival"],
  ["08-26", "Onam", "festival"],
  ["08-28", "Raksha Bandhan", "festival"],
  ["09-14", "Ganesh Chaturthi", "festival"],
  ["10-18", "Dussehra (Saptami)", "festival"],
  ["10-19", "Dussehra (Maha Ashtami)", "festival"],
  ["10-26", "Valmiki Jayanti", "festival"],
  ["10-29", "Karwa Chauth", "festival"],
  ["11-09", "Govardhan Puja", "festival"],
  ["11-11", "Bhai Dooj", "festival"],
  ["11-15", "Chhath Puja", "festival"],
  ["11-24", "Guru Teg Bahadur Martyrdom Day", "festival"],
  ["12-23", "Hazrat Ali's Birthday", "festival"],
  ["12-24", "Christmas Eve", "festival"],
];

/* ---------- 2027 ---------- */
const Y2027: Row[] = [
  // Public holidays (gazetted)
  ["01-26", "Republic Day", "public"],
  ["03-10", "Id-ul-Fitr", "public"],
  ["03-23", "Holi", "public"],
  ["03-26", "Good Friday", "public"],
  ["04-15", "Ram Navami", "public"],
  ["04-19", "Mahavir Jayanti", "public"],
  ["05-17", "Id-ul-Zuha (Bakrid)", "public"],
  ["05-20", "Buddha Purnima", "public"],
  ["06-16", "Muharram", "public"],
  ["08-15", "Independence Day", "public"],
  ["08-15", "Milad-un-Nabi", "public"],
  ["08-25", "Janmashtami", "public"],
  ["10-02", "Gandhi Jayanti", "public"],
  ["10-09", "Dussehra", "public"],
  ["10-29", "Diwali", "public"],
  ["11-14", "Guru Nanak Jayanti", "public"],
  ["12-25", "Christmas Day", "public"],
  // Festivals (restricted holidays)
  ["01-01", "New Year's Day", "observance"],
  ["01-14", "Makar Sankranti / Magha Bihu", "festival"],
  ["01-15", "Pongal / Guru Gobind Singh Jayanti", "festival"],
  ["02-11", "Basant Panchami", "festival"],
  ["02-19", "Shivaji Jayanti", "festival"],
  ["02-20", "Guru Ravidas Jayanti", "festival"],
  ["03-02", "Dayananda Saraswati Jayanti", "festival"],
  ["03-05", "Jamat-ul-Vida", "festival"],
  ["03-06", "Maha Shivratri", "festival"],
  ["03-22", "Holika Dahan / Dolyatra", "festival"],
  ["03-28", "Easter Sunday", "festival"],
  ["04-07", "Ugadi / Gudi Padwa", "festival"],
  ["04-14", "Vaisakhi / Vishu / Tamil New Year", "festival"],
  ["04-15", "Bengali New Year / Bahag Bihu", "festival"],
  ["05-09", "Tagore Jayanti", "festival"],
  ["07-05", "Rath Yatra", "festival"],
  ["08-15", "Parsi New Year", "festival"],
  ["08-17", "Raksha Bandhan", "festival"],
  ["09-04", "Ganesh Chaturthi", "festival"],
  ["09-12", "Onam", "festival"],
  ["10-06", "Dussehra (Saptami)", "festival"],
  ["10-07", "Dussehra (Maha Ashtami)", "festival"],
  ["10-08", "Dussehra (Maha Navami)", "festival"],
  ["10-15", "Valmiki Jayanti", "festival"],
  ["10-18", "Karwa Chauth", "festival"],
  ["10-28", "Naraka Chaturdashi", "festival"],
  ["10-30", "Govardhan Puja", "festival"],
  ["10-31", "Bhai Dooj", "festival"],
  ["11-04", "Chhath Puja", "festival"],
  ["11-24", "Guru Teg Bahadur Martyrdom Day", "festival"],
  ["12-12", "Hazrat Ali's Birthday", "festival"],
  ["12-24", "Christmas Eve", "festival"],
];

const DATA: Record<number, Row[]> = { 2026: Y2026, 2027: Y2027 };

/* ---------- fixed-date days that repeat every year ---------- */
const FIXED_OBSERVANCES: Row[] = [
  ["04-14", "Ambedkar Jayanti", "observance"],
  ["05-01", "Labour Day", "observance"],
  ["09-05", "Teachers' Day", "observance"],
  ["11-01", "Kannada Rajyotsava", "observance"],
  ["11-14", "Children's Day", "observance"],
  ["12-31", "New Year's Eve", "observance"],
];

// Used for years that are not in DATA yet.
const FIXED_PUBLIC: Row[] = [
  ["01-26", "Republic Day", "public"],
  ["08-15", "Independence Day", "public"],
  ["10-02", "Gandhi Jayanti", "public"],
  ["12-25", "Christmas Day", "public"],
  ["01-01", "New Year's Day", "observance"],
];

/* ==========================================================================
   Public API: all holidays of one year, as { "YYYY-MM-DD": Holiday[] }
   ========================================================================== */
export function holidaysByDate(year: number): Record<string, Holiday[]> {
  const rows = [...(DATA[year] || FIXED_PUBLIC), ...FIXED_OBSERVANCES];
  const map: Record<string, Holiday[]> = {};

  for (const [md, name, type] of rows) {
    const date = `${year}-${md}`;
    (map[date] ||= []).push({ date, name, type });
  }

  // Public holidays first, then festivals, then observances.
  const order: Record<HolidayType, number> = { public: 0, festival: 1, observance: 2 };
  Object.values(map).forEach((list) => list.sort((a, b) => order[a.type] - order[b.type]));

  return map;
}

export const hasHolidayData = (year: number) => Boolean(DATA[year]);
