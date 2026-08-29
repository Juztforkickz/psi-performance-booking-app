const HORSEPOWER_PER_KILOWATT = 1.34102209;

export function kilowattsToHorsepower(value: number) {
  return Math.round(value * HORSEPOWER_PER_KILOWATT * 10) / 10;
}

export function horsepowerToKilowatts(value: number) {
  return Math.round((value / HORSEPOWER_PER_KILOWATT) * 100) / 100;
}
