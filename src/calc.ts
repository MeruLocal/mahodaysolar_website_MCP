const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export interface SizeInput { monthly_kwh: number; peak_sun_hours: number; performance_ratio: number; panel_watt: number; roof_m2_per_kw?: number }

/** required kW = monthly kWh / (30 x peak sun hours x performance ratio). Every parameter is caller-supplied. */
export function sizeEstimate(i: SizeInput) {
  const kw = i.monthly_kwh / (30 * i.peak_sun_hours * i.performance_ratio);
  const panels = Math.ceil((kw * 1000) / i.panel_watt);
  return {
    required_kw: round(kw, 3),
    panel_count: panels,
    installed_kw_at_panel_count: round((panels * i.panel_watt) / 1000, 3),
    roof_area_m2: i.roof_m2_per_kw === undefined ? null : round(kw * i.roof_m2_per_kw, 1),
    formula: "required_kw = monthly_kwh / (30 * peak_sun_hours * performance_ratio); panel_count = ceil(required_kw * 1000 / panel_watt)",
  };
}

export interface EmiInput { principal: number; annual_rate_percent: number; tenure_months: number }

export function emi(i: EmiInput) {
  const r = i.annual_rate_percent / 12 / 100;
  const n = i.tenure_months;
  const monthly = r === 0 ? i.principal / n : (i.principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  const total = monthly * n;
  return {
    monthly_emi: round(monthly),
    total_payable: round(total),
    total_interest: round(total - i.principal),
    formula: "EMI = P * r * (1+r)^n / ((1+r)^n - 1), r = annual_rate_percent / 12 / 100; r = 0 gives P / n",
  };
}
