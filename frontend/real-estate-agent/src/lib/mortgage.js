// US conventional mortgage with PMI when LTV > 80% (mirrors backend logic).
export function calcMortgage(price, downPct, years, rate) {
  const down = price * (downPct / 100);
  const principal = price - down;
  const pmiMonthly = downPct < 20 ? (principal * 0.008) / 12 : 0;
  const monthlyRate = (rate / 100) / 12;
  const n = years * 12;
  const pi = principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  return {
    down:      Math.round(down),
    principal: Math.round(principal),
    monthlyPI: Math.round(pi),
    pmi:       Math.round(pmiMonthly),
    monthly:   Math.round(pi + pmiMonthly),
  };
}
