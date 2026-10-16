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
import { HeistGame, type HeistHud, type HeistResult, type HeistState, type LevelResult } from '../games/heist/HeistGame';
import { LEVELS } from '../games/heist/levels';
import { api, errorMessage, type SubmitResult } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import CharacterPicker from '../components/CharacterPicker';
import { preferredCharacter, type CharacterId } from '../games/shared/hero';


const GAME_ID = 'night-heist';
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
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const CONTROLS = [
  { action: 'Sneak', keys: 'WASD or arrows', touch: 'Joystick' },
  { action: 'Run (noisy)', keys: 'Hold Shift', touch: 'Run button' },
  { action: 'Steal', keys: 'Hold E or Space', touch: 'Hold Steal' },
  { action: 'Throw a coin', keys: 'Q', touch: 'Coin button' },
];

export default function PlayHeist() {
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<HeistGame | null>(null);
  const navigate = useNavigate();
  const closeButton = (
    <Button className="panel-close" type="text" shape="circle" icon={<CloseOutlined />} aria-label="Back to games" onClick={() => navigate('/')} />
  );
  const { user, askToSignIn } = useAuth();
  const [state, setState] = useState<HeistState>('loading');
  const [progress, setProgress] = useState(0);
  const [hud, setHud] = useState<HeistHud | null>(null);
  const [levelResult, setLevelResult] = useState<LevelResult | null>(null);
  const [end, setEnd] = useState<HeistResult | null>(null);
  const [quality, setQuality] = useState<'high' | 'low'>(() => readPref('pv.quality', touchDevice ? 'low' : 'high'));
  const [sound, setSound] = useState<boolean>(() => readPref('pv.sound', true));
  const [character, setCharacter] = useState<CharacterId>(preferredCharacter);
  const [loadError, setLoadError] = useState<string | null>(null);
  const localBest = useRef<number>(readPref('pv.best.heist', 0));

  const submit = useMutation({
    mutationFn: (r: HeistResult) =>
      api
        .post<SubmitResult>('/scores', { game: GAME_ID, score: r.score, durationMs: r.durationMs, stats: { levels: r.levelsCleared, gems: r.gems } })
        .then((res) => res.data),
  });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setLoadError(null);
    const game = new HeistGame(
      stage,
      {
        onState: setState,
        onHud: setHud,
        onProgress: setProgress,
        onLevelDone: setLevelResult,
        onEnd: setEnd,
      },
      quality,
    );
    gameRef.current = game;
    game.setSound(readPref('pv.sound', true));
    game.load().catch((e) => setLoadError(`The game couldn’t load: ${e?.message ?? e}`));
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [quality, character]);

  useEffect(() => {
    gameRef.current?.setSound(sound);
    writePref('pv.sound', sound);
  }, [sound]);

  // Save the run when it ends.
  useEffect(() => {
    if (!end) return;
    if (end.score > localBest.current) {
      localBest.current = end.score;
      writePref('pv.best.heist', end.score);
    }
    if (user && end.score > 0 && end.durationMs >= 5000) submit.mutate(end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end]);

  const begin = useCallback(() => {
    gameRef.current?.begin();
    gameRef.current?.focus();
  }, []);
  const next = useCallback(() => {
    setLevelResult(null);
    gameRef.current?.nextLevel();
  }, []);
  const restart = useCallback(() => {
    setLevelResult(null);
    setEnd(null);
    submit.reset();
    gameRef.current?.restart();
  }, [submit]);

  // Keyboard: held keys become a movement vector.
  useEffect(() => {
    const held = new Set<string>();
    const sync = () => {
      const g = gameRef.current;
      if (!g) return;
      const x = (held.has('arrowright') || held.has('d') ? 1 : 0) - (held.has('arrowleft') || held.has('a') ? 1 : 0);
      const z = (held.has('arrowup') || held.has('w') ? 1 : 0) - (held.has('arrowdown') || held.has('s') ? 1 : 0);
      g.setInput(x, z, held.has('shift'));
      g.setInteract(held.has('e') || held.has(' '));
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
      const g = gameRef.current;
      if (!g) return;
      if (k === 'enter') {
        if (state === 'briefing') begin();
        else if (state === 'escaped') next();
        return;
      }
      if (k === 'p' || k === 'escape') {
        if (state === 'playing') g.pause();
        else if (state === 'paused') g.resume();
        return;
      }
      if (k === 'q' && !e.repeat) g.throwCoin();
      held.add(k);
      sync();
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.key.toLowerCase());
      sync();
    };
    const blur = () => {
      held.clear();
      sync();
    };
    const hidden = () => document.hidden && gameRef.current?.pause();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [state, begin, next]);

  const r = submit.data;
  const playing = state === 'playing' || state === 'paused';
  const level = LEVELS[(hud?.level ?? 1) - 1];
  const alert = hud?.alert ?? 0;

  const saveNote = (result: HeistResult) =>
    user ? (
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
      ) : result.score === 0 ? (
        <Alert type="info" showIcon title="Clear a level to get on the leaderboard." />
      ) : null
    ) : (
      <Alert
        type="info"
        showIcon
        title="Log in to save this score and join the leaderboard."
        action={<Button size="small" onClick={() => askToSignIn('Log in to save your scores')}>Log in</Button>}
      />
    );

  const breakdown = (lr: LevelResult) => (
    <div className="breakdown">
      <div><span>Escaped</span><b>+{lr.escape}</b></div>
      <div><span>Gems ({lr.gems})</span><b>+{lr.gemPoints}</b></div>
      <div><span>Speed ({clock(lr.seconds)})</span><b>+{lr.timeBonus}</b></div>
      <div><span>Ghost bonus {lr.ghost ? '' : '(you were noticed)'}</span><b>+{lr.ghost}</b></div>
      <div className="sum"><span>Level score</span><b>{lr.total}</b></div>
    </div>
  );

  return (
    <div className="play-page heist">
      <div ref={stageRef} className="game-stage" />

      <div className="game-topbar">
        <Tooltip title="Back to games">
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} aria-label="Back to games" />
        </Tooltip>
        {playing && hud ? (
          <div className="heist-hud">
            <div className="hud-row">
              <span className="hud-chip">Level {hud.level} · {hud.levelName}</span>
              <span className="hud-chip">{clock(hud.time)}</span>
              <span className="hud-chip gem">◆ {hud.gems}/{hud.gemsTotal}</span>
              <span className="hud-chip coin">● {hud.coinsLeft}</span>
              <span className={`hud-chip goal ${hud.hasPainting ? 'done' : ''}`}>{hud.hasPainting ? 'Painting stolen. Get to the exit!' : `Steal “${level?.painting}”`}</span>
            </div>
            <div className="detect" aria-label={`Detection ${Math.round(alert * 100)}%`}>
              <span>Detection</span>
              <div className="detect-track"><div className="detect-fill" style={{ width: `${alert * 100}%`, background: alert > 0.6 ? '#ff3b3b' : alert > 0.2 ? '#ffb020' : '#4fd18b' }} /></div>
            </div>
          </div>
        ) : (
          <span />
        )}
        <Space>
          <Tooltip title={sound ? 'Mute' : 'Sound on'}>
            <Button shape="circle" icon={sound ? <SoundOutlined /> : <MutedOutlined />} onClick={() => setSound((s) => !s)} aria-label="Sound" />
          </Tooltip>
          {state === 'playing' && (
            <Tooltip title="Pause (P)">
              <Button shape="circle" icon={<PauseOutlined />} onClick={() => gameRef.current?.pause()} aria-label="Pause" />
            </Tooltip>
          )}
        </Space>
      </div>

      {state === 'playing' && hud?.prompt && (
        <div className="heist-prompt">
          {hud.prompt}
          {hud.steal > 0 && <Progress percent={Math.round(hud.steal * 100)} showInfo={false} size="small" strokeColor="#ffc65a" />}
        </div>
      )}

      {state === 'playing' && touchDevice && <TouchControls game={gameRef} />}

      {state === 'loading' && !loadError && (
        <div className="overlay">
          <div className="panel narrow">
            <h2>Sneaking into the museum…</h2>
            <Progress percent={Math.round(progress * 100)} strokeColor={{ from: '#7aa2ff', to: '#b06bff' }} />
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

      {state === 'briefing' && hud && (
        <div className="overlay overlay-low">
          <div className="panel briefing">
            {closeButton}
            <Tag color="purple">Level {hud.level} of {LEVELS.length}</Tag>
            <h1 className="game-title small">{hud.levelName}</h1>
            <p className="eyebrow">Target: “{level?.painting}”</p>
            <p className="lead">{level?.brief}</p>
            {hud.level === 1 && (
              <p className="lead small">
                Guards see in the yellow cones; cameras in the red ones. Walls block their view. Walking is silent, running is not. Grab the painting, then reach the green exit.
              </p>
            )}
            <div className="controls-grid four">
              {CONTROLS.map((c) => (
                <div key={c.action} className="control-card">
                  <b>{c.action}</b>
                  <span>{touchDevice ? c.touch : c.keys}</span>
                </div>
              ))}
            </div>
            {hud.level === 1 && <CharacterPicker value={character} onChange={setCharacter} />}
            <Button type="primary" size="large" icon={<CaretRightOutlined />} onClick={begin} className="big-btn">
              Begin the heist
            </Button>
            <div className="panel-meta">
              {hud.score > 0 ? <span>Score so far: <b>{hud.score}</b></span> : <span>Your best: <b>{localBest.current}</b></span>}
              {hud.level === 1 && (
                <span className="graphics">
                  Graphics
                  <Segmented size="small" value={quality} onChange={(v) => { setQuality(v as 'high' | 'low'); writePref('pv.quality', v); }} options={[{ label: 'High', value: 'high' }, { label: 'Low', value: 'low' }]} />
                </span>
              )}
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

      {state === 'escaped' && levelResult && (
        <div className="overlay">
          <div className="panel narrow">
            <p className="eyebrow">Level {levelResult.level} cleared</p>
            <h2>You got away!</h2>
            {breakdown(levelResult)}
            <p className="muted">Total so far: <b>{hud?.score}</b></p>
            <Button type="primary" size="large" icon={<CaretRightOutlined />} onClick={next} autoFocus>Next level</Button>
          </div>
        </div>
      )}

      {state === 'won' && end && (
        <div className="overlay">
          <div className="panel">
            {closeButton}
            <p className="eyebrow">All {LEVELS.length} paintings stolen</p>
            <h2>Heist complete!</h2>
            {levelResult && breakdown(levelResult)}
            <div className="result-grid">
              <Statistic title="Total score" value={end.score} />
              <Statistic title="Gems" value={end.gems} />
              <Statistic title="Time" value={clock(end.durationMs / 1000)} />
            </div>
            {saveNote(end)}
            <Space wrap style={{ marginTop: 18 }}>
              <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={restart}>Play again</Button>
              <Link to={`/leaderboard?game=${GAME_ID}`}><Button size="large" icon={<TrophyOutlined />}>Leaderboard</Button></Link>
            </Space>
          </div>
        </div>
      )}

      {state === 'caught' && end && (
        <div className="overlay alarm">
          <div className="panel">
            {closeButton}
            <p className="eyebrow">{end.reason}</p>
            <h2>Caught!</h2>
            <div className="result-grid">
              <Statistic title="Score" value={end.score} />
              <Statistic title="Levels cleared" value={end.levelsCleared} />
              <Statistic title="Gems" value={end.gems} />
            </div>
            {saveNote(end)}
            <Space wrap style={{ marginTop: 18 }}>
              <Button type="primary" size="large" icon={<ReloadOutlined />} onClick={restart} autoFocus>Try again</Button>
              <Link to={`/leaderboard?game=${GAME_ID}`}><Button size="large" icon={<TrophyOutlined />}>Leaderboard</Button></Link>
            </Space>
          </div>
        </div>
      )}
    </div>
  );
}

/** On-screen joystick and buttons for phones and tablets. */
function TouchControls({ game }: { game: React.RefObject<HeistGame | null> }) {
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const run = useRef(false);
  const vec = useRef({ x: 0, z: 0 });
  const send = () => game.current?.setInput(vec.current.x, vec.current.z, run.current);

  const move = (e: React.PointerEvent) => {
    const rect = padRef.current!.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const max = rect.width / 2 - 18;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    vec.current = { x: dx / max, z: -dy / max };
    send();
  };
  const release = () => {
    setKnob({ x: 0, y: 0 });
    vec.current = { x: 0, z: 0 };
    send();
  };

  return (
    <div className="touch-controls">
      <div
        ref={padRef}
        className="touch-pad"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => e.buttons && move(e)}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div className="touch-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div className="touch-buttons">
        <button
          className="touch-btn"
          onPointerDown={() => { run.current = true; send(); }}
          onPointerUp={() => { run.current = false; send(); }}
          onPointerCancel={() => { run.current = false; send(); }}
        >Run</button>
        <button className="touch-btn" onPointerDown={() => game.current?.throwCoin()}>Coin</button>
        <button
          className="touch-btn primary"
          onPointerDown={() => game.current?.setInteract(true)}
          onPointerUp={() => game.current?.setInteract(false)}
          onPointerCancel={() => game.current?.setInteract(false)}
        >Steal</button>
      </div>
    </div>
  );
}
