
import type { Property } from "./properties";

export const DEFAULT_MATCH_RAHN_RATE = 30_000;
export const BUDGET_NEAR_RATIO = 1.15;

export type BudgetInput = {
  depositBudget: number;
  rentBudget: number;
};

export type BudgetMatchTier = "within" | "convertible" | "near";

export type BudgetMatchDetails = {
  tier: BudgetMatchTier;
  score: number;
  rate: number;
  propertyTotalEquivalent: number;
  budgetTotalEquivalent: number;
  gapEquivalent: number;
  suggestedDeposit: number;
  suggestedRent: number;
};

function numeric(value: string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function totalRahnEquivalent(
  deposit: number,
  rent: number,
  rate = DEFAULT_MATCH_RAHN_RATE,
): number {
  if (rate <= 0) return Math.max(0, deposit);
  return Math.max(0, deposit) + (Math.max(0, rent) * 1_000_000) / rate;
}

export function budgetTotalEquivalent(
  budget: BudgetInput,
  rate = DEFAULT_MATCH_RAHN_RATE,
): number {
  return totalRahnEquivalent(budget.depositBudget, budget.rentBudget, rate);
}

export function calculateBudgetMatch(
  property: Property,
  budget: BudgetInput,
  rate = DEFAULT_MATCH_RAHN_RATE,
): BudgetMatchDetails | null {
  const deposit = numeric(property.deposit);
  const rent = numeric(property.rent);
  const budgetDeposit = Math.max(0, budget.depositBudget);
  const budgetRent = Math.max(0, budget.rentBudget);
  const budgetTotal = budgetTotalEquivalent(budget, rate);

  if (budgetTotal <= 0 || (deposit <= 0 && rent <= 0)) return null;

  const propertyTotal = totalRahnEquivalent(deposit, rent, rate);
  const within = deposit <= budgetDeposit && rent <= budgetRent;
  const convertible = !within && propertyTotal <= budgetTotal;
  const near = !within && !convertible && propertyTotal <= budgetTotal * BUDGET_NEAR_RATIO;

  if (!within && !convertible && !near) return null;

  const usage = budgetTotal > 0 ? propertyTotal / budgetTotal : 1;
  const distance = Math.abs(1 - usage);
  const baseScore = Math.max(0, 100 - Math.round(Math.min(1, distance) * 100));
  const score = Math.min(100, baseScore + (within ? 8 : convertible ? 4 : 0));

  const suggestedDeposit = Math.min(deposit, budgetDeposit);
  const remainingEquivalent = Math.max(0, propertyTotal - suggestedDeposit);
  const suggestedRent = remainingEquivalent * rate / 1_000_000;

  return {
    tier: within ? "within" : convertible ? "convertible" : "near",
    score,
    rate,
    propertyTotalEquivalent: propertyTotal,
    budgetTotalEquivalent: budgetTotal,
    gapEquivalent: propertyTotal - budgetTotal,
    suggestedDeposit,
    suggestedRent,
  };
}

export function tierLabel(tier: BudgetMatchTier): string {
  if (tier === "within") return "داخل بودجه شما";
  if (tier === "convertible") return "قابل تبدیل";
  return "کمی بالاتر از بودجه";
}
