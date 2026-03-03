import { parsePhoneNumberFromString } from "libphonenumber-js";
import { HttpError } from "@/lib/errors";

export function normalizePhoneE164(input: string, defaultCountry: "US" = "US") {
  const parsed = parsePhoneNumberFromString(input, defaultCountry);

  if (!parsed || !parsed.isValid()) {
    throw new HttpError(400, "INVALID_PHONE", "Invalid phone number");
  }

  return parsed.number;
}
