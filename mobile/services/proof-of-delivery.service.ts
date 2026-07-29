import { supabase } from "@/lib/supabase";
import type { DeliveryProof, SignatureData } from "@/types/proofOfDelivery";

const proofSelect = "signature_id, delivery_id, signed_by_name, signature_data, signed_at, created_at";

export async function getDeliveryProofForDriver(deliveryId: string) {
  return supabase
    .from("delivery_signatures")
    .select(proofSelect)
    .eq("delivery_id", deliveryId)
    .maybeSingle<DeliveryProof>();
}

export async function submitDeliveryProof({
  deliveryId,
  recipientName,
  signatureData,
  signedAt,
}: {
  deliveryId: string;
  recipientName: string;
  signatureData: SignatureData;
  signedAt: string;
}) {
  return supabase
    .from("delivery_signatures")
    .insert({
      delivery_id: deliveryId,
      signed_by_name: recipientName,
      signature_data: signatureData,
      signed_at: signedAt,
    })
    .select(proofSelect)
    .maybeSingle<DeliveryProof>();
}
