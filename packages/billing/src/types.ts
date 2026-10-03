export type TariffTier = {
  lowerKwh: string;
  upperKwh: string | null;
  rateSenPerKwh: string;
};

export type TierAllocation = TariffTier & {
  allocatedKwh: string;
  amountRm: string;
};

export type ChargeResult = {
  consumptionKwh: string;
  amountRm: string;
  displayAmountRm: string;
  allocations: TierAllocation[];
};
