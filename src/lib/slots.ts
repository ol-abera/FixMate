/** Time-slot helpers; mirror backend/bookings/scheduling.py. Slots look like "10:00 - 12:00". */
export function slotRange(slot: string): [number, number] | null {
  const m = /^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/.exec(slot.trim());
  return m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null;
}

export function slotsOverlap(a: string, b: string) {
  const x = slotRange(a), y = slotRange(b);
  return !!x && !!y && x[0] < y[1] && y[0] < x[1];
}
