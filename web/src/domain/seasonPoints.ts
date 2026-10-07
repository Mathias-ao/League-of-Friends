/** Keep full precision in storage; round shared points only for presentation. */
export function formatLeaguePoints(value:number):string {
  return new Intl.NumberFormat("en-GB",{maximumFractionDigits:2}).format(Math.abs(value)<1e-9 ? 0:value);
}
