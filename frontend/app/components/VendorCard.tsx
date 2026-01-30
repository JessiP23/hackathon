import { Vendor } from "../shared/types";
import Link from "next/link";

interface Props {
  vendor: Vendor;
}

export default function VendorCard({ vendor }: Props) {
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="font-medium">{vendor.name}</div>
      <div className="text-sm text-gray-500">{vendor.distance_m}m away</div>

      <Link
        href={`/vendor/${vendor.vendorId}`}
        className="inline-block mt-2 text-sm text-blue-600"
      >
        View Menu →
      </Link>
    </div>
  );
}
