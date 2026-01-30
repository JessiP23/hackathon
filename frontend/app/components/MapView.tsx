import { Vendor, Deal, Location } from "../shared/types";

interface Props {
  vendors?: Vendor[];
  deals?: Deal[];
  userLocation?: Location | null;
}

export default function MapView({ vendors = [], deals = [], userLocation }: Props) {
  return (
    <div className="h-72 bg-gray-200 flex items-center justify-center text-sm text-gray-600">
      <div className="text-center">
        <div>Map Placeholder</div>
        {userLocation && (
          <div>
            {userLocation.lat.toFixed(3)}, {userLocation.lng.toFixed(3)}
          </div>
        )}
        <div>Pins: {vendors.length + deals.length}</div>
      </div>
    </div>
  );
}
