type LocalTransportInput = {
  localTransport?: {
    required?: unknown;
    fee?: unknown;
    from?: unknown;
    to?: unknown;
    note?: unknown;
  };
  localTransportRequired?: unknown;
  localTransportFee?: unknown;
  localTransportFrom?: unknown;
  localTransportTo?: unknown;
  localTransportNote?: unknown;
};

export function normalizeLocalTransport(input: LocalTransportInput) {
  const source = input.localTransport ?? {};
  const required =
    typeof source.required === 'boolean'
      ? source.required
      : typeof input.localTransportRequired === 'boolean'
        ? input.localTransportRequired
        : false;

  const rawFee = source.fee ?? input.localTransportFee ?? 0;
  const fee = Number(rawFee);
  if (Number.isNaN(fee) || fee < 0) {
    throw new Error('Local transport fee must be a valid non-negative number');
  }

  const from = typeof source.from === 'string' ? source.from : typeof input.localTransportFrom === 'string' ? input.localTransportFrom : '';
  const to = typeof source.to === 'string' ? source.to : typeof input.localTransportTo === 'string' ? input.localTransportTo : '';
  const note = typeof source.note === 'string' ? source.note : typeof input.localTransportNote === 'string' ? input.localTransportNote : '';

  return {
    required,
    fee,
    from: from || null,
    to: to || null,
    note: note || null
  };
}

export function buildOrderItemLocalTransport(product: any) {
  const localTransport = product?.localTransport || {};
  const required = !!localTransport.required;
  const fee = Number(localTransport.fee || 0);

  return {
    localTransportRequired: required,
    localTransportFee: Number.isNaN(fee) ? 0 : fee,
    localTransportFrom: localTransport.from || null,
    localTransportTo: localTransport.to || null,
    localTransportNote: localTransport.note || null
  };
}
