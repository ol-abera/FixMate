import { Link } from 'react-router-dom';
import { Briefcase, Plus, Pencil, Building2 } from 'lucide-react';
import { getCoordinatorOpportunities, getOrganizationProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useLoad from '../hooks/useLoad';
import { formatDate } from '../utils/format';
import PageShell from '../components/PageShell';
import AsyncView from '../components/AsyncView';
import EmptyState from '../components/EmptyState';

// Home page for internship coordinators and organisations: what you posted and who applied.
export default function CoordinatorDashboard() {
  const { user } = useAuth();
  const isOrg = user.role === 'organization';
  const state = useLoad(() => getCoordinatorOpportunities().then((r) => r.data));
  const profile = useLoad(() => (isOrg ? getOrganizationProfile().then((r) => r.data) : Promise.resolve(null)), [isOrg]);
  const postButton = <Link to="/coordinator/new" className="btn btn-primary btn-sm"><Plus size={16} /> Post an opportunity</Link>;
  const org = profile.data;
  return (
    <PageShell
      title={isOrg && org?.name ? org.name : `Welcome, ${user.fullName.split(' ')[0]}`}
      subtitle="Opportunities you posted and the students who applied."
      action={postButton}
    >
      {isOrg && (
        <div className="orgbar">
          <Building2 size={20} aria-hidden="true" />
          <div>
            <strong>{org?.name || 'Your organisation'}</strong>
            <span>{org?.isVerified ? 'Verified organisation' : 'Not verified yet. Students will see your listings, but without the verified mark.'}</span>
          </div>
          <Link to="/organization/profile" className="btn btn-secondary btn-sm">Edit profile</Link>
        </div>
      )}
      <AsyncView state={state} loadingText="Loading your opportunities...">
        {(list) => list.length === 0 ? (
          <EmptyState icon={Briefcase} title="You have not posted anything yet" description="Post an internship, scholarship, fellowship, competition or research opportunity for students to find." action={postButton} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map((o) => (
              <div key={o.id} className="card orow">
                <Link to={`/coordinator/opportunities/${o.id}`} className="orow__main">
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span className="badge badge-teal">{o.type}</span>
                    {o.isClosed && <span className="badge badge-stone">Closed</span>}
                  </div>
                  <div style={{ fontWeight: 600 }}>{o.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{o.company} · {o.deadline ? `deadline ${formatDate(o.deadline)}` : 'no fixed deadline'}</div>
                </Link>
                <div className="orow__side">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}><strong>{o.applicants}</strong> applicants</span>
                  {o.awaitingReview > 0 && <span className="badge badge-warning">{o.awaitingReview} new</span>}
                  <Link to={`/coordinator/opportunities/${o.id}/edit`} className="btn btn-secondary btn-sm"><Pencil size={14} aria-hidden="true" /> Edit</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </AsyncView>
    </PageShell>
  );
}
