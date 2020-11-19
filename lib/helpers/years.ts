export function $years(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 1000 / 60 / 60 / 24 / 365
}

