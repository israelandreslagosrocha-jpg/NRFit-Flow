import { connection } from 'next/server';
import CheckoutClient from './CheckoutClient';
import { getCurrentMembershipOffer } from '../../lib/offers/membership-offer';

export default async function CheckoutPage() {
  // El resumen comercial debe calcularse por solicitud, no durante el build.
  await connection();

  return <CheckoutClient offer={getCurrentMembershipOffer()} />;
}
