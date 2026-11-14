import { Link, useNavigate } from 'react-router-dom';
import { Button, Tag } from 'antd';
import { CaretRightOutlined, TrophyOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api, type Leaderboard } from '../api/client';
import { GAMES } from '../games/catalog';
import GameCard from '../components/GameCard';
import TopRunners from '../components/TopRunners';

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
        <TopRunners rows={top.data?.top} loading={top.isLoading} />
      </section>

      <section>
        <div className="section-head">
          <h2>Games</h2>
          <span className="muted">Four playable now, more on the way</span>
        </div>
        <div className="game-grid">
          {[...GAMES].sort((a, b) => Number(b.status === 'play') - Number(a.status === 'play')).map((g) => (
            <GameCard key={g.id} game={g} onPlay={(id) => navigate(`/play/${id}`)} />
          ))}
        </div>
      </section>
    </div>
  );
}
