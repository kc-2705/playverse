import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Button, Card, Empty, Skeleton, Tag } from 'antd';
import { CaretRightOutlined, ClockCircleOutlined, TrophyOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api, type Leaderboard } from '../api/client';
import { AVATARS, GAMES } from '../games/catalog';

export default function Home() {
  const navigate = useNavigate();
  const featured = GAMES[0];
  const top = useQuery({
    queryKey: ['leaderboard', featured.id, 'week'],
    queryFn: () => api.get<Leaderboard>(`/leaderboard/${featured.id}`, { params: { period: 'week' } }).then((r) => r.data),
  });

  return (
    <div className="home">
      <section className="hero" style={{ background: featured.cover }}>
        <div className="hero-shade" />
        <div className="hero-copy">
          <Tag color="orange">New · Play in your browser</Tag>
          <h1>{featured.title}</h1>
          <p>{featured.description}</p>
          <div className="hero-actions">
            <Button type="primary" size="large" icon={<CaretRightOutlined />} onClick={() => navigate(`/play/${featured.id}`)}>
              Play now
            </Button>
            <Link to={`/leaderboard?game=${featured.id}`}>
              <Button size="large" icon={<TrophyOutlined />}>Leaderboard</Button>
            </Link>
          </div>
        </div>
        <aside className="hero-board" aria-label="This week’s top runners">
          <h3><TrophyOutlined /> This week’s top runners</h3>
          {top.isLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : top.data?.top.length ? (
            <ol>
              {top.data.top.slice(0, 5).map((r) => (
                <li key={r.userId}>
                  <span className={`rank r${r.rank}`}>{r.rank}</span>
                  <Avatar size="small" className="emoji-avatar">{AVATARS[r.avatar] ?? '🙂'}</Avatar>
                  <span className="who">{r.username}</span>
                  <b>{r.score.toLocaleString()}</b>
                </li>
              ))}
            </ol>
          ) : (
            <Empty description="No runs this week yet. Be the first!" />
          )}
        </aside>
      </section>

      <section>
        <div className="section-head">
          <h2>Games</h2>
          <span className="muted">Four playable now, more on the way</span>
        </div>
        <div className="game-grid">
          {[...GAMES].sort((a, b) => Number(b.status === 'play') - Number(a.status === 'play')).map((g) => (
            <Card
              key={g.id}
              hoverable={g.status === 'play'}
              className={`game-card ${g.status}`}
              cover={
                <div className="game-cover" style={{ background: g.cover }}>
                  {g.status === 'soon' && <Tag icon={<ClockCircleOutlined />} className="soon-tag">Coming soon</Tag>}
                </div>
              }
              onClick={() => g.status === 'play' && navigate(`/play/${g.id}`)}
            >
              <h3>{g.title}</h3>
              <p className="muted">{g.tagline}</p>
              <div className="tags">
                {g.modes.map((m) => (
                  <Tag key={m}>{m}</Tag>
                ))}
              </div>
              {g.status === 'play' && (
                <Button type="primary" block icon={<CaretRightOutlined />} style={{ marginTop: 12 }}>
                  Play
                </Button>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
