/** Shared visual status for the professional and administrator diary. */
export function lessonSlotStatus(slot, now = Date.now()) {
 if (!slot.active) return {state:'inactive',label:'Cancelled'};
 const count = slot.group_id ? Number(slot.booked_count || 0) : (slot.booking_id ? 1 : 0);
 if (new Date(slot.ends_at).getTime() <= now) return {state:'inactive',label:count ? 'Completed' : 'Unbooked'};
 if (new Date(slot.starts_at).getTime() <= now) return {state:'busy',label:'In progress'};
 if (!slot.group_id) return count ? {state:'busy',label:'Busy · booked'} : {state:'available',label:'Bookable'};
 if (slot.capacity != null && count >= slot.capacity) return {state:'busy',label:'Busy · full group'};
 if (slot.group_mode === 'Roster' && count > 0) return {state:'busy',label:'Busy · roster group'};
 if (count > 0) return {state:'partial',label:'Busy · places left'};
 return {state:'available',label:'Bookable · group'};
}
