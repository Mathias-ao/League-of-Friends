/** Keep full precision in storage; round shared points only for presentation. */
export function formatLeaguePoints(value:number):string {
  const rounded=Math.round(value*100)/100;
  return (Math.abs(rounded-value)>1e-9?"≈":"")+new Intl.NumberFormat("en-GB",{maximumFractionDigits:2}).format(Math.abs(value)<1e-9 ? 0:value);
}
