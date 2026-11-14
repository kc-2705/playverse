import { Avatar, Empty, Skeleton } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import type { LeaderRow } from '../api/client';
import { AVATARS } from '../games/catalog';

/** This week's top five players, shown beside the home page hero. */
export default function TopRunners({ rows, loading }: { rows?: LeaderRow[]; loading?: boolean }) {
  return (
    <aside className="hero-board" aria-label="This week’s top runners">
      <h3><TrophyOutlined /> This week’s top runners</h3>
      {loading ? (
        <Skeleton active title={false} paragraph={{ rows: 5 }} />
      ) : rows?.length ? (
        <ol>
          {rows.slice(0, 5).map((r) => (
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
  );
}
