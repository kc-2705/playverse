import { Navigate, useNavigate } from 'react-router-dom';
import { App, Avatar, Button, Card, Empty, Statistic, Table } from 'antd';
import { CaretRightOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage, type MyStats } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AVATARS, GAMES, gameById } from '../games/catalog';
import { themeName } from '../games/rooftop/themes';

const minutes = (ms: number) => Math.round(ms / 60000);

export default function Profile() {
  const { user, status, setUser } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const stats = useQuery({
    queryKey: ['me', 'stats', user?.id],
    queryFn: () => api.get<MyStats>('/me/stats').then((r) => r.data),
    enabled: Boolean(user),
  });

  if (status === 'signedOut') return <Navigate to="/" replace />;
  if (!user) return null;

  async function chooseAvatar(avatar: string) {
    try {
      const { data } = await api.put('/auth/me', { avatar });
      setUser(data.user);
    } catch (e) {
      message.error(errorMessage(e));
    }
  }

  const bestOf = (id: string) => stats.data?.games.find((g) => g.game === id)?.best ?? 0;
  const details = (game: string, s?: Record<string, number>) =>
    game === 'night-heist'
      ? `${s?.levels ?? 0} of 3 levels · ${s?.gems ?? 0} gems`
      : game === 'wingsuit-canyon'
      ? `${s?.distance ?? 0} m · ${s?.rings ?? 0} rings`
      : game === 'museum-hide-seek'
      ? `${s?.rounds ?? 0} rounds · found ${s?.found ?? 0}`
      : `${s?.distance ?? 0} m · ${themeName(s?.theme) ?? 'City Sunset'}`;

  return (
    <div className="page">
      <div className="profile-head">
        <Avatar size={72} className="emoji-avatar big">{AVATARS[user.avatar] ?? '🙂'}</Avatar>
        <div>
          <h1>{user.username}</h1>
          <span className="muted">Playing since {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      <div className="stat-row">
        <Card><Statistic title="Games played" value={stats.data?.totals.plays ?? 0} loading={stats.isLoading} /></Card>
        <Card><Statistic title="Minutes played" value={minutes(stats.data?.totals.timeMs ?? 0)} loading={stats.isLoading} /></Card>
        {GAMES.filter((g) => g.status === 'play').map((g) => (
          <Card key={g.id}><Statistic title={`${g.title} best`} value={bestOf(g.id)} loading={stats.isLoading} /></Card>
        ))}
      </div>

      <Card title="Choose your avatar" style={{ marginTop: 16 }}>
        <div className="avatar-grid" role="radiogroup" aria-label="Avatar">
          {Object.entries(AVATARS).map(([key, emoji]) => (
            <button
              key={key}
              role="radio"
              aria-checked={user.avatar === key}
              aria-label={key}
              className={`avatar-choice ${user.avatar === key ? 'on' : ''}`}
              onClick={() => chooseAvatar(key)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Recent games" style={{ marginTop: 16 }} styles={{ body: { padding: 0 } }}>
        <Table
          rowKey={(r) => r.at}
          loading={stats.isLoading}
          dataSource={stats.data?.recent ?? []}
          pagination={false}
          locale={{
            emptyText: (
              <Empty description="No games yet.">
                <Button type="primary" icon={<CaretRightOutlined />} onClick={() => navigate('/')}>Pick a game</Button>
              </Empty>
            ),
          }}
          columns={[
            { title: 'Game', dataIndex: 'game', render: (g: string) => gameById(g)?.title ?? g },
            { title: 'When', dataIndex: 'at', responsive: ['sm'], render: (d: string) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) },
            { title: 'Details', key: 'd', responsive: ['md'], render: (_: unknown, r) => <span className="muted">{details(r.game, r.stats)}</span> },
            { title: 'Score', dataIndex: 'score', align: 'right', render: (s: number) => <b>{s.toLocaleString()}</b> },
          ]}
        />
      </Card>
    </div>
  );
}
