import { Link } from 'react-router-dom';
import { MapPin, Clock, Banknote, ArrowUpRight } from 'lucide-react';
import { deadlineInfo, tone } from '../utils/format';
import { statusClass } from './ApplicationCard';

// Lets the card's soft spotlight follow the cursor (CSS variables only, no re-render).
function trackPointer(e) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

export default function OpportunityCard({ opportunity, showMatch = false, onToggleSave, saving = false }) {
  const d = deadlineInfo(opportunity);
  const skills = (opportunity.skills || []).slice(0, 3);
  return (
    <div className="opp-slot">
    <Link to={`/opportunities/${opportunity.id}`} className={`opp opp--${tone(opportunity.type)} ${opportunity.isClosed ? 'is-closed' : ''}`} onPointerMove={trackPointer}>
      <div className="opp__top">
        <span className="opp__type">{opportunity.type}</span>
        <span className={`opp__deadline opp__deadline--${d.tone}`}>{d.label}</span>
      </div>
      {(opportunity.workMode || opportunity.applicationStatus) && (
        <div className="opp__flags">
          {opportunity.workMode && <span className="badge badge-stone">{opportunity.workMode}</span>}
          {opportunity.applicationStatus && <span className={`badge ${statusClass[opportunity.applicationStatus] || 'badge-teal'}`}>{opportunity.applicationStatus}</span>}
          {opportunity.isClosed && <span className="badge badge-stone">Closed</span>}
        </div>
      )}

      <p className="opp__category">{opportunity.category}</p>
      <h3 className="opp__title"><span>{opportunity.title}</span></h3>
      <p className="opp__company">{opportunity.company}</p>
      <p className="opp__desc">{opportunity.description}</p>

      {showMatch && opportunity.match && (
        <div className="opp__match">
          <p className="opp__match-title"><span>{opportunity.match.score}% match</span> Why it fits you</p>
          <ul>{opportunity.match.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}

      {skills.length > 0 && <p className="opp__skills">Skills: {skills.join(', ')}</p>}
      {(opportunity.eligibleYears?.length > 0 || opportunity.eligibleFields?.length > 0) && (
        <p className="opp__skills">Open to {[...(opportunity.eligibleYears || []), ...(opportunity.eligibleFields || [])].slice(0, 3).join(', ')}</p>
      )}

      <ul className="opp__meta">
        {opportunity.location && <li><MapPin size={14} aria-hidden="true" />{opportunity.location}</li>}
        {opportunity.duration && <li><Clock size={14} aria-hidden="true" />{opportunity.duration}</li>}
        {opportunity.stipend && <li><Banknote size={14} aria-hidden="true" />{opportunity.stipend}</li>}
      </ul>

      <span className="opp__go">
        {opportunity.isClosed ? 'View details' : 'View and apply'}
        <span className="opp__arrow"><ArrowUpRight size={16} aria-hidden="true" /></span>
      </span>
    </Link>
    {onToggleSave && (
      <button type="button" className="opp-save btn btn-secondary btn-sm" disabled={saving} onClick={() => onToggleSave(opportunity)} aria-pressed={opportunity.saved}>
        {opportunity.saved ? 'Unsave' : 'Save'}
      </button>
    )}
    </div>
  );
}
