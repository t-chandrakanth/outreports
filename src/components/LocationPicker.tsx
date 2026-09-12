import { LOCATIONS, type Location } from '../config';

interface Props {
  onPick: (loc: Location) => void;
}

export function LocationPicker({ onPick }: Props) {
  return (
    <>
      <h2 className="screen-title">Select location</h2>
      <div className="station-grid">
        {LOCATIONS.map((loc) => (
          <button key={loc.code} className="station-tile" onClick={() => onPick(loc)}>
            {loc.code}
          </button>
        ))}
      </div>
    </>
  );
}
