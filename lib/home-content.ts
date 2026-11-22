export function dayInSeoul(now = new Date()): string {
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function isActiveEntry(entry: {startDate:string;endDate:string|null}, day:string): boolean {
 const date=/^\d{4}-\d{2}-\d{2}$/;
 return date.test(day)&&date.test(entry.startDate)&&(!entry.endDate||date.test(entry.endDate))&&entry.startDate<=day&&(!entry.endDate||day<=entry.endDate);
}
