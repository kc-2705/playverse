import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Progress, Segmented, Space, Statistic, Tag, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  CaretRightOutlined,
  PauseOutlined,
  ReloadOutlined,
  SoundOutlined,
  MutedOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { WingsuitGame, type WingState, type WingStats } from '../games/wingsuit/WingsuitGame';
import { gameById } from '../games/catalog';
import { api, errorMessage, type SubmitResult } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const GAME_ID = 'wingsuit-canyon';
const info = gameById(GAME_ID)!;
const touchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

function readPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function writePref(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* not critical */
  }
}

const CONTROLS = [
  { action: 'Steer', keys: '← → or A D', touch: 'Drag left / right' },
  { action: 'Dive (faster)', keys: '↑ or W', touch: 'Drag up' },
  { action: 'Pull up (climb)', keys: '↓ or S', touch: 'Drag down' },
];

export default function PlayWingsuit() {
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<WingsuitGame | null>(null);
  const navigate = useNavigate();
  const { user, askToSignIn } = useAuth();
  const [state, setState] = useState<WingState>('loading');
  const [progress, setProgress] = useState(0);
  const [hud, setHud] = useState<WingStats | null>(null);
  const [result, setResult] = useState<WingStats | null>(null);
  const [events, setEvents] = useState<{ id: number; text: string }[]>([]);
  const [quality, setQuality] = useState<'high' | 'low'>(() => readPref('pv.quality', touchDevice ? 'low' : 'high'));
  const [sound, setSound] = useState<boolean>(() => readPref('pv.sound', true));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ghostBest, setGhostBest] = useState(0);
  const eventId = useRef(0);

  const submit = useMutation({
    mutationFn: (s: WingStats) =>
      api
        .post<SubmitResult>('/scores', { game: GAME_ID, score: s.score, durationMs: s.durationMs, stats: { distance: s.distance, rings: s.rings, closeCalls: s.closeCalls } })
        .then((r) => r.data),
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setLoadError(null);
    const game = new WingsuitGame(
      stage,
      {
        onState: setState,
        onHud: setHud,
        onProgress: setProgress,
        onGameOver: setResult,
        onEvent: (text) => {
          const id = ++eventId.current;
          setEvents((e) => [...e.slice(-2), { id, text }]);
          window.setTimeout(() => setEvents((e) => e.filter((x) => x.id !== id)), 1400);
        },
      },
      quality,
    );
    gameRef.current = game;
    game.setSound(readPref('pv.sound', true));
    game
      .load()
      .then(() => setGhostBest(game.bestGhostScore))
      .catch((e) => setLoadError(`The game couldn’t load: ${e?.message ?? e}`));
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [quality]);

  useEffect(() => {
    gameRef.current?.setSound(sound);
    writePref('pv.sound', sound);
  }, [sound]);

  useEffect(() => {
    if (!result) return;
    setGhostBest(gameRef.current?.bestGhostScore ?? 0);
    if (user && result.durationMs >= 3000 && result.score > 0) submit.mutate(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const start = useCallback(() => {
    setResult(null);
    setEvents([]);
    submit.reset();
    gameRef.current?.start();
    gameRef.current?.focus();
  }, [submit]);

  // Keyboard and drag controls.
  useEffect(() => {
    const held = new Set<string>();
    const sync = () => {
      const steer = (held.has('arrowright') || held.has('d') ? 1 : 0) - (held.has('arrowleft') || held.has('a') ? 1 : 0);
      const pitch = (held.has('arrowup') || held.has('w') ? 1 : 0) - (held.has('arrowdown') || held.has('s') ? 1 : 0);
      gameRef.current?.setInput(steer, pitch);
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
      const g = gameRef.current;
      if (!g) return;
      if (state === 'ready' || state === 'over') {
        if (k === 'enter' || k === ' ') start();
        return;
      }
      if (k === 'p' || k === 'escape') return state === 'flying' ? g.pause() : g.resume();
      held.add(k);
      sync();
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.key.toLowerCase());
      sync();
    };
    let origin: { x: number; y: number } | null = null;
    const pdown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, .ant-segmented, .panel')) return;
      origin = { x: e.clientX, y: e.clientY };
    };
    const pmove = (e: PointerEvent) => {
      if (!origin) return;
      gameRef.current?.setInput((e.clientX - origin.x) / 70, -(e.clientY - origin.y) / 70);
    };
    const pup = () => {
      origin = null;
      gameRef.current?.setInput(0, 0);
    };
    const hidden = () => document.hidden && gameRef.current?.pause();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('pointerdown', pdown);
    window.addEventListener('pointermove', pmove);
    window.addEventListener('pointerup', pup);
    window.addEventListener('pointercancel', pup);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('pointerdown', pdown);
      window.removeEventListener('pointermove', pmove);
      window.removeEventListener('pointerup', pup);
      window.removeEventListener('pointercancel', pup);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [state, start]);

  const r = submit.data;

  return (
    <div className="play-page">
      <div ref={stageRef} className="game-stage" />

      <div className="game-topbar">
        <Tooltip title="Back to games">
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} aria-label="Back to games" />
        </Tooltip>
        {(state === 'flying' || state === 'paused') && hud ? (
          <div className="hud">
            <Statistic title="Speed" value={hud.speed} suffix="km/h" />
            <Statistic title="Height" value={hud.height} suffix="m" />
            <Statistic title="Distance" value={hud.distance} suffix="m" />
            <Statistic title="Score" value={hud.score} className="hud-coins" />
          </div>
        ) : (
          <span />
        )}
        <Space>
          <Tooltip title={sound ? 'Mute' : 'Sound on'}>
            <Button shape="circle" icon={sound ? <SoundOutlined /> : <MutedOutlined />} onClick={() => setSound((s) => !s)} aria-label="Sound" />
          </Tooltip>
          {state === 'flying' && (
            <Tooltip title="Pause (P)">
              <Button shape="circle" icon={<PauseOutlined />} onClick={() => gameRef.current?.pause()} aria-label="Pause" />
            </Tooltip>
          )}
        </Space>
      </div>

      {state === 'flying' && (
        <div className="wing-events" aria-live="polite">
          {events.map((e) => (
            <div key={e.id} className="wing-event">{e.text}</div>
          ))}
        </div>
      )}

      {state === 'loading' && !loadError && (
        <div className="overlay">
          <div className="panel narrow">
            <h2>Climbing to the jump point…</h2>
            <Progress percent={Math.round(progress * 100)} strokeColor={{ from: '#ffb347', to: '#ff5e62' }} />
          </div>
        </div>
      )}

      {loadError && (
        <div className="overlay">
          <div className="panel narrow">
            <Alert type="error" showIcon title={loadError} description="Your browser needs WebGL. Try Chrome or Edge, or switch Graphics to Low." />
          </div>
        </div>
      )}

      {state === 'ready' && (
        <div className="overlay overlay-low">
          <div className="panel briefing">
            <Tag color="orange">Single player · Ghost race</Tag>
            <h1 className="game-title small">{info.title}</h1>
            <p className="lead">
              Glide down a red-rock canyon. Dive for speed, pull up to climb. Fly through rings, skim close to the rock and thread the stone arches for bonus points.
            </p>
            {ghostBest > 0 && <p className="lead small">The blue ghost flies your best run ({ghostBest.toLocaleString()} points). Beat it!</p>}
            <div className="controls-grid">
              {CONTROLS.map((c) => (
                <div key={c.action} className="control-card">
                  <b>{c.action}</b>
                  <span>{touchDevice ? c.touch : c.keys}</span>
                </div>
              ))}
            </div>
            <Button type="primary" size="large" icon={<CaretRightOutlined />} onClick={start} className="big-btn">
              Jump
            </Button>
            <div className="panel-meta">
              <span className="graphics">
                Graphics
                <Segmented size="small" value={quality} onChange={(v) => { setQuality(v as 'high' | 'low'); writePref('pv.quality', v); }} options={[{ label: 'High', value: 'high' }, { label: 'Low', value: 'low' }]} />
              </span>
            </div>
          </div>
        </div>
      )}

      {state === 'paused' && (
        <div className="overlay">
          <div className="panel narrow">
            <h2>Paused</h2>
            <Space wrap>
              <Button type="primary" size="large" icon={<CaretRightOutlined />} onClick={() => gameRef.current?.resume()}>Resume</Button>
              <Button size="large" onClick={() => navigate('/')}>Quit</Button>
            </Space>
          </div>
        </div>
      )}

      {state === 'over' && result && (
        <div className="overlay">
          <div className="panel">
            <p className="eyebrow">{result.reason}</p>
            <h2>{result.newBest ? 'New best flight!' : 'Flight over'}</h2>
            <div className="result-grid">
              <Statistic title="Distance" value={result.distance} suffix="m" />
              <Statistic title="Score" value={result.score} />
              <Statistic title="Rings" value={result.rings} />
            </div>
            <p className="muted">
              {result.closeCalls} close calls · {result.arches} arches threaded
              {result.newBest ? ' · Saved as your ghost' : ''}
            </p>
            {user ? (
              submit.isPending ? (
                <Alert type="info" title="Saving your score…" showIcon />
              ) : submit.isError ? (
                <Alert type="warning" showIcon title={errorMessage(submit.error)} />
              ) : r ? (
                <Alert
                  type={r.personalBest ? 'success' : 'info'}
                  showIcon
                  icon={<TrophyOutlined />}
                  title={r.personalBest ? 'New personal best!' : `Your best is still ${r.previousBest}`}
                  description={r.rank ? `You’re #${r.rank} on the all-time leaderboard.` : undefined}
                />
              ) : null
            ) : (
              <Alert
                type="info"
                showIcon
                title="Log in to save this score and join the leaderboard."
                action={<Button size="small" onClick={() => askToSignIn('Log in to save your scores')}>Log in</Button>}
              />
            )}
            <Space wrap style={{ marginTop: 18 }}>
              <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={start} autoFocus>Fly again</Button>
              <Link to={`/leaderboard?game=${GAME_ID}`}><Button size="large" icon={<TrophyOutlined />}>Leaderboard</Button></Link>
            </Space>
          </div>
        </div>
      )}
    </div>
  );
}
