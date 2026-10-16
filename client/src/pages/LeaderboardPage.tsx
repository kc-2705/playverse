import { useSearchParams } from 'react-router-dom';
import { Avatar, Card, Segmented, Table, Tag } from 'antd';
import { CrownFilled } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api, type Leaderboard, type LeaderRow } from '../api/client';
import { AVATARS, GAMES } from '../games/catalog';
import { useAuth } from '../auth/AuthContext';
import { themeName } from '../games/rooftop/themes';

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

  const columns = [
    {
      title: '#',
      dataIndex: 'rank',
      width: 64,
      render: (r: number) => (r <= 3 ? <CrownFilled className={`crown c${r}`} aria-label={`Rank ${r}`} /> : r),
    },
    {
      title: 'Player',
      dataIndex: 'username',
      render: (_: string, row: LeaderRow) => (
        <span className="player-cell">
          <Avatar size="small" className="emoji-avatar">{AVATARS[row.avatar] ?? '🙂'}</Avatar>
          {row.username}
          {row.userId === user?.id && <Tag color="orange">You</Tag>}
        </span>
      ),
    },
    // Each game reports different details about a run.
    ...(game === 'museum-hide-seek'
      ? [{ title: 'Players found', key: 'f', responsive: ['sm' as const], render: (_: unknown, row: LeaderRow) => row.stats?.found ?? 0 }]
      : game === 'wingsuit-canyon'
      ? [
          { title: 'Distance', key: 'd', responsive: ['sm' as const], render: (_: unknown, row: LeaderRow) => `${(row.stats?.distance ?? 0).toLocaleString()} m` },
          { title: 'Rings', key: 'r', responsive: ['md' as const], render: (_: unknown, row: LeaderRow) => row.stats?.rings ?? 0 },
        ]
      : game === 'night-heist'
      ? [
          { title: 'Levels cleared', key: 'l', responsive: ['sm' as const], render: (_: unknown, row: LeaderRow) => `${row.stats?.levels ?? 0} of 3` },
          { title: 'Gems', key: 'g', responsive: ['md' as const], render: (_: unknown, row: LeaderRow) => row.stats?.gems ?? 0 },
        ]
      : [
          { title: 'Distance', key: 'd', responsive: ['sm' as const], render: (_: unknown, row: LeaderRow) => `${(row.stats?.distance ?? 0).toLocaleString()} m` },
          { title: 'Coins', key: 'c', responsive: ['md' as const], render: (_: unknown, row: LeaderRow) => row.stats?.coins ?? 0 },
          { title: 'World', key: 'w', responsive: ['lg' as const], render: (_: unknown, row: LeaderRow) => <span className="muted">{themeName(row.stats?.theme) ?? 'City Sunset'}</span> },
        ]),
    { title: 'Score', dataIndex: 'score', align: 'right' as const, render: (s: number) => <b>{s.toLocaleString()}</b> },
  ];

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
        <Table
          rowKey="userId"
          loading={isLoading}
          dataSource={data?.top ?? []}
          columns={columns}
          pagination={false}
          rowClassName={(row) => (row.userId === user?.id ? 'me-row' : '')}
          locale={{ emptyText: 'No scores yet for this period.' }}
        />
      </Card>
    </div>
  );
}
