import React from 'react';
import { ApartmentSpec } from '../architecture/buildingData';

interface MinimapProps {
  apartment: ApartmentSpec;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  apartment,
  playerX,
  playerZ,
  playerYaw,
  activeRoomId,
  onSelectRoom,
}) => {
  const pad = 0.8;
  const minX =
    Math.min(
      apartment.bounds.xMin,
      ...apartment.balconies.map((b) => b.bounds.xMin),
    ) - pad;
  const maxX =
    Math.max(
      apartment.bounds.xMax,
      ...apartment.balconies.map((b) => b.bounds.xMax),
    ) + pad;
  const minZ =
    Math.min(
      apartment.bounds.zMin,
      ...apartment.balconies.map((b) => b.bounds.zMin),
    ) - pad;
  const maxZ =
    Math.max(
      apartment.bounds.zMax,
      ...apartment.balconies.map((b) => b.bounds.zMax),
    ) + pad;

  const vw = maxX - minX;
  const vh = maxZ - minZ;

  // Convert player yaw (Three.js rotation.y where -Z is forward at yaw=0) into 2D SVG degrees
  const deg = (-playerYaw * 180) / Math.PI;

  return (
    <div
      className="bg-[#F7F4EE]/95 border border-[#D8D0C3] rounded-xl p-2.5 shadow-lg w-44 sm:w-52 select-none"
      aria-label="Apartment floorplan minimap"
    >
      <div className="flex items-center justify-between text-[11px] text-[#5C5347] mb-1.5 px-0.5">
        <span className="font-medium truncate">{apartment.unitNumber} Plan</span>
        <span className="font-mono-tabular text-[10px]">
          {apartment.metrics.usableIndoorSqm} m²
        </span>
      </div>

      <svg
        viewBox={`${minX} ${minZ} ${vw} ${vh}`}
        className="w-full h-32 sm:h-36 bg-[#EDE7DC] rounded-lg border border-[#DCD4C6]"
      >
        {apartment.balconies.map((b) => (
          <rect
            key={b.id}
            x={b.bounds.xMin}
            y={b.bounds.zMin}
            width={b.bounds.xMax - b.bounds.xMin}
            height={b.bounds.zMax - b.bounds.zMin}
            fill="#DFD8CA"
            stroke="#9D9281"
            strokeWidth={0.09}
            strokeDasharray="0.22 0.14"
            className="cursor-pointer"
            onClick={() => {
              const balPreset = apartment.cameraPresets.find(
                (p) => p.roomId === b.id,
              );
              if (balPreset) {
                onSelectRoom(balPreset.id);
              } else if (b.id === 'utility-balcony') {
                const kitchenPreset = apartment.cameraPresets.find(
                  (p) => p.roomId === 'kitchen',
                );
                onSelectRoom(kitchenPreset ? kitchenPreset.id : b.id);
              } else {
                onSelectRoom(b.id);
              }
            }}
          />
        ))}

        {apartment.rooms.map((r) => {
          const active = r.id === activeRoomId;
          const shortLabel = (() => {
            if (r.id === 'foyer') return 'Foyer';
            if (r.id === 'living') return 'Living';
            if (r.id === 'dining') return 'Dining';
            if (r.id === 'kitchen') return 'Kitchen';
            if (r.id === 'puja') return 'Puja';
            if (r.id === 'family-lounge') return 'Lounge';
            if (r.id === 'gallery') return 'Gallery';
            if (r.id === 'primary-bed') return 'Master';
            if (r.id === 'secondary-bed') return 'Bed 2';
            if (r.id === 'third-bed') return 'Bed 3';
            if (r.id === 'primary-bath') return 'Bath 1';
            if (r.id === 'common-bath') return 'Bath';
            if (r.id === 'attached-bath-2') return 'Bath 2';
            return 'Hall';
          })();
          return (
            <g
              key={r.id}
              className="cursor-pointer"
              onClick={() => {
                const preset = apartment.cameraPresets.find(
                  (p) => p.roomId === r.id,
                );
                onSelectRoom(preset ? preset.id : r.id);
              }}
            >
              <rect
                x={r.bounds.xMin}
                y={r.bounds.zMin}
                width={r.bounds.xMax - r.bounds.xMin}
                height={r.bounds.zMax - r.bounds.zMin}
                fill={active ? '#DCD6C6' : '#F6F2EA'}
                stroke="#463E35"
                strokeWidth={0.11}
              />
              <text
                x={(r.bounds.xMin + r.bounds.xMax) * 0.5}
                y={(r.bounds.zMin + r.bounds.zMax) * 0.5 + 0.14}
                textAnchor="middle"
                fontSize={0.4}
                fill="#4E463C"
                style={{ pointerEvents: 'none' }}
              >
                {shortLabel}
              </text>
            </g>
          );
        })}

        {/* Buyer Position & Facing Direction Cone */}
        <g transform={`translate(${playerX}, ${playerZ}) rotate(${deg})`}>
          <path
            d="M 0 0 L -0.75 -1.45 L 0.75 -1.45 Z"
            fill="rgba(110, 117, 91, 0.28)"
          />
          <circle r={0.34} fill="#6E755B" stroke="#FFFFFF" strokeWidth={0.12} />
        </g>
      </svg>
    </div>
  );
};
