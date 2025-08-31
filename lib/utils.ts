import { format } from 'date-fns';
export const fmtDate = (ts: number) => format(ts, 'MMM d, yyyy');
export const fmtTime = (ts: number) => format(ts, 'p');
export const now = () => Date.now();