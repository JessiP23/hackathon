import { Vendor } from "../shared/types";
import Link from "next/link";

interface MatchingItem {
  name: string;
  price: number;
}

interface Props {
  vendor: Vendor & { matchingItems?: MatchingItem[] };
}

export default function VendorCard({ vendor }: Props) {
  return (
    <Link href={`/vendor/${vendor.vendorId}`} className="block">
      <div className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-semibold text-lg">{vendor.name}</div>
            <div className="text-sm text-gray-500">{vendor.distance_m}m away</div>
            {vendor.businessHours && (
              <div className="text-xs text-gray-400">{vendor.businessHours}</div>
            )}
          </div>
          <div className="text-blue-600 text-sm">View →</div>
        </div>

        {/* Show matching menu items */}
        {vendor.matchingItems && vendor.matchingItems.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-gray-500 mb-1">Matching items:</div>
            <div className="flex flex-wrap gap-2">
              {vendor.matchingItems.slice(0, 3).map((item, i) => (
                <span key={i} className="text-sm bg-green-50 text-green-700 px-2 py-1 rounded">
                  {item.name} · ${item.price.toFixed(2)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}