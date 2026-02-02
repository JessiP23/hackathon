import Link from "next/link";
import { Deal } from "../shared/types";

interface Props {
  deal: Deal;
}

export default function DealCard({ deal }: Props) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-medium">{deal.itemName}</div>
          <div className="text-sm text-gray-500">{deal.vendorName}</div>
        </div>
        <div className="text-right">
          <div className="text-green-600 font-bold text-lg">${deal.dealPrice.toFixed(2)}</div>
          {deal.originalPrice && (
            <div className="text-sm text-gray-400 line-through">
              ${deal.originalPrice.toFixed(2)}
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between items-center mt-3">
        <div className="text-sm text-gray-500">{deal.distance_m}m away</div>
        <Link
          href={`/vendor/${deal.vendorId}`}
          className="text-sm text-blue-600 font-medium"
        >
          View Vendor
        </Link>
      </div>
    </div>
  );
}