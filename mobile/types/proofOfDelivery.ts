export type SignaturePoint = {
  x: number;
  y: number;
};

export type SignatureStroke = SignaturePoint[];

export type SignatureData = {
  strokes: SignatureStroke[];
  version: 1;
};

export type DeliveryProof = {
  created_at: string;
  delivery_id: string;
  signature_data: SignatureData;
  signature_id: string;
  signed_by_name: string;
  signed_at: string;
};
