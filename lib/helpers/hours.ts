export function $hours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 1000 / 60 / 60
}
