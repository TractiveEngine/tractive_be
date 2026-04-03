export function getEffectiveProductBidAmount(bid: any) {
  if (typeof bid?.counterOffer === 'number' && !Number.isNaN(bid.counterOffer) && bid.counterOffer > 0) {
    return bid.counterOffer;
  }
  return Number(bid?.amount || 0);
}

