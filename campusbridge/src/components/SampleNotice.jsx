import { Info } from 'lucide-react';
import { SHOW_SAMPLE_DATA_NOTICE } from '../config';

// Honest labelling: the listings that ship with the project are demonstration data.
export default function SampleNotice({ what = 'listings' }) {
  if (!SHOW_SAMPLE_DATA_NOTICE) return null;
  return (
    <p className="sample-notice">
      <Info size={15} aria-hidden="true" />
      <span>The {what} shown here are sample data for demonstration. They are not real offers.</span>
    </p>
  );
}
