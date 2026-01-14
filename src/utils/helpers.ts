export function parseAmount(str: string): number {
  const m = str.match(/[\d,\.]+/);
  return m ? parseFloat(m[0].replace(',', '.')) : 0;
}

export interface ParsedDonation {
  donor: string;
  amount: string;
  message: string;
}

export function parseDonationMessage(message: string): ParsedDonation | null {
  const match = message.match(/^(.+?)\s+(?:doou|mandou)\s+(R\$\s?[\d,\.]+)(?::\s*|\s+e disse:\s*)(.*)$/i);
  if (!match) return null;
  return {
    donor: match[1].trim(),
    amount: match[2],
    message: match[3].trim()
  };
}
