import { Button, Card, Tag } from 'antd';
import { CaretRightOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { GameInfo } from '../games/catalog';

/** A game tile on the home page. Playable games open on click; others show "Coming soon". */
export default function GameCard({ game, onPlay }: { game: GameInfo; onPlay: (id: string) => void }) {
  const playable = game.status === 'play';
  return (
    <Card
      hoverable={playable}
      className={`game-card ${game.status}`}
      cover={
        <div className="game-cover" style={{ background: game.cover }}>
          {!playable && <Tag icon={<ClockCircleOutlined />} className="soon-tag">Coming soon</Tag>}
        </div>
      }
      onClick={() => playable && onPlay(game.id)}
    >
      <h3>{game.title}</h3>
      <p className="muted">{game.tagline}</p>
      <div className="tags">
        {game.modes.map((m) => (
          <Tag key={m}>{m}</Tag>
        ))}
      </div>
      {playable && (
        <Button type="primary" block icon={<CaretRightOutlined />} style={{ marginTop: 12 }}>
          Play
        </Button>
      )}
    </Card>
  );
}
