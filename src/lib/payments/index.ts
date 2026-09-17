import { FlowGatewayAdapter } from './flow/adapter.ts';
import type { PaymentGateway } from './types.ts';

let cachedGateway: PaymentGateway | null = null;

export function getPaymentGateway(): PaymentGateway {
  if (!cachedGateway) {
    cachedGateway = new FlowGatewayAdapter();
  }
  return cachedGateway;
}

// Para testing o inyección de dependencias
export function setPaymentGateway(gateway: PaymentGateway | null) {
  cachedGateway = gateway;
}

export * from './types.ts';
