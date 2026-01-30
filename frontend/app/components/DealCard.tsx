import { Deal } from "../shared/types";

interface Props {
  deal: Deal;
}

export default function DealCard({ deal }: Props) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="font-medium">{deal.item}</div>
      <div className="text-green-600 font-semibold">${deal.price}</div>
      <div className="text-sm text-gray-500">{deal.distance_m}m away</div>
    </div>
  );
}
