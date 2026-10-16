import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Progress, Segmented, Space, Statistic, Tag, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  CloseOutlined,
  CaretRightOutlined,
  PauseOutlined,
  ReloadOutlined,
  SoundOutlined,
  MutedOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { RooftopRunner, type RunnerState, type RunnerStats } from '../games/rooftop/RooftopRunner';
import { THEMES, themeById, type ThemeId } from '../games/rooftop/themes';
import { gameById } from '../games/catalog';
import { api, errorMessage, type SubmitResult } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import CharacterPicker from '../components/CharacterPicker';
import { preferredCharacter, type CharacterId } from '../games/shared/hero';


const GAME_ID = 'rooftop-runner';
const info = gameById(GAME_ID)!;

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

export default function PlayRooftop() {
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<RooftopRunner | null>(null);
  const navigate = useNavigate();
  const closeButton = (
    <Button className="panel-close" type="text" shape="circle" icon={<CloseOutlined />} aria-label="Back to games" onClick={() => navigate('/')} />
  );
  const { user, askToSignIn } = useAuth();
  const [state, setState] = useState<RunnerState>('loading');
  const [progress, setProgress] = useState(0);
  const [hud, setHud] = useState<RunnerStats>({ distance: 0, coins: 0, score: 0, durationMs: 0, theme: 0 });
  const [result, setResult] = useState<RunnerStats | null>(null);
  const [quality, setQuality] = useState<'high' | 'low'>(() => readPref('pv.quality', window.matchMedia('(pointer: coarse)').matches ? 'low' : 'high'));
  const [sound, setSound] = useState<boolean>(() => readPref('pv.sound', true));
  const [themeId, setThemeId] = useState<ThemeId>(() => themeById(readPref('pv.theme', 'city')).id);
  const theme = themeById(themeId);
  const [character, setCharacter] = useState<CharacterId>(preferredCharacter);
  const [loadError, setLoadError] = useState<string | null>(null);
  const localBest = useRef<number>(readPref('pv.best.rooftop', 0));

  const submit = useMutation({
    mutationFn: (s: RunnerStats) =>
      api
        .post<SubmitResult>('/scores', { game: GAME_ID, score: s.score, durationMs: s.durationMs, stats: { distance: s.distance, coins: s.coins, theme: s.theme } })
        .then((r) => r.data),
  });

  // Create the 3D game; rebuild it when the graphics setting or the world changes.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setLoadError(null);
    const game = new RooftopRunner(
      stage,
      {
        onState: setState,
        onHud: setHud,
        onProgress: setProgress,
        onGameOver: (s) => setResult(s),
      },
      quality,
      themeId,
    );
    gameRef.current = game;
    game.setSound(readPref('pv.sound', true));
    game.load().catch((e) => setLoadError(`The game couldn’t load: ${e?.message ?? e}`));
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [quality, themeId, character]);

  useEffect(() => {
    gameRef.current?.setSound(sound);
    writePref('pv.sound', sound);
  }, [sound]);

  // Save the run when it ends (signed in) and keep a local best either way.
  useEffect(() => {
    if (!result) return;
    if (result.score > localBest.current) {
      localBest.current = result.score;
      writePref('pv.best.rooftop', result.score);
    }
    if (user && result.durationMs >= 3000) submit.mutate(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const start = useCallback(() => {
    setResult(null);
    submit.reset();
    gameRef.current?.start();
    gameRef.current?.focus();
  }, [submit]);

  // Keyboard and swipe controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
      if (state === 'ready' || state === 'over') {
        if (k === 'enter' || (k === ' ' && state === 'ready')) start();
        return;
      }
      if (k === 'p' || k === 'escape') return state === 'running' ? g.pause() : g.resume();
      if (k === 'arrowleft' || k === 'a') g.move(-1);
      else if (k === 'arrowright' || k === 'd') g.move(1);
      else if (k === 'arrowup' || k === 'w' || k === ' ') g.jump();
      else if (k === 'arrowdown' || k === 's') g.duck();
    };
    let start0: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, .ant-segmented')) return;
      start0 = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      const g = gameRef.current;
      if (!start0 || !g) return;
      const dx = e.clientX - start0.x;
      const dy = e.clientY - start0.y;
      start0 = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) g.move(dx > 0 ? 1 : -1);
      else if (dy < 0) g.jump();
      else g.duck();
    };
    const hidden = () => document.hidden && gameRef.current?.pause();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
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
        {state === 'running' || state === 'paused' ? (
          <div className="hud">
            <Statistic title="Distance" value={hud.distance} suffix="m" />
            <Statistic title="Coins" value={hud.coins} className="hud-coins" />
            <Statistic title="Score" value={hud.score} />
          </div>
        ) : (
          <span />
        )}
        <Space>
          <Tooltip title={sound ? 'Mute' : 'Sound on'}>
            <Button shape="circle" icon={sound ? <SoundOutlined /> : <MutedOutlined />} onClick={() => setSound((s) => !s)} aria-label="Sound" />
          </Tooltip>
          {state === 'running' && (
            <Tooltip title="Pause (P)">
              <Button shape="circle" icon={<PauseOutlined />} onClick={() => gameRef.current?.pause()} aria-label="Pause" />
            </Tooltip>
          )}
        </Space>
      </div>

      {state === 'loading' && !loadError && (
        <div className="overlay">
          <div className="panel narrow">
            <h2>{theme.loading}</h2>
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
        <div className="overlay">
          <div className="panel">
            {closeButton}
            <Tag color="orange">Single player</Tag>
            <h1 className="game-title">{info.title}</h1>
            <p className="lead">{info.description}</p>
            <div className="theme-picker" role="radiogroup" aria-label="Choose a world">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={t.id === themeId}
                  className={`theme-tile ${t.id === themeId ? 'on' : ''}`}
                  style={{ background: `url(${t.thumb}) center / cover, ${t.swatch}` }}
                  onClick={() => {
                    if (t.id === themeId) return;
                    setThemeId(t.id);
                    writePref('pv.theme', t.id);
                  }}
                  title={t.blurb}
                >
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
            <div className="controls-grid">
              {info.controls!.map((c) => (
                <div key={c.action} className="control-card">
                  <b>{c.action}</b>
                  <span>{c.keys}</span>
                  <span className="muted">{c.touch}</span>
                </div>
              ))}
            </div>
            <p className="theme-blurb muted">{theme.blurb}</p>
            <CharacterPicker value={character} onChange={setCharacter} />
            <Button type="primary" size="large" icon={<CaretRightOutlined />} onClick={start} className="big-btn">
              Start running
            </Button>
            <div className="panel-meta">
              <span>Your best: <b>{localBest.current}</b></span>
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
            {closeButton}
            <p className="eyebrow">{result.reason}</p>
            <h2>Run over</h2>
            <div className="result-grid">
              <Statistic title="Distance" value={result.distance} suffix="m" />
              <Statistic title="Coins" value={result.coins} />
              <Statistic title="Score" value={result.score} />
            </div>
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
              <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={start} autoFocus>Run again</Button>
              <Button size="large" onClick={() => setState('ready')}>Change world</Button>
              <Link to={`/leaderboard?game=${GAME_ID}`}><Button size="large" icon={<TrophyOutlined />}>Leaderboard</Button></Link>
            </Space>
          </div>
        </div>
      )}
    </div>
  );
}
