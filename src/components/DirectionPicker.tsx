import type { Location } from '../config';

interface Props {
  location: Location;
  onPick: (sheet: string) => void;
}

export function DirectionPicker({ location, onPick }: Props) {
  return (
    <>
      <h2 className="screen-title">{location.code} — select direction</h2>
      <div className="direction-list">
        {location.directions.map((sheet) => (
          <button key={sheet} className="direction-row" onClick={() => onPick(sheet)}>
            {sheet}
          </button>
        ))}
      </div>
    </>
  );
}
