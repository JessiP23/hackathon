import { Vendor, Deal, Location } from "../shared/types";

interface Props {
  vendors?: Vendor[];
  deals?: Deal[];
  userLocation?: Location | null;
  highlightedVendor?: string | null;
}

export default function MapView({ vendors = [], deals = [], userLocation, highlightedVendor }: Props) {
  // Calculate bounds
  const allLocs = [
    ...(userLocation ? [userLocation] : []),
    ...vendors.filter(v => v.location).map(v => v.location!),
  ];

  const centerLat = allLocs.length ? allLocs.reduce((s, l) => s + l.lat, 0) / allLocs.length : 40.7128;
  const centerLng = allLocs.length ? allLocs.reduce((s, l) => s + l.lng, 0) / allLocs.length : -74.006;

  return (
    <div className="h-48 bg-neutral-900 relative overflow-hidden">
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(10)].map((_, i) => (
          <div key={`h-${i}`} className="absolute w-full h-px bg-white/30" style={{ top: `${i * 10}%` }} />
        ))}
        {[...Array(10)].map((_, i) => (
          <div key={`v-${i}`} className="absolute h-full w-px bg-white/30" style={{ left: `${i * 10}%` }} />
        ))}
      </div>

      {/* User location */}
      {userLocation && (
        <div 
          className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10"
          style={{ 
            left: "50%", 
            top: "50%",
            transform: "translate(-50%, -50%)"
          }}
        >
          <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-50" />
        </div>
      )}

      {/* Vendor pins */}
      {vendors.map((v, i) => {
        if (!v.location) return null;
        const isHighlighted = highlightedVendor === v.vendorId;
        
        // Simple positioning based on index
        const angle = (i / vendors.length) * Math.PI * 2;
        const radius = 30 + Math.random() * 15;
        const x = 50 + Math.cos(angle) * radius;
        const y = 50 + Math.sin(angle) * radius;

        return (
          <div
            key={v.vendorId}
            className={`absolute transition-all duration-300 ${isHighlighted ? "z-20 scale-125" : "z-10"}`}
            style={{ 
              left: `${Math.min(90, Math.max(10, x))}%`, 
              top: `${Math.min(85, Math.max(15, y))}%`,
              transform: "translate(-50%, -50%)"
            }}
          >
            <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
              isHighlighted 
                ? "bg-white shadow-lg shadow-white/50" 
                : "bg-red-500"
            }`} />
            {isHighlighted && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-xs px-2 py-1 rounded whitespace-nowrap font-medium">
                {v.name}
              </div>
            )}
          </div>
        );
      })}

      {/* Center info */}
      <div className="absolute bottom-2 left-2 text-xs text-neutral-500">
        {vendors.length} vendors nearby
      </div>
    </div>
  );
}