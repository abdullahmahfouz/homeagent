/* Icon set: Phosphor, imported per-glyph so only what is used is bundled.
 *
 * One weight rule, applied everywhere:
 *   bold  for line icons. Everything here draws at 11-16px, where Phosphor's
 *         regular weight goes grey and loses its counters.
 *   fill  for the two glyphs that read as marks rather than controls: the
 *         brand house and the score star.
 *
 * Size comes from CSS (`.brand-mark svg { width: 16px }` and friends), so
 * callers stay `<Icons.Foo/>` with no props and nothing can drift.
 */
import { HouseIcon } from '@phosphor-icons/react/dist/csr/House';
import { PlusIcon } from '@phosphor-icons/react/dist/csr/Plus';
import { ArrowUpIcon } from '@phosphor-icons/react/dist/csr/ArrowUp';
import { CheckIcon } from '@phosphor-icons/react/dist/csr/Check';
import { BuildingsIcon } from '@phosphor-icons/react/dist/csr/Buildings';
import { TrendUpIcon } from '@phosphor-icons/react/dist/csr/TrendUp';
import { MapTrifoldIcon } from '@phosphor-icons/react/dist/csr/MapTrifold';
import { XIcon } from '@phosphor-icons/react/dist/csr/X';
import { ChatTeardropIcon } from '@phosphor-icons/react/dist/csr/ChatTeardrop';
import { ListIcon } from '@phosphor-icons/react/dist/csr/List';
import { StarIcon } from '@phosphor-icons/react/dist/csr/Star';

const line = { weight: 'bold', size: '100%' };
const mark = { weight: 'fill', size: '100%' };

export const Icons = {
  Logo:     () => <HouseIcon {...mark} />,
  Star:     () => <StarIcon {...mark} />,

  Plus:     () => <PlusIcon {...line} />,
  ArrowUp:  () => <ArrowUpIcon {...line} />,
  Check:    () => <CheckIcon {...line} />,
  Home:     () => <HouseIcon {...line} />,
  Building: () => <BuildingsIcon {...line} />,
  Trend:    () => <TrendUpIcon {...line} />,
  Map:      () => <MapTrifoldIcon {...line} />,
  X:        () => <XIcon {...line} />,
  Chat:     () => <ChatTeardropIcon {...line} />,
  Menu:     () => <ListIcon {...line} />,
};
