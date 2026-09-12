import type { EditTarget } from '../components/EntryForm';
import type { Location } from '../config';

/**
 * Route params live in memory only (never serialized into history state),
 * so they may carry callbacks — history entries store just stack indices.
 */
export type Route =
  | { name: 'home' }
  | { name: 'direction'; location: Location }
  | { name: 'sheet'; sheet: string }
  | { name: 'edit'; sheet: string; target: EditTarget; onDone: (r: { refresh: boolean }) => void };

export interface StackEntry {
  key: string;
  route: Route;
}
