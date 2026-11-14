import { Avatar, Table, Tag } from 'antd';
import { CrownFilled } from '@ant-design/icons';
import type { LeaderRow } from '../api/client';
import { AVATARS } from '../games/catalog';
import { themeName } from '../games/rooftop/themes';

interface Props {
  game: string;
  rows: LeaderRow[];
  loading?: boolean;
  /** Highlights this player's row with a "You" tag. */
  currentUserId?: string;
}

/** Ranked scores for one game. Each game adds its own detail columns. */
export default function LeaderboardTable({ game, rows, loading, currentUserId }: Props) {
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
          {row.userId === currentUserId && <Tag color="orange">You</Tag>}
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
    <Table
      rowKey="userId"
      loading={loading}
      dataSource={rows}
      columns={columns}
      pagination={false}
      rowClassName={(row) => (row.userId === currentUserId ? 'me-row' : '')}
      locale={{ emptyText: <span className="muted">No scores yet for this period.</span> }}
    />
  );
}
