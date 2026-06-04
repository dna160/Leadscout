export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  let e164: string;
  if (digits.startsWith("62")) {
    e164 = digits;
  } else if (digits.startsWith("0")) {
    e164 = "62" + digits.slice(1);
  } else if (digits.startsWith("8")) {
    e164 = "62" + digits;
  } else {
    e164 = digits;
  }

  if (e164.length < 10 || e164.length > 15) return null;
  return "+" + e164;
}

export function toWhatsApp(phone: string | null | undefined): string | null {
  const normalised = normalisePhone(phone);
  if (!normalised) return null;
  const digits = normalised.replace("+", "");
  return `https://wa.me/${digits}`;
}
