import { useSearchParams } from 'react-router-dom';
import { Card, Segmented } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { api, type Leaderboard } from '../api/client';
import { GAMES } from '../games/catalog';
import { useAuth } from '../auth/AuthContext';
import LeaderboardTable from '../components/LeaderboardTable';

const PLAYABLE = GAMES.filter((g) => g.status === 'play');

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const game = params.get('game') ?? PLAYABLE[0].id;
  const period = (params.get('period') as Leaderboard['period']) ?? 'all';
  const set = (k: string, v: string) => setParams((p) => { p.set(k, v); return p; });

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', game, period, user?.id],
    queryFn: () => api.get<Leaderboard>(`/leaderboard/${game}`, { params: { period } }).then((r) => r.data),
  });

  return (
    <div className="page">
      <div className="section-head">
        <h1>Leaderboards</h1>
        <span className="muted">{data ? `${data.players} players` : ''}</span>
      </div>
      <div className="filters">
        <Segmented value={game} onChange={(v) => set('game', String(v))} options={PLAYABLE.map((g) => ({ label: g.title, value: g.id }))} />
        <Segmented
          value={period}
          onChange={(v) => set('period', String(v))}
          options={[
            { label: 'All time', value: 'all' },
            { label: 'This week', value: 'week' },
            { label: 'Today', value: 'today' },
          ]}
        />
      </div>
      {data?.me && data.me.rank > 20 && (
        <Card size="small" className="my-rank">
          You’re <b>#{data.me.rank}</b> with <b>{data.me.score.toLocaleString()}</b>. Keep running!
        </Card>
      )}
      <Card styles={{ body: { padding: 0 } }}>
        <LeaderboardTable game={game} rows={data?.top ?? []} loading={isLoading} currentUserId={user?.id} />
      </Card>
    </div>
  );
}
