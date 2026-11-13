// International Country Data & Calling Codes for Godavari One
// Supports seamless international user registration and phone validation.

export interface CountryInfo {
  code: string; // ISO 3166-1 alpha-2 (e.g. "IN", "US", "GB")
  name: string; // Country Name
  callingCode: string; // Calling code including '+' (e.g. "+91", "+1")
  flag: string; // Emoji flag representation
  placeholder: string; // Example national number format
  nationalLengths: number[]; // Valid digit lengths for national number
}

export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  {
    code: "IN",
    name: "India",
    callingCode: "+91",
    flag: "🇮🇳",
    placeholder: "98765 43210",
    nationalLengths: [10],
  },
  {
    code: "US",
    name: "United States",
    callingCode: "+1",
    flag: "🇺🇸",
    placeholder: "(555) 123-4567",
    nationalLengths: [10],
  },
  {
    code: "GB",
    name: "United Kingdom",
    callingCode: "+44",
    flag: "🇬🇧",
    placeholder: "7911 123456",
    nationalLengths: [10, 11],
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    callingCode: "+971",
    flag: "🇦🇪",
    placeholder: "50 123 4567",
    nationalLengths: [9],
  },
  {
    code: "SG",
    name: "Singapore",
    callingCode: "+65",
    flag: "🇸🇬",
    placeholder: "8123 4567",
    nationalLengths: [8],
  },
  {
    code: "AU",
    name: "Australia",
    callingCode: "+61",
    flag: "🇦🇺",
    placeholder: "412 345 678",
    nationalLengths: [9],
  },
  {
    code: "CA",
    name: "Canada",
    callingCode: "+1",
    flag: "🇨🇦",
    placeholder: "(416) 123-4567",
    nationalLengths: [10],
  },
  {
    code: "MY",
    name: "Malaysia",
    callingCode: "+60",
    flag: "🇲🇾",
    placeholder: "12-345 6789",
    nationalLengths: [9, 10],
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    callingCode: "+966",
    flag: "🇸🇦",
    placeholder: "50 123 4567",
    nationalLengths: [9],
  },
  {
    code: "QA",
    name: "Qatar",
    callingCode: "+974",
    flag: "🇶🇦",
    placeholder: "3312 3456",
    nationalLengths: [8],
  },
  {
    code: "KW",
    name: "Kuwait",
    callingCode: "+965",
    flag: "🇰🇼",
    placeholder: "5123 4567",
    nationalLengths: [8],
  },
  {
    code: "BH",
    name: "Bahrain",
    callingCode: "+973",
    flag: "🇧🇭",
    placeholder: "3612 3456",
    nationalLengths: [8],
  },
  {
    code: "OM",
    name: "Oman",
    callingCode: "+968",
    flag: "🇴🇲",
    placeholder: "9123 4567",
    nationalLengths: [8],
  },
  {
    code: "NZ",
    name: "New Zealand",
    callingCode: "+64",
    flag: "🇳🇿",
    placeholder: "21 123 4567",
    nationalLengths: [8, 9, 10],
  },
  {
    code: "DE",
    name: "Germany",
    callingCode: "+49",
    flag: "🇩🇪",
    placeholder: "151 12345678",
    nationalLengths: [10, 11],
  },
  {
    code: "ZA",
    name: "South Africa",
    callingCode: "+27",
    flag: "🇿🇦",
    placeholder: "82 123 4567",
    nationalLengths: [9],
  },
];

export const DEFAULT_COUNTRY: CountryInfo = SUPPORTED_COUNTRIES[0]; // India (+91)

export function getCountryByCode(code?: string): CountryInfo {
  if (!code) return DEFAULT_COUNTRY;
  const upper = code.trim().toUpperCase();
  const match = SUPPORTED_COUNTRIES.find((c) => c.code === upper);
  return match || DEFAULT_COUNTRY;
}

export function getCountryByCallingCode(callingCode: string): CountryInfo | undefined {
  const normalized = callingCode.startsWith("+") ? callingCode : `+${callingCode}`;
  return SUPPORTED_COUNTRIES.find((c) => c.callingCode === normalized);
}

/**
 * Attempts to detect the country from an input phone string (e.g. +1..., +44..., +91...).
 * Defaults to India (+91) if no country calling code is matched.
 */
export function guessCountryFromPhone(phone: string): { country: CountryInfo; nationalNumber: string } {
  if (!phone || typeof phone !== "string") {
    return { country: DEFAULT_COUNTRY, nationalNumber: "" };
  }

  const trimmed = phone.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    // Match longest calling code first (e.g., +971 before +9)
    const sorted = [...SUPPORTED_COUNTRIES].sort((a, b) => b.callingCode.length - a.callingCode.length);
    for (const c of sorted) {
      const codeDigits = c.callingCode.replace(/\D/g, "");
      if (digitsOnly.startsWith(codeDigits)) {
        return {
          country: c,
          nationalNumber: digitsOnly.slice(codeDigits.length),
        };
      }
    }
  }

  // Indian number variations: 098..., 9198...
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    return { country: DEFAULT_COUNTRY, nationalNumber: digitsOnly.slice(1) };
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    return { country: DEFAULT_COUNTRY, nationalNumber: digitsOnly.slice(2) };
  }

  return { country: DEFAULT_COUNTRY, nationalNumber: digitsOnly };
}
